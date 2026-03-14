import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard para validar que solo usuarios con rol "admin" o "superadmin"
 * puedan crear grupos de estudio.
 */
@Injectable()
export class CanCreateGroupGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId || request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id_user: userId },
      include: { role: true },
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    // Superadmin tiene bypass total
    if (user.role.name === 'superadmin') {
      return true;
    }

    // Validar que sea admin
    if (user.role.name === 'admin') {
      return true;
    }

    // Rol "student" no puede crear grupos
    throw new ForbiddenException(
      'No tienes permisos para crear grupos. Solo usuarios con rol "admin" o "superadmin" pueden crear grupos de estudio.',
    );
  }
}
