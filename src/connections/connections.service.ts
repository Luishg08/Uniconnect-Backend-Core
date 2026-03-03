import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ConnectionsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) { }

  async getPendingRequests(userId: number) {
    const requests = await this.prisma.connection.findMany({
      where: {
        adressee_id: userId,
        status: 'pending',
      },
      include: {
        requester: {
          select: {
            id_user: true,
            full_name: true,
            email: true,
            picture: true,
            program: true,
          },
        },
      },
      orderBy: {
        request_at: 'desc',
      },
    });

    return requests.map((req) => ({
      id_connection: req.id_connection,
      requester: req.requester,
      request_at: req.request_at,
      status: req.status,
    }));
  }

  async sendConnectionRequest(requesterId: number, adresseeId: number) {
    if (requesterId === adresseeId) {
      throw new BadRequestException('No puedes enviarte una solicitud a ti mismo');
    }

    const existingConnection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { requester_id: requesterId, adressee_id: adresseeId },
          { requester_id: adresseeId, adressee_id: requesterId },
        ],
      },
    });

    if (existingConnection) {
      throw new BadRequestException('Ya existe una conexión o solicitud pendiente');
    }

    const connection = await this.prisma.connection.create({
      data: {
        requester_id: requesterId,
        adressee_id: adresseeId,
        status: 'pending',
        request_at: new Date(),
      },
      include: {
        requester: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
          },
        },
      },
    });

    // Notificar al destinatario — no bloqueamos la respuesta si falla
    this.notificationsService
      .notifyConnectionRequest({
        toUserId: adresseeId,
        fromUserName: connection.requester.full_name,
        connectionId: connection.id_connection,
      })
      .catch(() => {/* silent */ });

    return {
      id_connection: connection.id_connection,
      message: 'Solicitud de conexión enviada',
    };
  }

  async acceptConnectionRequest(connectionId: number, userId: number) {
    const connection = await this.prisma.connection.findUnique({
      where: { id_connection: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (connection.adressee_id !== userId) {
      throw new BadRequestException('No tienes permiso para aceptar esta solicitud');
    }

    if (connection.status !== 'pending') {
      throw new BadRequestException('Esta solicitud ya fue respondida');
    }

    const updatedConnection = await this.prisma.connection.update({
      where: { id_connection: connectionId },
      data: {
        status: 'accepted',
        respondend_at: new Date(),
      },
    });

    return {
      message: 'Solicitud aceptada',
      connection: updatedConnection,
    };
  }

  async rejectConnectionRequest(connectionId: number, userId: number) {
    const connection = await this.prisma.connection.findUnique({
      where: { id_connection: connectionId },
    });

    if (!connection) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (connection.adressee_id !== userId) {
      throw new BadRequestException('No tienes permiso para rechazar esta solicitud');
    }

    if (connection.status !== 'pending') {
      throw new BadRequestException('Esta solicitud ya fue respondida');
    }

    const updatedConnection = await this.prisma.connection.update({
      where: { id_connection: connectionId },
      data: {
        status: 'rejected',
        respondend_at: new Date(),
      },
    });

    return {
      message: 'Solicitud rechazada',
      connection: updatedConnection,
    };
  }
}