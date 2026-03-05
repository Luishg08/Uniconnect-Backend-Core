import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterExpoPushTokenDto } from './dto/register-expo-push-token.dto';

export const NotificationTypes = {
  CONNECTION_REQUEST: 'connection_request',
  CONNECTION_ACCEPTED: 'connection_accepted',
  CONNECTION_REJECTED: 'connection_rejected',
  NEW_MESSAGE: 'new_message',
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Expo Push Tokens
  // ─────────────────────────────────────────────

  async registerToken(userId: number, dto: RegisterExpoPushTokenDto) {
    const existing = await this.prisma.push_token.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      return this.prisma.push_token.update({
        where: { token: dto.token },
        data: {
          id_user: userId,
          device_type: dto.device_type,
          device_name: dto.device_name,
          is_active: true,
        },
      });
    }

    return this.prisma.push_token.create({
      data: {
        id_user: userId,
        token: dto.token,
        device_type: dto.device_type,
        device_name: dto.device_name,
      },
    });
  }

  async removeToken(userId: number, token: string) {
    const existing = await this.prisma.push_token.findFirst({
      where: {
        token,
        id_user: userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Token no encontrado');
    }

    await this.prisma.push_token.delete({
      where: { id_token: existing.id_token },
    });

    return { message: 'Token eliminado correctamente' };
  }

  // ─────────────────────────────────────────────
  // Notifications CRUD
  // ─────────────────────────────────────────────

  async getUserNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: { id_user: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id_notification: notificationId,
        id_user: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.prisma.notification.update({
      where: { id_notification: notificationId },
      data: { is_read: true },
    });
  }

  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: {
        id_user: userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    return { message: 'Todas las notificaciones fueron marcadas como leídas' };
  }

  // ─────────────────────────────────────────────
  // Connection Notifications
  // ─────────────────────────────────────────────

  async notifyConnectionRequest(data: {
    toUserId: number;
    fromUserName: string;
    connectionId: number;
  }) {
    return this.prisma.notification.create({
      data: {
        id_user: data.toUserId,
        message: `${data.fromUserName} te envió una solicitud de conexión`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: data.connectionId,
        notification_type: NotificationTypes.CONNECTION_REQUEST,
        push_sent: false,
      },
    });
  }

  async notifyConnectionAccepted(data: {
    toUserId: number;
    fromUserName: string;
    connectionId: number;
  }) {
    return this.prisma.notification.create({
      data: {
        id_user: data.toUserId,
        message: `${data.fromUserName} aceptó tu solicitud de conexión`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: data.connectionId,
        notification_type: NotificationTypes.CONNECTION_ACCEPTED,
        push_sent: false,
      },
    });
  }

  async notifyConnectionRejected(data: {
    toUserId: number;
    fromUserName: string;
    connectionId: number;
  }) {
    return this.prisma.notification.create({
      data: {
        id_user: data.toUserId,
        message: `${data.fromUserName} rechazó tu solicitud de conexión`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: data.connectionId,
        notification_type: NotificationTypes.CONNECTION_REJECTED,
        push_sent: false,
      },
    });
  }
}