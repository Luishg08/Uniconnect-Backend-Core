import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupInvitationDto } from './dto/create-group-invitation.dto';
import { RespondGroupInvitationDto } from './dto/respond-group-invitation.dto';
import { GroupBusinessValidator } from '../groups/validators/group-business.validator';
import { MESSAGE_EVENTS } from '../messages/events/message.events';

@Injectable()
export class GroupInvitationsService {
  constructor(
    private prisma: PrismaService,
    private groupValidator: GroupBusinessValidator,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Enviar una invitación a un grupo
   */
  async sendInvitation(createDto: CreateGroupInvitationDto) {
      // 1. Validar que el inviter es admin del grupo
      await this.groupValidator.validateAdminInvitation(
        createDto.inviter_id,
        createDto.id_group,
      );

      // 2. Validar que el invitee tiene la materia inscrita
      await this.groupValidator.validateInviteeEnrollment(
        createDto.invitee_id,
        createDto.id_group,
      );

      // 3. Validar que el invitee no es ya miembro del grupo
      await this.groupValidator.validateNotAlreadyMember(
        createDto.invitee_id,
        createDto.id_group,
      );

      // 4. Crear o actualizar la invitación con manejo defensivo de P2002
      try {
        const invitation = await this.prisma.group_invitation.upsert({
          where: {
            id_group_invitee_id: {
              id_group: createDto.id_group,
              invitee_id: createDto.invitee_id,
            },
          },
          update: {
            status: 'pending',
            invited_at: new Date(),
            responded_at: null,
            inviter_id: createDto.inviter_id,
          },
          create: {
            id_group: createDto.id_group,
            inviter_id: createDto.inviter_id,
            invitee_id: createDto.invitee_id,
            status: 'pending',
          },
          include: {
            group: {
              select: {
                id_group: true,
                name: true,
                course: { select: { name: true } },
              },
            },
            inviter: {
              select: {
                id_user: true,
                full_name: true,
                picture: true,
              },
            },
          },
        });

        // 5. Emitir evento de invitación enviada
        this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_INVITATION_SENT, {
          id_invitation: invitation.id_invitation,
          id_group: invitation.id_group,
          group_name: invitation.group?.name || 'Grupo',
          inviter_id: invitation.inviter_id,
          inviter_name: invitation.inviter?.full_name || 'Usuario',
          invitee_id: invitation.invitee_id,
          invited_at: invitation.invited_at,
        });

        return {
          message: 'Invitación enviada exitosamente',
          invitation,
        };
      } catch (error: unknown) {
        // Manejo defensivo de error P2002 (unique constraint violation)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          // Buscar y eliminar registro conflictivo
          const conflicting = await this.prisma.group_invitation.findUnique({
            where: {
              id_group_invitee_id: {
                id_group: createDto.id_group,
                invitee_id: createDto.invitee_id,
              },
            },
          });

          if (conflicting) {
            // Eliminar registro huérfano y reintentar
            await this.prisma.group_invitation.delete({
              where: { id_invitation: conflicting.id_invitation },
            });

            // Reintentar operación recursivamente
            return this.sendInvitation(createDto);
          }
        }

        // Re-lanzar otros errores
        throw error;
      }
    }

  /**
   * Obtener invitaciones pendientes del usuario
   */
  async getPendingInvitations(userId: number) {
    return this.prisma.group_invitation.findMany({
      where: {
        invitee_id: userId,
        status: 'pending',
      },
      include: {
        group: {
          select: {
            id_group: true,
            name: true,
            description: true,
            course: { select: { name: true } },
            owner: { select: { full_name: true, picture: true } },
            _count: { select: { memberships: true } },
          },
        },
        inviter: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
          },
        },
      },
      orderBy: {
        invited_at: 'desc',
      },
    });
  }

  /**
   * Responder a una invitación (aceptar o rechazar)
   */
  async respondToInvitation(
    invitationId: number,
    userId: number,
    respondDto: RespondGroupInvitationDto,
  ) {
    // 1. Buscar la invitación
    const invitation = await this.prisma.group_invitation.findUnique({
      where: { id_invitation: invitationId },
      include: { group: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    // 2. Validar que el usuario es el invitado
    if (invitation.invitee_id !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para responder esta invitación',
      );
    }

    // 3. Validar que la invitación está pendiente
    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        'Esta invitación ya fue respondida anteriormente',
      );
    }

    // 4. Actualizar el estado de la invitación
    const updatedInvitation = await this.prisma.group_invitation.update({
      where: { id_invitation: invitationId },
      data: {
        status: respondDto.status,
        responded_at: new Date(),
      },
    });

    // 5. Si se aceptó, crear la membresía
    if (respondDto.status === 'accepted') {
      const membership = await this.prisma.membership.create({
        data: {
          id_user: userId,
          id_group: invitation.id_group,
          is_admin: false,
          joined_at: new Date(),
        },
        include: {
          user: { select: { full_name: true } },
        },
      });

      // Emitir evento de invitación aceptada
      this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_INVITATION_ACCEPTED, {
        id_invitation: invitationId,
        id_group: invitation.id_group,
        group_name: invitation.group?.name || 'Grupo',
        invitee_id: userId,
        invitee_name: membership.user?.full_name || 'Usuario',
        accepted_at: new Date(),
      });

      // Emitir evento de usuario unido al grupo
      this.eventEmitter.emit(MESSAGE_EVENTS.USER_JOINED_GROUP, {
        id_user: userId,
        id_group: invitation.id_group,
        full_name: membership.user?.full_name || 'Usuario',
        joined_at: new Date(),
      });

      return {
        message: 'Invitación aceptada. Ahora eres miembro del grupo.',
        invitation: updatedInvitation,
      };
    }

    // Emitir evento de invitación rechazada
    this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_INVITATION_REJECTED, {
      id_invitation: invitationId,
      id_group: invitation.id_group,
      invitee_id: userId,
      rejected_at: new Date(),
    });

    return {
      message: 'Invitación rechazada',
      invitation: updatedInvitation,
    };
  }

  /**
   * Obtener todas las invitaciones enviadas por un usuario (como admin)
   */
  async getSentInvitations(userId: number) {
    return this.prisma.group_invitation.findMany({
      where: {
        inviter_id: userId,
      },
      include: {
        group: {
          select: {
            id_group: true,
            name: true,
            course: { select: { name: true } },
          },
        },
        invitee: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
          },
        },
      },
      orderBy: {
        invited_at: 'desc',
      },
    });
  }

  /**
   * Cancelar una invitación (solo el inviter puede hacerlo)
   */
  async cancelInvitation(invitationId: number, userId: number) {
    const invitation = await this.prisma.group_invitation.findUnique({
      where: { id_invitation: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.inviter_id !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para cancelar esta invitación',
      );
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        'Solo se pueden cancelar invitaciones pendientes',
      );
    }

    await this.prisma.group_invitation.delete({
      where: { id_invitation: invitationId },
    });

    return {
      message: 'Invitación cancelada exitosamente',
    };
  }
}
