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
}