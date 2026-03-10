import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard que valida que el usuario sea admin del grupo
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub || request.user?.id_user;
    const groupId =
      parseInt(request.params.id || request.params.groupId) ||
      parseInt(request.body?.id_group);

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    if (!groupId || isNaN(groupId)) {
      throw new BadRequestException('ID de grupo inválido.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        id_user: userId,
        id_group: groupId,
        is_admin: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción. Solo los administradores del grupo pueden hacerlo.',
      );
    }

    return true;
  }
}
