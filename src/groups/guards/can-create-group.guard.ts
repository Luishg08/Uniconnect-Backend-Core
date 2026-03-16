import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard para validar que usuarios autenticados puedan crear grupos de estudio.
 * Las validaciones de negocio (inscripción, límites) se manejan en el servicio.
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

    // Superadmin mantiene bypass total para propósitos administrativos
    if (user.role.name === 'superadmin') {
      return true;
    }

    // Todos los usuarios autenticados pueden crear grupos
    // Las validaciones de inscripción y límites se manejan en el servicio
    return true;
  }
}
