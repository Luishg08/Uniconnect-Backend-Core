import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MESSAGE_EVENTS } from '../messages/events/message.events';
import type { ConnectionRequestSentPayload } from '../messages/events/message.events';

@Injectable()
export class ConnectionsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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
      if (existingConnection.status === 'rejected') {
        // Permitir reenvío: actualizar la conexión rechazada a pendiente
        const updated = await this.prisma.connection.update({
          where: { id_connection: existingConnection.id_connection },
          data: {
            requester_id: requesterId,
            adressee_id: adresseeId,
            status: 'pending',
            request_at: new Date(),
            respondend_at: null,
          },
          include: {
            requester: {
              select: { id_user: true, full_name: true, picture: true },
            },
          },
        });

        // Emitir evento para crear notificación (solicitud reenviada = nuevo evento)
        const payload: ConnectionRequestSentPayload = {
          id_connection: updated.id_connection,
          requester_id: requesterId,
          requester_name: updated.requester?.full_name || '',
          requester_picture: updated.requester?.picture ?? undefined,
          addressee_id: adresseeId,
          sent_at: new Date(),
        };
        console.log('🔔 [ConnectionsService] EMITTING CONNECTION_REQUEST_SENT (RESEND):', {
          event: MESSAGE_EVENTS.CONNECTION_REQUEST_SENT,
          payload,
          timestamp: new Date().toISOString(),
        });
        this.eventEmitter.emit(MESSAGE_EVENTS.CONNECTION_REQUEST_SENT, payload);

        return {
          id_connection: updated.id_connection,
          message: 'Solicitud de conexión reenviada',
        };
      }
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

    // Emitir evento para crear notificación automática
    const payload: ConnectionRequestSentPayload = {
      id_connection: connection.id_connection,
      requester_id: requesterId,
      requester_name: connection.requester?.full_name || '',
      requester_picture: connection.requester?.picture ?? undefined,
      addressee_id: adresseeId,
      sent_at: new Date(),
    };
    console.log('🔔 [ConnectionsService] EMITTING CONNECTION_REQUEST_SENT (NEW):', {
      event: MESSAGE_EVENTS.CONNECTION_REQUEST_SENT,
      payload,
      timestamp: new Date().toISOString(),
    });
    this.eventEmitter.emit(MESSAGE_EVENTS.CONNECTION_REQUEST_SENT, payload);

    return {
      id_connection: connection.id_connection,
      message: 'Solicitud de conexión enviada',
    };
  }

  async getConnectionStatus(currentUserId: number, otherUserId: number) {
    const connection = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { requester_id: currentUserId, adressee_id: otherUserId },
          { requester_id: otherUserId, adressee_id: currentUserId },
        ],
      },
    });

    if (!connection) {
      return { status: 'none', id_connection: null };
    }

    return {
      id_connection: connection.id_connection,
      status: connection.status,
      // Indica si el usuario actual fue quien envió la solicitud
      is_requester: connection.requester_id === currentUserId,
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