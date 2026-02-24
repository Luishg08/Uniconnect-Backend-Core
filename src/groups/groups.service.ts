import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  // 1. Crear grupo con membresía automática
  async create(createGroupDto: CreateGroupDto) {
    const course = await this.prisma.course.findUnique({
      where: { id_course: createGroupDto.id_course },
    });

    if (!course) {
      throw new NotFoundException(`El curso con ID ${createGroupDto.id_course} no existe.`);
    }

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
}