import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Validador de reglas de negocio para grupos
 */
@Injectable()
export class GroupBusinessValidator {
  constructor(private prisma: PrismaService) {}

  /**
   * Valida que el usuario no haya creado más de 3 grupos para una misma asignatura.
   * El límite es de 3 grupos por usuario por materia (no global).
   */
  async validateMaxGroupsPerCourse(
    userId: number,
    courseId: number,
  ): Promise<void> {
    const groupCount = await this.prisma.group.count({
      where: {
        id_course: courseId,
        owner_id: userId,
        is_direct_message: false,
      },
    });

    if (groupCount >= 3) {
      throw new BadRequestException(
        `Has alcanzado el límite de 3 grupos para esta materia.`,
      );
    }
  }

  /**
   * Valida que un usuario esté inscrito en el curso del grupo
   */
  async validateCourseEnrollment(
    userId: number,
    courseId: number,
  ): Promise<void> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id_user: userId,
        id_course: courseId,
        status: 'active', 
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'No puedes unirte a este grupo porque no estás inscrito en la materia correspondiente.',
      );
    }
  }

  /**
   * Valida que el usuario que invita sea admin del grupo
   */
  async validateAdminInvitation(
    inviterId: number,
    groupId: number,
  ): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id_user: inviterId,
        id_group: groupId,
        is_admin: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Solo los administradores del grupo pueden invitar a nuevos miembros.',
      );
    }
  }

  /**
   * Valida que el invitado esté inscrito en el mismo curso del grupo
   */
  async validateInviteeEnrollment(
    inviteeId: number,
    groupId: number,
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { id_course: true },
    });

    if (!group || !group.id_course) {
      throw new BadRequestException('Grupo no encontrado o sin curso asignado.');
    }

    await this.validateCourseEnrollment(inviteeId, group.id_course);
  }

  /**
   * Valida que el usuario no sea ya miembro del grupo
   */
  async validateNotAlreadyMember(
    userId: number,
    groupId: number,
  ): Promise<void> {
    const existingMembership = await this.prisma.membership.findFirst({
      where: {
        id_user: userId,
        id_group: groupId,
      },
    });

    if (existingMembership) {
      throw new BadRequestException(
        'Este usuario ya es miembro del grupo.',
      );
    }
  }

  /**
   * Valida que no exista una invitación pendiente
   */
  async validateNoPendingInvitation(
    inviteeId: number,
    groupId: number,
  ): Promise<void> {
    const existingInvitation = await this.prisma.group_invitation.findFirst({
      where: {
        id_group: groupId,
        invitee_id: inviteeId,
        status: 'pending',
      },
    });

    if (existingInvitation) {
      throw new BadRequestException(
        'Ya existe una invitación pendiente para este usuario en este grupo.',
      );
    }
  }

  /**
   * Valida que el usuario sea el owner del grupo
   */
  async validateGroupOwnership(
    userId: number,
    groupId: number,
  ): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group) {
      throw new BadRequestException('Grupo no encontrado.');
    }

    if (group.owner_id !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción. Solo el propietario del grupo puede hacerlo.',
      );
    }
  }
}
