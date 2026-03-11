import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExpoPushTokenDto } from './dto/expo-push-token.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: number) {
    const notifications = await (this.prisma.notification as any).findMany({
      where: { id_user: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id_notification: true,
        message: true,
        is_read: true,
        created_at: true,
        notification_type: true,
        related_entity_id: true,
      },
    });

    return notifications.map((notification: any) => ({
      id_notification: notification.id_notification,
      message: notification.message ?? '',
      is_read: Boolean(notification.is_read),
      created_at: (notification.created_at ?? new Date(0)).toISOString(),
      notification_type: notification.notification_type ?? null,
      related_entity_id: notification.related_entity_id ?? null,
    }));
  }

  async getUnreadCount(userId: number) {
    const count = await (this.prisma.notification as any).count({
      where: { id_user: userId, is_read: false },
    });
    return { count };
  }

  async markAsRead(userId: number, notificationId: number) {
    const result = await (this.prisma.notification as any).updateMany({
      where: {
        id_notification: notificationId,
        id_user: userId,
      },
      data: {
        is_read: true,
      },
    });

    if (!result.count) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Notification not found',
        error: 'Not Found',
      });
    }

    return { success: true };
  }

  async markAllAsRead(userId: number) {
    const result = await (this.prisma.notification as any).updateMany({
      where: { id_user: userId },
      data: { is_read: true },
    });

    return {
      success: true,
      updated: result.count,
    };
  }

  async saveExpoPushToken(userId: number, dto: ExpoPushTokenDto) {
    await this.ensurePushTokenTable();

    await this.prisma.$executeRaw`
      INSERT INTO user_push_token (id_user, token, platform)
      VALUES (${userId}, ${dto.token}, ${dto.platform ?? null})
      ON CONFLICT (id_user, token)
      DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
    `;

    return {
      success: true,
      message: 'Expo push token saved',
    };
  }

  async deleteExpoPushToken(userId: number, token: string) {
    await this.ensurePushTokenTable();

    const deleted = await this.prisma.$executeRaw`
      DELETE FROM user_push_token
      WHERE id_user = ${userId} AND token = ${token}
    `;

    return {
      success: true,
      deleted,
    };
  }

  private async ensurePushTokenTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS user_push_token (
        id_push_token SERIAL PRIMARY KEY,
        id_user INTEGER NOT NULL REFERENCES "user"(id_user) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        platform VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (id_user, token)
      )
    `;

    await this.prisma.$executeRawUnsafe(query);
  }
}
