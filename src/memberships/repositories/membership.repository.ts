import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Repository para operaciones de base de datos relacionadas con memberships
 * Patrón Repository: Separa la lógica de acceso a datos
 */
@Injectable()
export class MembershipRepository {
  constructor(private prisma: PrismaService) {}

  private readonly defaultInclude = {
    user: {
      select: {
        id_user: true,
        full_name: true,
        picture: true,
        email: true,
      },
    },
    group: {
      select: {
        id_group: true,
        name: true,
        description: true,
        course: { select: { name: true } },
      },
    },
  } as const;

  /**
   * Crear una membership
   */
  async create(data: Prisma.membershipCreateInput) {
    return this.prisma.membership.create({
      data,
      include: this.defaultInclude,
    });
  }

  /**
   * Buscar membership por ID
   */
  async findById(id: number) {
    return this.prisma.membership.findUnique({
      where: { id_membership: id },
      include: this.defaultInclude,
    });
  }

  /**
   * Buscar membership específica de un usuario en un grupo
   */
  async findByUserAndGroup(userId: number, groupId: number) {
    return this.prisma.membership.findFirst({
      where: {
        id_user: userId,
        id_group: groupId,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Buscar todas las memberships de un usuario
   */
  async findByUser(userId: number) {
    return this.prisma.membership.findMany({
      where: { id_user: userId },
      include: this.defaultInclude,
      orderBy: { joined_at: 'desc' },
    });
  }

  /**
   * Buscar todas las memberships de un grupo
   */
  async findByGroup(groupId: number) {
    return this.prisma.membership.findMany({
      where: { id_group: groupId },
      include: this.defaultInclude,
      orderBy: { joined_at: 'asc' },
    });
  }

  /**
   * Buscar admins de un grupo
   */
  async findAdminsByGroup(groupId: number) {
    return this.prisma.membership.findMany({
      where: {
        id_group: groupId,
        is_admin: true,
      },
      include: {
        user: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
          },
        },
      },
    });
  }

  /**
   * Actualizar membership
   */
  async update(id: number, data: Prisma.membershipUpdateInput) {
    return this.prisma.membership.update({
      where: { id_membership: id },
      data,
      include: this.defaultInclude,
    });
  }

  /**
   * Cambiar estado de admin
   */
  async toggleAdmin(id: number, isAdmin: boolean) {
    return this.update(id, { is_admin: isAdmin });
  }

  /**
   * Eliminar membership
   */
  async delete(id: number) {
    return this.prisma.membership.delete({
      where: { id_membership: id },
    });
  }

  /**
   * Eliminar membership por usuario y grupo
   */
  async deleteByUserAndGroup(userId: number, groupId: number) {
    const membership = await this.findByUserAndGroup(userId, groupId);
    if (membership) {
      return this.delete(membership.id_membership);
    }
    return null;
  }

  /**
   * Contar miembros de un grupo
   */
  async countByGroup(groupId: number): Promise<number> {
    return this.prisma.membership.count({
      where: { id_group: groupId },
    });
  }

  /**
   * Verificar si existe membership
   */
  async exists(userId: number, groupId: number): Promise<boolean> {
    const membership = await this.findByUserAndGroup(userId, groupId);
    return !!membership;
  }

  /**
   * Verificar si usuario es admin del grupo
   */
  async isAdmin(userId: number, groupId: number): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id_user: userId,
        id_group: groupId,
        is_admin: true,
      },
    });
    return !!membership;
  }
}
