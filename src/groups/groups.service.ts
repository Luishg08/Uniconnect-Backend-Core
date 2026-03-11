import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  // 3. Obtener detalle de un grupo
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
   */
  async findGroupsCreatedByUser(userId: number) {
    return this.prisma.group.findMany({
      where: {
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
   */
  async findGroupsMemberOf(userId: number) {
    return this.prisma.group.findMany({
      where: {
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
   */
  async findGroupsByCourse(courseId: number, userId?: number) {
    return this.prisma.group.findMany({
      where: {
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
}