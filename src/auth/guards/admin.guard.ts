import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresAdmin = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Obtener el usuario con su rol
    const user = await this.prisma.user.findUnique({
      where: { id_user: userId },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    // Verificar si el rol es "Administrador" o similar
    // Ajusta el nombre del rol según tu base de datos
    const isAdmin = user.role.name?.toLowerCase().includes('admin');

    if (!isAdmin) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción. Solo administradores pueden gestionar eventos.',
      );
    }

    return true;
  }
}
