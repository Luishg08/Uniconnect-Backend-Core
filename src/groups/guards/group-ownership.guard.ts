import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard que valida que el usuario sea el owner del grupo.
 * IMPORTANTE: No incluye bypass de superadmin para mantener integridad de datos.
 * Solo el owner real puede realizar operaciones de ownership.
 */
@Injectable()
export class GroupOwnershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub || request.user?.id_user;
    const groupId = parseInt(request.params.id || request.params.groupId);

    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    if (!groupId || isNaN(groupId)) {
      throw new BadRequestException('ID de grupo inválido.');
    }

    const group = await this.prisma.group.findUnique({
      where: { id_group: groupId },
      select: { owner_id: true },
    });

    if (!group) {
      throw new BadRequestException('Grupo no encontrado.');
    }

    // Validación estricta: solo el owner puede realizar esta acción
    if (group.owner_id !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción. Solo el propietario del grupo puede hacerlo.',
      );
    }

    return true;
  }
}
