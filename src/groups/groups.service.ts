import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupBusinessValidator } from './validators/group-business.validator';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private groupValidator: GroupBusinessValidator,
  ) { }

  // 1. Crear grupo con validaciones y membresía automática
  async create(createGroupDto: CreateGroupDto) {
    // Validar que el curso existe
    const course = await this.prisma.course.findUnique({
      where: { id_course: createGroupDto.id_course },
    });

    if (!course) {
      throw new NotFoundException(`El curso con ID ${createGroupDto.id_course} no existe.`);
    }

    // Validar que el usuario está inscrito en el curso
    await this.groupValidator.validateCourseEnrollment(
      createGroupDto.owner_id,
      createGroupDto.id_course,
    );

    // Validar límite de 3 grupos por materia
    await this.groupValidator.validateMaxGroupsPerCourse(
      createGroupDto.owner_id,
      createGroupDto.id_course,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            name: createGroupDto.name,
            description: createGroupDto.description,
            id_course: createGroupDto.id_course,
            owner_id: createGroupDto.owner_id,
          },
        });

        await tx.membership.create({
          data: {
            id_user: createGroupDto.owner_id,
            id_group: group.id_group,
            is_admin: true,
            joined_at: new Date(),
          },
        });

        return group;
      });
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
      // Si se borra el grupo, 
      // se deberían borrar las membresías en cascada si así está en el DB.
      return await this.prisma.group.delete({
        where: { id_group },
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
    return this.prisma.group.update({
      where: { id_group: id },
      data: updateGroupDto,
    });
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
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al crear el chat privado: ' + error.message,
      );
    }
  }

  // =====================================================
  // GESTIÓN DE PARTICIPANTES - SOLICITUDES DE ACCESO
  // =====================================================

  async requestGroupAccess(userId: number, groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { id_group: true, is_direct_message: true, owner_id: true },
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

    // Verificar que no existe solicitud pendiente
    const existingRequest = await this.prisma.group_join_request.findUnique({
      where: { id_group_requester_id: { id_group: groupId, requester_id: userId } },
    });

    if (existingRequest && existingRequest.status === 'pending') {
      throw new BadRequestException('Ya tienes una solicitud pendiente para este grupo');
    }

    // Crear o actualizar solicitud
    return await this.prisma.group_join_request.upsert({
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
    return await this.prisma.$transaction(async (tx) => {
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
        },
      });
    });
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

    return await this.prisma.group_join_request.update({
      where: { id_request: requestId },
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
      include: { group: { select: { owner_id: true } } },
    });

    if (!membership) {
      throw new NotFoundException('No eres miembro de este grupo');
    }

    // No permitir que el owner abandone así
    if (membership.group?.owner_id === userId) {
      throw new BadRequestException(
        'El owner no puede abandonar el grupo. Designa a otro admin primero.',
      );
    }

    return await this.prisma.membership.delete({
      where: { id_user_id_group: { id_user: userId, id_group: groupId } },
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
    // Verificar que quien ejecuta es el owner
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group || group.owner_id !== userId) {
      throw new ForbiddenException('No tienes permiso para dar roles de admin');
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

    return {
      ...group,
      userRole: isOwner ? 'owner' : isAdmin ? 'admin' : isMember ? 'member' : 'none',
      isMember,
      isOwner,
      isAdmin,
      canManage: isOwner || isAdmin,
      canInvite: isOwner,
      canManageMembers: isOwner,
    };
  }
}