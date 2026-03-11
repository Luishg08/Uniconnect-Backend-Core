import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Repository para operaciones de base de datos relacionadas con grupos
 * Patrón Repository: Separa la lógica de acceso a datos
 */
@Injectable()
export class GroupRepository {
  constructor(private prisma: PrismaService) {}

  private readonly defaultInclude = {
    course: {
      select: {
        name: true,
        program: { select: { name: true } },
      },
    },
    owner: {
      select: {
        id_user: true,
        full_name: true,
        picture: true,
        email: true,
      },
    },
    _count: {
      select: { memberships: true },
    },
  } as const;

  /**
   * Crear un grupo
   */
  async create(data: Prisma.groupCreateInput) {
    return this.prisma.group.create({
      data,
      include: this.defaultInclude,
    });
  }

  /**
   * Buscar grupo por ID
   */
  async findById(id: number) {
    return this.prisma.group.findUnique({
      where: { id_group: id },
      include: {
        ...this.defaultInclude,
        memberships: {
          include: {
            user: {
              select: {
                id_user: true,
                full_name: true,
                picture: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Contar grupos creados por usuario en un curso específico
   */
  async countByUserAndCourse(userId: number, courseId: number): Promise<number> {
    return this.prisma.group.count({
      where: {
        owner_id: userId,
        id_course: courseId,
      },
    });
  }

  /**
   * Buscar grupos creados por un usuario
   */
  async findCreatedByUser(userId: number) {
    return this.prisma.group.findMany({
      where: { owner_id: userId },
      include: this.defaultInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Buscar grupos donde el usuario es miembro
   */
  async findMemberOf(userId: number) {
    return this.prisma.group.findMany({
      where: {
        memberships: {
          some: { id_user: userId },
        },
      },
      include: this.defaultInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Descubrir grupos disponibles según cursos inscritos del usuario
   */
  async findAvailableForUser(userId: number) {
    // Obtener IDs de cursos en los que el usuario está inscrito
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        id_user: userId,
        status: 'active',
      },
      select: { id_course: true },
    });

    const courseIds = enrollments.map((e) => e.id_course).filter((id) => id !== null);

    // Buscar grupos de esos cursos donde NO es miembro
    return this.prisma.group.findMany({
      where: {
        id_course: { in: courseIds },
        memberships: {
          none: { id_user: userId },
        },
      },
      include: this.defaultInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Buscar grupos por curso
   */
  async findByCourse(courseId: number) {
    return this.prisma.group.findMany({
      where: { id_course: courseId },
      include: this.defaultInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Actualizar grupo
   */
  async update(id: number, data: Prisma.groupUpdateInput) {
    return this.prisma.group.update({
      where: { id_group: id },
      data,
      include: this.defaultInclude,
    });
  }

  /**
   * Eliminar grupo
   */
  async delete(id: number) {
    return this.prisma.group.delete({
      where: { id_group: id },
    });
  }

  /**
   * Verificar si usuario es owner del grupo
   */
  async isOwner(groupId: number, userId: number): Promise<boolean> {
    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });
    return group?.owner_id === userId;
  }

  /**
   * Verificar si usuario es admin del grupo
   */
  async isAdmin(groupId: number, userId: number): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id_user: userId,
        id_group: groupId,
        is_admin: true,
      },
    });
    return !!membership;
  }

  /**
   * Verificar si usuario es miembro del grupo
   */
  async isMember(groupId: number, userId: number): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id_user: userId,
        id_group: groupId,
      },
    });
    return !!membership;
  }
}
