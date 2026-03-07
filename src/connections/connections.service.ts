import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConnectionsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) { }

  // Enviar solicitud de conexión
  async sendConnectionRequest(requesterId: number, adresseeId: number) {
    if (requesterId === adresseeId) {
      throw new BadRequestException('No puedes enviarte solicitud a ti mismo');
    }

    const existing = await this.prisma.connection.findFirst({
      where: {
        requester_id: requesterId,
        adressee_id: adresseeId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya existe una conexión o solicitud pendiente',
      );
    }

    const connection = await this.prisma.connection.create({
      data: {
        requester_id: requesterId,
        adressee_id: adresseeId,
        status: 'pending',
      },
      include: {
        requester: true,
        adressee: true,
      },
    });

    await this.notificationsService.notifyConnectionRequest({
      toUserId: connection.adressee_id,
      fromUserName: connection.requester.full_name,
      connectionId: connection.id_connection,
    });

    return connection;
  }

  // Aceptar solicitud
  async acceptConnection(connectionId: number, userId: number) {
    const connection = await this.prisma.connection.findUnique({
      where: { id_connection: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Conexión no encontrada');
    }

    if (connection.adressee_id !== userId) {
      throw new BadRequestException(
        'No tienes permiso para aceptar esta conexión',
      );
    }

    const updated = await this.prisma.connection.update({
      where: { id_connection: connectionId },
      data: { status: 'accepted' },
      include: {
        requester: true,
        adressee: true,
      },
    });

    await this.notificationsService.notifyConnectionAccepted({
      toUserId: updated.requester_id,
      fromUserName: updated.adressee.full_name,
      connectionId: updated.id_connection,
    });

    return updated;
  }

  // Rechazar solicitud
  async rejectConnection(connectionId: number, userId: number) {
    const connection = await this.prisma.connection.findUnique({
      where: { id_connection: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Conexión no encontrada');
    }

    if (connection.adressee_id !== userId) {
      throw new BadRequestException(
        'No tienes permiso para rechazar esta conexión',
      );
    }

    const updated = await this.prisma.connection.update({
      where: { id_connection: connectionId },
      data: { status: 'rejected' },
      include: {
        requester: true,
        adressee: true,
      },
    });

    await this.notificationsService.notifyConnectionRejected({
      toUserId: updated.requester_id,
      fromUserName: updated.adressee.full_name,
      connectionId: updated.id_connection,
    });

    return updated;
  }

  // Obtener conexiones aceptadas
  async getMyConnections(userId: number) {
    return this.prisma.connection.findMany({
      where: {
        OR: [
          { requester_id: userId },
          { adressee_id: userId },
        ],
        status: 'accepted',
      },
      include: {
        requester: true,
        adressee: true,
      },
    });
  }

  // Obtener solicitudes pendientes
  async getPendingRequests(userId: number) {
    return this.prisma.connection.findMany({
      where: {
        adressee_id: userId,
        status: 'pending',
      },
      include: {
        requester: true,
      },
    });
  }

  async deleteConnection(connectionId: number, userId: number) {
    const connection = await this.prisma.connection.findUnique({
      where: { id_connection: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Conexión no encontrada');
    }

    // Solo requester o adressee pueden eliminar
    if (connection.requester_id !== userId && connection.adressee_id !== userId) {
      throw new BadRequestException('No tienes permiso para eliminar esta conexión');
    }

    await this.prisma.connection.delete({
      where: { id_connection: connectionId },
    });

    return { message: 'Conexión eliminada correctamente' };
  }
}