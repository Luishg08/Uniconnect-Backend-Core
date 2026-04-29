import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupBusinessValidator } from './validators/group-business.validator';
import { MESSAGE_EVENTS } from '../messages/events/message.events';
import { StudyGroupSubject } from './domain/observer/study-group-subject';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private groupValidator: GroupBusinessValidator,
    private eventEmitter: EventEmitter2,
    private studyGroupSubject: StudyGroupSubject,
  ) { }

  // 1. Crear grupo con validaciones y membresía automática
  async create(createGroupDto: CreateGroupDto, userId: number) {
    // Usar userId del JWT en lugar del DTO para seguridad
    const owner_id = userId;
    
    // Validar que el usuario existe
    const user = await this.prisma.user.findUnique({
      where: { id_user: owner_id },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${owner_id} no encontrado.`);
    }

    // Validar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id_course: createGroupDto.id_course },
    });

    if (!course) {
      throw new NotFoundException(`El curso con ID ${createGroupDto.id_course} no existe.`);
    }

    // Validar que el usuario está inscrito en el curso
    await this.groupValidator.validateCourseEnrollment(
      owner_id,
      createGroupDto.id_course,
    );

    // Validar límite de 3 grupos por materia
    await this.groupValidator.validateMaxGroupsPerCourse(
      owner_id,
      createGroupDto.id_course,
    );

    try {
      const group = await this.prisma.$transaction(async (tx) => {
        const createdGroup = await tx.group.create({
          data: {
            name: createGroupDto.name,
            description: createGroupDto.description,
            id_course: createGroupDto.id_course,
            owner_id: owner_id,
          },
        });

        await tx.membership.create({
          data: {
            id_user: owner_id,
            id_group: createdGroup.id_group,
            is_admin: true,
            joined_at: new Date(),
          },
        });

        return createdGroup;
      });

      // Emitir evento GROUP_CREATED después de transacción exitosa
      this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_CREATED, {
        id_group: group.id_group,
        group_name: group.name || 'Grupo',
        owner_id: group.owner_id!,
        owner_name: user.full_name || 'Usuario',
        id_course: group.id_course!,
        course_name: course.name || 'Curso',
        created_at: group.created_at,
      });

      return group;
    } catch (error) {
      throw new InternalServerErrorException('Error al procesar la creación del grupo y su membresía');
    }
  }

  // 2. Buscar todos los grupos donde el usuario participa
  async findAllByUser(userId: number) {
    return this.prisma.group.findMany({
      where: {
        memberships: {
          some: { id_user: userId },
        },
      },
      include: {
        course: {
          select: { name: true, program: { select: { name: true } } }
        },
        _count: {
          select: { memberships: true }
        }
      },
    });
  }

  // 3. Obtener detalle de un grupo (SOLO grupos normales)
  async findOne(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: id },
      include: {
        course: true,
        owner: {
          select: { full_name: true, email: true }
        },
        memberships: {
          include: { user: { select: { full_name: true, picture: true } } }
        }
      }
    });

    if (!group) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado`);
    }

    // Validar que NO sea un chat privado
    if (group.is_direct_message) {
      throw new NotFoundException(
        'Este es un chat privado, no un grupo de estudio'
      );
    }

    return group;
  }

  // 4. Eliminar grupo con validación de Owner
  async remove(id_group: number, userId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group },
    });

    if (!group) {
      throw new NotFoundException(`El grupo con ID ${id_group} no existe.`);
    }

    // Bloquear eliminación de chats privados por este endpoint
    if (group.is_direct_message) {
      throw new BadRequestException(
        'No puedes eliminar chats privados usando este endpoint. Usa el endpoint específico de chats privados.'
      );
    }

    // Validación de seguridad: Solo el dueño puede borrar
    if (group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permisos para eliminar este grupo. Solo el propietario puede hacerlo.');
    }

    try {
      // Obtener lista de miembros ANTES de eliminar el grupo
      const members = await this.prisma.membership.findMany({
        where: { id_group },
        select: { id_user: true },
      });
      const memberIds = members.map(m => m.id_user).filter((id): id is number => id !== null);

      // Si se borra el grupo, 
      // se deberían borrar las membresías en cascada si así está en el DB.
      await this.prisma.group.delete({
        where: { id_group },
      });

      // Emitir evento GROUP_DELETED después de delete exitoso
      this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_DELETED, {
        id_group,
        group_name: group.name || 'Grupo',
        owner_id: group.owner_id!,
        member_ids: memberIds,
        deleted_at: new Date(),
      });
    } catch (error) {
      throw new InternalServerErrorException('Error al intentar eliminar el grupo.');
    }
  }

  async update(id: number, userId: number, updateGroupDto: UpdateGroupDto) {
    // 1. Buscamos el grupo para validar propiedad
    const group = await this.prisma.group.findUnique({
      where: { id_group: id },
    });

    if (!group) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado`);
    }

    // Bloquear edición de chats privados por este endpoint
    if (group.is_direct_message) {
      throw new BadRequestException(
        'No puedes editar chats privados usando este endpoint.'
      );
    }

    if (group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este grupo');
    }

    // 2. Actualizamos solo los campos enviados
    const updated = await this.prisma.group.update({
      where: { id_group: id },
      data: updateGroupDto,
    });

    // Emitir evento GROUP_UPDATED después de update exitoso
    const updatedFields = Object.keys(updateGroupDto);
    this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_UPDATED, {
      id_group: updated.id_group,
      group_name: updated.name || 'Grupo',
      owner_id: updated.owner_id!,
      updated_fields: updatedFields,
      updated_at: new Date(),
    });

    return updated;
  }

  /**
   * Obtener grupos creados por el usuario (es owner)
   * SOLO grupos normales, NO chats privados
   */
  async findGroupsCreatedByUser(userId: number) {
    return this.prisma.group.findMany({
      where: {
        is_direct_message: false,
        owner_id: userId,
      },
      include: {
        course: {
          select: { name: true, program: { select: { name: true } } },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Obtener grupos donde el usuario es miembro (pero no necesariamente owner)
   * SOLO grupos normales, NO chats privados
   */
  async findGroupsMemberOf(userId: number) {
    return this.prisma.group.findMany({
      where: {
        is_direct_message: false,
        memberships: {
          some: { id_user: userId },
        },
      },
      include: {
        course: {
          select: { name: true, program: { select: { name: true } } },
        },
        owner: {
          select: { id_user: true, full_name: true, picture: true },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Descubrir grupos disponibles según las materias inscritas del usuario
   * SOLO grupos normales, NO chats privados
   */
  async discoverGroups(userId: number) {
    // Obtener cursos en los que el usuario está inscrito
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        id_user: userId,
        status: 'active',
      },
      select: { id_course: true },
    });

    const courseIds = enrollments.map((e) => e.id_course).filter((id): id is number => id !== null);

    // Obtener grupos de esos cursos donde el usuario NO es miembro
    const groups = await this.prisma.group.findMany({
      where: {
        is_direct_message: false,
        id_course: { in: courseIds },
        memberships: {
          none: { id_user: userId },
        },
      },
      include: {
        course: {
          select: { name: true, program: { select: { name: true } } },
        },
        owner: {
          select: { id_user: true, full_name: true, picture: true },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return groups;
  }

  /**
   * Buscar grupos por curso específico
   * SOLO grupos normales, NO chats privados
   */
  async findGroupsByCourse(courseId: number, userId?: number) {
    return this.prisma.group.findMany({
      where: {
        is_direct_message: false,
        id_course: courseId,
      },
      include: {
        course: {
          select: { name: true },
        },
        owner: {
          select: { id_user: true, full_name: true, picture: true },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Obtener todos los chats privados de un usuario
   */
  async findUserDirectMessages(userId: number) {
    return this.prisma.group.findMany({
      where: {
        is_direct_message: true,
        memberships: {
          some: { id_user: userId },
        },
      },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id_user: true,
                full_name: true,
                picture: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Buscar o crear un chat privado entre dos usuarios
   * Flujo:
   * 1. Busca si ya existe un grupo con is_direct_message = true para estos dos usuarios
   * 2. Si existe, lo devuelve
   * 3. Si no existe, crea uno nuevo con ambos usuarios como miembros
   */
  async findOrCreateDirectMessage(userId1: number, userId2: number) {
      if (userId1 === userId2) {
        throw new ForbiddenException('No puedes crear un chat privado contigo mismo');
      }

      // Validar que ambos usuarios existan
      const user1 = await this.prisma.user.findUnique({ where: { id_user: userId1 } });
      const user2 = await this.prisma.user.findUnique({ where: { id_user: userId2 } });

      if (!user1 || !user2) {
        throw new NotFoundException('Uno o ambos usuarios no existen');
      }

      // Verificar autorización: conexión aceptada O grupo compartido
      const connection = await this.prisma.connection.findFirst({
        where: {
          OR: [
            { requester_id: userId1, adressee_id: userId2, status: 'accepted' },
            { requester_id: userId2, adressee_id: userId1, status: 'accepted' },
          ],
        },
      });

      // Si no son amigos, verificar si comparten al menos un grupo
      if (!connection) {
        // Buscar un grupo (no DM) donde AMBOS usuarios sean miembros.
        // Se usan dos cláusulas `some` independientes sobre la misma relación
        // porque id_user es Int? (nullable) y la sintaxis `every` no es segura aquí.
        const sharedGroup = await this.prisma.group.findFirst({
          where: {
            is_direct_message: false,
            memberships: {
              some: { id_user: userId1 },
            },
            AND: {
              memberships: {
                some: { id_user: userId2 },
              },
            },
          },
          select: { id_group: true },
        });

        console.log('[DM] Shared group check:', {
          userId1,
          userId2,
          sharedGroupFound: sharedGroup,
        });

        if (!sharedGroup) {
          console.warn('[DM] 403 — no connection and no shared group between users', {
            userId1,
            userId2,
          });
          throw new ForbiddenException(
            'Solo puedes iniciar un chat privado con tus conexiones o con compañeros de grupo',
          );
        }
      }

      // Buscar si ya existe un chat privado entre estos dos usuarios
      const existingDirectMessage = await this.prisma.group.findFirst({
        where: {
          is_direct_message: true,
          memberships: {
            every: {
              id_user: { in: [userId1, userId2] },
            },
          },
        },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id_user: true,
                  full_name: true,
                  email: true,
                  picture: true,
                },
              },
            },
          },
        },
      });

      if (existingDirectMessage) {
        return {
          success: true,
          isNew: false,
          group: existingDirectMessage,
        };
      }

      // Si no existe, crear uno nuevo
      try {
        const newDirectMessage = await this.prisma.$transaction(async (tx) => {
          // Crear el grupo como chat privado
          const group = await tx.group.create({
            data: {
              name: `Direct Message: ${user1.full_name} & ${user2.full_name}`,
              is_direct_message: true,
              // No asignar curso ni owner para chats privados
            },
          });

          // Agregar a ambos usuarios como miembros (no admin)
          await tx.membership.create({
            data: {
              id_user: userId1,
              id_group: group.id_group,
              is_admin: false,
              joined_at: new Date(),
            },
          });

          await tx.membership.create({
            data: {
              id_user: userId2,
              id_group: group.id_group,
              is_admin: false,
              joined_at: new Date(),
            },
          });

          return group;
        });

        // Retornar con los datos de membresías
        const groupWithMembers = await this.prisma.group.findUnique({
          where: { id_group: newDirectMessage.id_group },
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id_user: true,
                    full_name: true,
                    email: true,
                    picture: true,
                  },
                },
              },
            },
          },
        });

        return {
          success: true,
          isNew: true,
          group: groupWithMembers,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        throw new InternalServerErrorException(
          'Error al crear el chat privado: ' + errorMessage,
        );
      }
    }

  // =====================================================
  // GESTIÓN DE PARTICIPANTES - SOLICITUDES DE ACCESO
  // =====================================================

  async requestGroupAccess(userId: number, groupId: number) {
      const group = await this.prisma.group.findUnique({
        where: { id_group: groupId },
        select: { id_group: true, is_direct_message: true, owner_id: true, name: true },
      });

      if (!group) {
        throw new NotFoundException('Grupo no encontrado');
      }

      if (group.is_direct_message) {
        throw new BadRequestException('No puedes solicitar acceso a un chat directo');
      }

      // Verificar que el usuario no es ya miembro
      const existingMembership = await this.prisma.membership.findUnique({
        where: { id_user_id_group: { id_user: userId, id_group: groupId } },
      });

      if (existingMembership) {
        throw new BadRequestException('Ya eres miembro de este grupo');
      }

      // Idempotencia: verificar si ya existe una solicitud pendiente
      const existingPendingRequest = await this.prisma.group_join_request.findFirst({
        where: { id_group: groupId, requester_id: userId, status: 'pending' },
      });

      if (existingPendingRequest) {
        throw new BadRequestException('Ya tienes una solicitud de acceso pendiente para este grupo');
      }

      // Exclusión mutua: verificar si ya existe una invitación activa para el usuario
      const activeInvitation = await this.prisma.group_invitation.findFirst({
        where: { id_group: groupId, invitee_id: userId, status: 'pending' },
      });

      if (activeInvitation) {
        throw new BadRequestException(
          'Ya tienes una invitación pendiente para este grupo. Acepta o rechaza la invitación antes de solicitar acceso.',
        );
      }

      // Crear o actualizar solicitud con manejo defensivo de P2002
      try {
        const joinRequest = await this.prisma.group_join_request.upsert({
          where: { id_group_requester_id: { id_group: groupId, requester_id: userId } },
          create: {
            id_group: groupId,
            requester_id: userId,
            status: 'pending',
          },
          update: {
            status: 'pending',
            requested_at: new Date(),
            responded_at: null,
          },
          include: {
            requester: {
              select: { id_user: true, full_name: true, picture: true, email: true },
            },
          },
        });

        // Emitir evento para notificar al owner del grupo
        this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_SENT, {
          id_request: joinRequest.id_request,
          id_group: groupId,
          group_name: group.name ?? 'Grupo',
          owner_id: group.owner_id!,
          requester_id: userId,
          requester_name: joinRequest.requester?.full_name ?? 'Usuario',
          requester_picture: joinRequest.requester?.picture ?? null,
          requested_at: joinRequest.requested_at,
        });

        // Notificar al owner mediante Observer pattern
        this.studyGroupSubject.notify({
          type: 'JOIN_REQUEST',
          payload: {
            id_request: joinRequest.id_request,
            id_group: groupId,
            group_name: group.name ?? 'Grupo',
            requester_id: userId,
            requester_name: joinRequest.requester?.full_name ?? 'Usuario',
          },
          targetUserId: group.owner_id!,
          timestamp: new Date(),
        });

        return joinRequest;
      } catch (error: unknown) {
        // Manejo defensivo de error P2002 (unique constraint violation)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          // Buscar registro conflictivo y actualizarlo directamente
          const conflicting = await this.prisma.group_join_request.findUnique({
            where: {
              id_group_requester_id: {
                id_group: groupId,
                requester_id: userId,
              },
            },
          });

          if (conflicting) {
            // Actualizar directamente a pending
            const updated = await this.prisma.group_join_request.update({
              where: { id_request: conflicting.id_request },
              data: {
                status: 'pending',
                requested_at: new Date(),
                responded_at: null,
              },
              include: {
                requester: {
                  select: { id_user: true, full_name: true, picture: true, email: true },
                },
              },
            });

            // Emitir evento
            this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_SENT, {
              id_request: updated.id_request,
              id_group: groupId,
              group_name: group.name ?? 'Grupo',
              owner_id: group.owner_id!,
              requester_id: userId,
              requester_name: updated.requester?.full_name ?? 'Usuario',
              requester_picture: updated.requester?.picture ?? null,
              requested_at: updated.requested_at,
            });

            return updated;
          }
        }

        // Re-lanzar otros errores
        throw error;
      }
    }

  async getPendingJoinRequests(groupId: number, userId: number) {
    // Verificar que el usuario es el owner del grupo
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group || group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para ver las solicitudes de este grupo');
    }

    return await this.prisma.group_join_request.findMany({
      where: {
        id_group: groupId,
        status: 'pending',
      },
      include: {
        requester: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
            email: true,
            program: { select: { name: true } },
          },
        },
      },
      orderBy: { requested_at: 'desc' },
    });
  }

  /**
   * Obtiene todas las solicitudes de unión pendientes de todos los grupos
   * donde el usuario autenticado es el owner.
   * Usado por: GET /groups/owner/pending-requests
   */
  async getAllPendingRequestsForOwner(userId: number) {
    const groups = await this.prisma.group.findMany({
      where: {
        owner_id: userId,
        is_direct_message: false,
      },
      select: {
        id_group: true,
        name: true,
        description: true,
        group_join_requests: {
          where: { status: 'pending' },
          include: {
            requester: {
              select: {
                id_user: true,
                full_name: true,
                picture: true,
                email: true,
                program: { select: { name: true } },
              },
            },
          },
          orderBy: { requested_at: 'desc' },
        },
      },
    });

    // Filtrar grupos sin solicitudes y mapear al formato esperado por el frontend
    return groups
      .filter((g) => g.group_join_requests.length > 0)
      .map((g) => ({
        id_group: g.id_group,
        name: g.name,
        description: g.description,
        joinRequests: g.group_join_requests,
      }));
  }

  async acceptJoinRequest(requestId: number, groupId: number, userId: number) {
    // Verificar que el usuario es el owner
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group || group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para aceptar solicitudes');
    }

    const request = await this.prisma.group_join_request.findUnique({
      where: { id_request: requestId },
    });

    if (!request || request.id_group !== groupId) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Esta solicitud ya fue respondida');
    }

    // Crear membresía y actualizar solicitud en transacción
    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          id_user: request.requester_id,
          id_group: groupId,
          is_admin: false,
          joined_at: new Date(),
        },
      });

      return await tx.group_join_request.update({
        where: { id_request: requestId },
        data: {
          status: 'accepted',
          responded_at: new Date(),
        },
        include: {
          requester: {
            select: { id_user: true, full_name: true, picture: true },
          },
          group: { select: { name: true } },
        },
      });
    });

    // Notificar al requester que fue aceptado
    this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_ACCEPTED, {
      id_request: requestId,
      id_group: groupId,
      group_name: updatedRequest.group?.name ?? 'Grupo',
      requester_id: request.requester_id,
      requester_name: updatedRequest.requester?.full_name ?? 'Usuario',
      responded_at: new Date(),
    });

    // Notificar al requester mediante Observer pattern
    this.studyGroupSubject.notify({
      type: 'MEMBER_ACCEPTED',
      payload: {
        id_request: requestId,
        id_group: groupId,
        group_name: updatedRequest.group?.name ?? 'Grupo',
      },
      targetUserId: request.requester_id,
      timestamp: new Date(),
    });

    return updatedRequest;
  }

  async rejectJoinRequest(requestId: number, groupId: number, userId: number) {
    // Verificar que el usuario es el owner
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group || group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para rechazar solicitudes');
    }

    const request = await this.prisma.group_join_request.findUnique({
      where: { id_request: requestId },
    });

    if (!request || request.id_group !== groupId) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Esta solicitud ya fue respondida');
    }

    const rejectedRequest = await this.prisma.group_join_request.update({
      where: { id_request: requestId },
      data: {
        status: 'rejected',
        responded_at: new Date(),
      },
      include: { group: { select: { name: true } } },
    });

    // Notificar al requester que fue rechazado
    this.eventEmitter.emit(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_REJECTED, {
      id_request: requestId,
      id_group: groupId,
      group_name: rejectedRequest.group?.name ?? 'Grupo',
      requester_id: request.requester_id,
      responded_at: new Date(),
    });

    // Notificar al requester mediante Observer pattern
    this.studyGroupSubject.notify({
      type: 'MEMBER_REJECTED',
      payload: {
        id_request: requestId,
        id_group: groupId,
        group_name: rejectedRequest.group?.name ?? 'Grupo',
      },
      targetUserId: request.requester_id,
      timestamp: new Date(),
    });

    return rejectedRequest;
  }
  async acceptInvitation(invitationId: number, groupId: number, userId: number) {
    // Buscar la invitación y validar que existe, pertenece al grupo y está pendiente
    const invitation = await this.prisma.group_invitation.findUnique({
      where: { id_invitation: invitationId },
    });

    if (!invitation || invitation.id_group !== groupId) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.invitee_id !== userId) {
      throw new ForbiddenException('No tienes permiso para aceptar esta invitación');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Esta invitación ya fue respondida');
    }

    // Crear membresía y actualizar invitación en transacción
    return await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          id_user: userId,
          id_group: groupId,
          is_admin: false,
          joined_at: new Date(),
        },
      });

      return await tx.group_invitation.update({
        where: { id_invitation: invitationId },
        data: {
          status: 'accepted',
          responded_at: new Date(),
        },
        include: {
          inviter: { select: { id_user: true, full_name: true, picture: true } },
        },
      });
    });
  }

  async rejectInvitation(invitationId: number, groupId: number, userId: number) {
    // Buscar la invitación y validar que existe, pertenece al grupo y está pendiente
    const invitation = await this.prisma.group_invitation.findUnique({
      where: { id_invitation: invitationId },
    });

    if (!invitation || invitation.id_group !== groupId) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.invitee_id !== userId) {
      throw new ForbiddenException('No tienes permiso para rechazar esta invitación');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Esta invitación ya fue respondida');
    }

    return await this.prisma.group_invitation.update({
      where: { id_invitation: invitationId },
      data: {
        status: 'rejected',
        responded_at: new Date(),
      },
    });
  }
  // =====================================================
  // GESTIÓN DE MIEMBROS
  // =====================================================

  async getGroupMembers(groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    return await this.prisma.membership.findMany({
      where: { id_group: groupId },
      include: {
        user: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
            email: true,
            program: { select: { name: true } },
          },
        },
      },
      orderBy: { joined_at: 'asc' },
    });
  }

  async leaveGroup(groupId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: { id_user_id_group: { id_user: userId, id_group: groupId } },
      include: { 
        group: { select: { owner_id: true, name: true } },
        user: { select: { full_name: true } }
      },
    });

    if (!membership) {
      throw new NotFoundException('No eres miembro de este grupo');
    }

    // Bloquear salida del owner
    if (membership.group?.owner_id === userId) {
      // Consulta separada para pending_owner_id (campo nuevo, requiere cliente regenerado)
      const groupData = await this.prisma.group.findUnique({
        where: { id_group: groupId },
        select: { pending_owner_id: true },
      });

      if (groupData?.pending_owner_id !== null && groupData?.pending_owner_id !== undefined) {
        throw new BadRequestException(
          'No puedes abandonar el grupo mientras hay una transferencia de administración pendiente de respuesta.',
        );
      }

      throw new BadRequestException(
        'El owner no puede abandonar el grupo. Designa a otro admin primero.',
      );
    }

    await this.prisma.membership.delete({
      where: { id_user_id_group: { id_user: userId, id_group: groupId } },
    });

    // Emitir evento USER_LEFT_GROUP después de delete membership exitoso
    this.eventEmitter.emit(MESSAGE_EVENTS.USER_LEFT_GROUP, {
      id_user: userId,
      user_name: membership.user?.full_name || 'Usuario',
      id_group: groupId,
      group_name: membership.group?.name || 'Grupo',
      left_at: new Date(),
    });
  }

  async removeMember(groupId: number, memberId: number, userId: number) {
    // Verificar que quien ejecuta es el owner o un admin
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group || group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para sacar miembros');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { id_user_id_group: { id_user: memberId, id_group: groupId } },
    });

    if (!membership) {
      throw new NotFoundException('El usuario no es miembro de este grupo');
    }

    return await this.prisma.membership.delete({
      where: { id_user_id_group: { id_user: memberId, id_group: groupId } },
    });
  }

  async makeAdmin(groupId: number, memberId: number, userId: number) {
    // Obtener información del usuario que ejecuta la acción
    const requester = await this.prisma.user.findUnique({
      where: { id_user: userId },
      include: { role: true },
    });

    if (!requester) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que el grupo existe
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Superadmin tiene bypass total
    const isSuperAdmin = requester.role.name === 'superadmin';
    const isGroupOwner = group.owner_id === userId;

    // Solo el owner del grupo o un superadmin pueden dar roles de admin
    if (!isSuperAdmin && !isGroupOwner) {
      throw new ForbiddenException(
        'No tienes permiso para dar roles de admin. Solo el creador del grupo o un superadmin pueden asignar administradores.',
      );
    }

    const membership = await this.prisma.membership.findUnique({
      where: { id_user_id_group: { id_user: memberId, id_group: groupId } },
    });

    if (!membership) {
      throw new NotFoundException('El usuario no es miembro de este grupo');
    }

    return await this.prisma.membership.update({
      where: { id_user_id_group: { id_user: memberId, id_group: groupId } },
      data: { is_admin: true },
      include: {
        user: {
          select: { id_user: true, full_name: true, picture: true },
        },
      },
    });
  }

  async transferOwnership(groupId: number, newOwnerId: number, currentUserId: number) {
    // Verificar que el grupo existe y no es un chat privado
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { 
        id_group: true, 
        owner_id: true, 
        is_direct_message: true,
        name: true 
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    if (group.is_direct_message) {
      throw new BadRequestException('No puedes transferir propiedad de un chat privado');
    }

    // Verificar que el usuario actual es el owner
    if (group.owner_id !== currentUserId) {
      throw new ForbiddenException('Solo el propietario actual puede transferir la propiedad del grupo');
    }

    // Verificar que el nuevo owner es miembro del grupo
    const newOwnerMembership = await this.prisma.membership.findUnique({
      where: { id_user_id_group: { id_user: newOwnerId, id_group: groupId } },
    });

    if (!newOwnerMembership) {
      throw new BadRequestException('El nuevo propietario debe ser miembro del grupo');
    }

    // Verificar que el nuevo owner existe
    const newOwner = await this.prisma.user.findUnique({
      where: { id_user: newOwnerId },
      select: { id_user: true, full_name: true, email: true },
    });

    if (!newOwner) {
      throw new NotFoundException('El usuario especificado no existe');
    }

    // No permitir transferir a uno mismo
    if (newOwnerId === currentUserId) {
      throw new BadRequestException('Ya eres el propietario del grupo');
    }

    // Notificar al nuevo owner ANTES de la transferencia (ADMIN_TRANSFER_REQUESTED)
    this.studyGroupSubject.notify({
      type: 'ADMIN_TRANSFER_REQUESTED',
      payload: {
        id_group: groupId,
        group_name: group.name ?? 'Grupo',
        previous_owner_id: currentUserId,
        new_owner_id: newOwnerId,
        new_owner_name: newOwner.full_name,
      },
      targetUserId: newOwnerId,
      timestamp: new Date(),
    });

    // Realizar la transferencia en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Actualizar el owner del grupo
      const updatedGroup = await tx.group.update({
        where: { id_group: groupId },
        data: { owner_id: newOwnerId },
        include: {
          owner: {
            select: { id_user: true, full_name: true, email: true, picture: true },
          },
        },
      });

      // 2. Asegurar que el nuevo owner tenga permisos de admin
      await tx.membership.update({
        where: { id_user_id_group: { id_user: newOwnerId, id_group: groupId } },
        data: { is_admin: true },
      });

      // 3. El antiguo owner queda como miembro regular (no admin)
      // ya que va a salir del grupo inmediatamente después
      await tx.membership.update({
        where: { id_user_id_group: { id_user: currentUserId, id_group: groupId } },
        data: { is_admin: false },
      });

      return {
        message: 'Propiedad del grupo transferida exitosamente',
        group: updatedGroup,
        previous_owner_id: currentUserId,
        new_owner_id: newOwnerId,
      };
    });

    // Notificar al antiguo owner DESPUÉS de la transferencia exitosa (ADMIN_TRANSFER_ACCEPTED)
    this.studyGroupSubject.notify({
      type: 'ADMIN_TRANSFER_ACCEPTED',
      payload: {
        id_group: groupId,
        group_name: group.name ?? 'Grupo',
        previous_owner_id: currentUserId,
        new_owner_id: newOwnerId,
        new_owner_name: newOwner.full_name,
      },
      targetUserId: currentUserId,
      timestamp: new Date(),
    });

    return result;
  }

  // =====================================================
  // TRANSFERENCIA DE ADMINISTRACIÓN CON CONFIRMACIÓN (US-W02)
  // =====================================================

  /**
   * POST /groups/:id/request-ownership-transfer/:candidateId
   * El owner solicita transferir la propiedad a un candidato.
   * Guarda el candidato en pending_owner_id y notifica al candidato.
   */
  async requestOwnershipTransfer(groupId: number, candidateId: number, currentUserId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { id_group: true, owner_id: true, is_direct_message: true, name: true, pending_owner_id: true },
    });

    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (group.is_direct_message) throw new BadRequestException('No puedes transferir propiedad de un chat privado');
    if (group.owner_id !== currentUserId) throw new ForbiddenException('Solo el propietario puede iniciar una transferencia');
    if (candidateId === currentUserId) throw new BadRequestException('No puedes transferirte la propiedad a ti mismo');
    if (group.pending_owner_id !== null) throw new ConflictException('Ya existe una solicitud de transferencia en curso para este grupo. Cancélala antes de iniciar una nueva.');

    // Verificar que el candidato es miembro del grupo
    const candidateMembership = await this.prisma.membership.findUnique({
      where: { id_user_id_group: { id_user: candidateId, id_group: groupId } },
    });
    if (!candidateMembership) throw new BadRequestException('El candidato debe ser miembro del grupo');

    const candidate = await this.prisma.user.findUnique({
      where: { id_user: candidateId },
      select: { id_user: true, full_name: true, email: true },
    });
    if (!candidate) throw new NotFoundException('El candidato no existe');

    const updatedGroup = await this.prisma.group.update({
      where: { id_group: groupId },
      data: { pending_owner_id: candidateId },
      select: { id_group: true, name: true, owner_id: true, pending_owner_id: true },
    });

    // Notificar al candidato vía studyGroupSubject (dispara persistencia en DB + push Expo)
    this.studyGroupSubject.notify({
      type: 'ADMIN_TRANSFER_REQUESTED',
      payload: {
        id_group: groupId,
        group_name: group.name ?? 'Grupo',
        current_owner_id: currentUserId,
        candidate_id: candidateId,
        candidate_name: candidate.full_name,
      },
      targetUserId: candidateId,
      timestamp: new Date(),
    });

    // Mantener el emit del eventEmitter para compatibilidad con otros listeners futuros
    this.eventEmitter.emit('group.ownership_transfer_requested', {
      id_group: groupId,
      group_name: group.name ?? 'Grupo',
      current_owner_id: currentUserId,
      candidate_id: candidateId,
      candidate_name: candidate.full_name,
    });

    return {
      message: `Solicitud de transferencia enviada a ${candidate.full_name}. Esperando confirmación.`,
      group: updatedGroup,
      candidate,
    };
  }

  /**
   * PATCH /groups/:id/accept-ownership-transfer
   * El candidato (pending_owner_id) acepta la transferencia.
   * Ejecuta el cambio de owner y limpia pending_owner_id.
   */
  async acceptOwnershipTransfer(groupId: number, currentUserId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { id_group: true, owner_id: true, pending_owner_id: true, name: true, is_direct_message: true },
    });

    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (group.is_direct_message) throw new BadRequestException('Operación no válida para chats privados');
    if (group.pending_owner_id === null) throw new BadRequestException('No hay ninguna transferencia pendiente para este grupo');
    if (group.pending_owner_id !== currentUserId) throw new ForbiddenException('No eres el candidato designado para recibir la propiedad de este grupo');

    const previousOwnerId = group.owner_id!;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Transferir ownership y limpiar pending_owner_id
      const updatedGroup = await tx.group.update({
        where: { id_group: groupId },
        data: { owner_id: currentUserId, pending_owner_id: null },
        include: {
          owner: { select: { id_user: true, full_name: true, email: true, picture: true } },
        },
      });

      // 2. Nuevo owner → is_admin: true
      await tx.membership.update({
        where: { id_user_id_group: { id_user: currentUserId, id_group: groupId } },
        data: { is_admin: true },
      });

      // 3. Sacar al antiguo owner del grupo (quería abandonar, por eso inició la transferencia)
      await tx.membership.delete({
        where: { id_user_id_group: { id_user: previousOwnerId, id_group: groupId } },
      });

      this.eventEmitter.emit('group.ownership_transfer_accepted', {
        id_group: groupId,
        group_name: group.name ?? 'Grupo',
        previous_owner_id: previousOwnerId,
        new_owner_id: currentUserId,
      });

      return {
        message: 'Has aceptado la propiedad del grupo exitosamente.',
        group: updatedGroup,
        previous_owner_id: previousOwnerId,
        new_owner_id: currentUserId,
      };
    });
  }

  /**
   * DELETE /groups/:id/cancel-ownership-transfer
   * El owner actual cancela la solicitud de transferencia pendiente.
   */
  async cancelOwnershipTransfer(groupId: number, currentUserId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { id_group: true, owner_id: true, pending_owner_id: true, name: true },
    });

    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (group.owner_id !== currentUserId) throw new ForbiddenException('Solo el propietario puede cancelar la transferencia');
    if (group.pending_owner_id === null) throw new BadRequestException('No hay ninguna transferencia pendiente para cancelar');

    const cancelledCandidateId = group.pending_owner_id;

    await this.prisma.group.update({
      where: { id_group: groupId },
      data: { pending_owner_id: null },
    });

    this.eventEmitter.emit('group.ownership_transfer_cancelled', {
      id_group: groupId,
      group_name: group.name ?? 'Grupo',
      owner_id: currentUserId,
      cancelled_candidate_id: cancelledCandidateId,
    });

    return { message: 'Solicitud de transferencia cancelada.' };
  }

  /**
   * El candidato declina la transferencia de ownership.
   * DELETE /groups/:id/decline-ownership-transfer
   * Solo el candidato (pending_owner_id) puede llamar este endpoint.
   */
  async declineOwnershipTransfer(groupId: number, currentUserId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { id_group: true, owner_id: true, pending_owner_id: true, name: true },
    });

    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (group.pending_owner_id === null) throw new BadRequestException('No hay ninguna transferencia pendiente');
    if (group.pending_owner_id !== currentUserId) throw new ForbiddenException('Solo el candidato designado puede declinar la transferencia');

    await this.prisma.group.update({
      where: { id_group: groupId },
      data: { pending_owner_id: null },
    });

    this.eventEmitter.emit('group.ownership_transfer_declined', {
      id_group: groupId,
      group_name: group.name ?? 'Grupo',
      owner_id: group.owner_id,
      declined_by: currentUserId,
    });

    return { message: 'Transferencia declinada.' };
  }

  async inviteUser(groupId: number, inviteeId: number, userId: number) {
    // Verificar que quien ejecuta es el owner
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group || group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para invitar usuarios');
    }

    // Verificar que tiene conexión aceptada con el usuario
    const connection = await this.prisma.connection.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: userId, adressee_id: inviteeId },
          { requester_id: inviteeId, adressee_id: userId },
        ],
      },
    });

    if (!connection) {
      throw new BadRequestException(
        'Solo puedes invitar a usuarios con los que tengas conexión aceptada',
      );
    }

    // Verificar que no es ya miembro
    const existingMembership = await this.prisma.membership.findUnique({
      where: { id_user_id_group: { id_user: inviteeId, id_group: groupId } },
    });

    if (existingMembership) {
      throw new BadRequestException('El usuario ya es miembro de este grupo');
    }

    // Verificar que no existe invitación pendiente
    const existingInvitation = await this.prisma.group_invitation.findUnique({
      where: { id_group_invitee_id: { id_group: groupId, invitee_id: inviteeId } },
    });

    if (existingInvitation && existingInvitation.status === 'pending') {
      throw new BadRequestException(
        'Ya existe una invitación pendiente para este usuario',
      );
    }

    return await this.prisma.group_invitation.upsert({
      where: { id_group_invitee_id: { id_group: groupId, invitee_id: inviteeId } },
      create: {
        id_group: groupId,
        inviter_id: userId,
        invitee_id: inviteeId,
        status: 'pending',
      },
      update: {
        status: 'pending',
        invited_at: new Date(),
        responded_at: null,
      },
      include: {
        group: { select: { id_group: true, name: true } },
        invitee: {
          select: { id_user: true, full_name: true, picture: true },
        },
      },
    });
  }

  async getGroupInfo(groupId: number, userId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      include: {
        course: { select: { name: true, id_course: true } },
        owner: { select: { id_user: true, full_name: true } },
        memberships: {
          include: {
            user: {
              select: {
                id_user: true,
                full_name: true,
                picture: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Determinar rol del usuario actual
    const userMembership = group.memberships.find((m) => m.id_user === userId);
    const isOwner = group.owner_id === userId;
    const isMember = !!userMembership;
    const isAdmin = userMembership?.is_admin || false;

    // Verificar si el usuario tiene una solicitud pendiente
    const pendingRequest = !isMember ? await this.prisma.group_join_request.findFirst({
      where: { id_group: groupId, requester_id: userId, status: 'pending' },
      select: { id_request: true },
    }) : null;

    // Verificar si el usuario tiene una invitación activa (exclusión mutua con join request)
    const activeInvitation = !isMember ? await this.prisma.group_invitation.findFirst({
      where: { id_group: groupId, invitee_id: userId, status: 'pending' },
      select: { id_invitation: true },
    }) : null;

    return {
      ...group,
      userRole: isOwner ? 'owner' : isAdmin ? 'admin' : isMember ? 'member' : 'none',
      isMember,
      isOwner,
      isAdmin,
      canManage: isOwner || isAdmin,
      canInvite: isOwner,
      canManageMembers: isOwner,
      hasPendingRequest: !!pendingRequest,
      hasActiveInvitation: !!activeInvitation,
    };
  }

  /**
   * Obtener detalle de cualquier grupo (incluyendo chats privados)
   * Para uso interno cuando se necesita acceder a chats privados
   */
  async findAnyGroup(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: id },
      include: {
        course: true,
        owner: {
          select: { full_name: true, email: true }
        },
        memberships: {
          include: { 
            user: { 
              select: { 
                id_user: true,
                full_name: true, 
                picture: true,
                email: true,
              } 
            } 
          }
        }
      }
    });

    if (!group) {
      throw new NotFoundException(`Grupo con ID ${id} no encontrado`);
    }

    return group;
  }
}