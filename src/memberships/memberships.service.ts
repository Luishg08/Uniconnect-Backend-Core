import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear una nueva membresía (agregar un usuario a un grupo)
   */
  async create(createMembershipDto: CreateMembershipDto) {
    return this.prisma.membership.create({
      data: {
        id_user: createMembershipDto.id_user,
        id_group: createMembershipDto.id_group,
        is_admin: createMembershipDto.is_admin || false,
        joined_at: createMembershipDto.joined_at || new Date(),
      },
      include: {
        user: true,
        group: true,
      },
    });
  }

  /**
   * Obtener todas las membresías
   */
  async findAll() {
    return this.prisma.membership.findMany({
      include: {
        user: true,
        group: true,
        messages: true,
      },
    });
  }

  /**
   * Obtener una membresía por su ID
   */
  async findOne(id: number) {
    return this.prisma.membership.findUnique({
      where: { id_membership: id },
      include: {
        user: true,
        group: true,
        messages: true,
      },
    });
  }

  /**
   * Obtener todas las membresías de un usuario
   */
  async findByUser(id_user: number) {
    return this.prisma.membership.findMany({
      where: { id_user },
      include: {
        group: true,
        user: true,
      },
    });
  }

  /**
   * Obtener todas las membresías de un grupo
   */
  async findByGroup(id_group: number) {
    return this.prisma.membership.findMany({
      where: { id_group },
      include: {
        user: true,
      },
    });
  }

  /**
   * Actualizar una membresía
   */
  async update(id: number, updateMembershipDto: UpdateMembershipDto) {
    return this.prisma.membership.update({
      where: { id_membership: id },
      data: updateMembershipDto,
      include: {
        user: true,
        group: true,
      },
    });
  }

  /**
   * Eliminar una membresía
   */
  async remove(id: number) {
    return this.prisma.membership.delete({
      where: { id_membership: id },
    });
  }

  /**
   * Promover/degradar un usuario a admin en un grupo
   */
  async toggleAdmin(id: number, is_admin: boolean) {
    return this.prisma.membership.update({
      where: { id_membership: id },
      data: { is_admin },
      include: {
        user: true,
        group: true,
      },
    });
  }
}
