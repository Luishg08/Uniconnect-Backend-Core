import { Injectable, Logger } from '@nestjs/common';
import { IObserver } from '../../../messages/domain/observer/interfaces';
import { StudyGroupEvent } from '../../domain/observer/study-group-event.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Observer that persists study group notifications to the database
 * and sends Expo push notifications for high-priority events.
 * Ensures notifications are stored for offline users and notification history.
 */
@Injectable()
export class PersistenceNotificationObserver
  implements IObserver<StudyGroupEvent>
{
  private readonly logger = new Logger(PersistenceNotificationObserver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update method called by subject when a study group event occurs.
   * Persists the notification to the database and sends push for critical events.
   *
   * @param event - The study group event to persist
   */
  update(event: StudyGroupEvent): void {
    const { targetUserId, type } = event;

    this.logger.log(
      `Persisting notification: ${type} for user ${targetUserId}`,
    );

    // Fire-and-forget pattern - don't block on DB operations
    this.persistNotification(event).catch((error) => {
      this.logger.error(
        `Failed to persist notification: ${error.message}`,
        error.stack,
      );
    });

    // Enviar push Expo para eventos críticos que requieren acción del usuario
    if (
      type === 'ADMIN_TRANSFER_REQUESTED' ||
      type === 'MEMBER_ACCEPTED' ||
      type === 'JOIN_REQUEST'
    ) {
      this.sendPushForEvent(event).catch((error) => {
        this.logger.error(
          `Failed to send push notification: ${error.message}`,
          error.stack,
        );
      });
    }
  }

  /**
   * Persist notification to database.
   * Private async method for fire-and-forget pattern.
   */
  private async persistNotification(event: StudyGroupEvent): Promise<void> {
    const { targetUserId, type, payload } = event;

    const message = this.buildNotificationMessage(type, payload);
    const notificationType = this.getNotificationType(type);
    const relatedEntityId = (payload.id_group as number) || null;

    await this.prisma.notification.create({
      data: {
        id_user: targetUserId,
        message,
        is_read: false,
        created_at: new Date(),
        related_entity_id: relatedEntityId,
        notification_type: notificationType,
      },
    });

    this.logger.log(
      `Notification persisted for user ${targetUserId}: ${notificationType}`,
    );
  }

  /**
   * Build human-readable Spanish message for notification.
   */
  private buildNotificationMessage(
    type: string,
    payload: Record<string, unknown>,
  ): string {
    const groupName = (payload.group_name as string) || 'Grupo';
    const requesterName = (payload.requester_name as string) || 'Usuario';
    const newOwnerName = (payload.new_owner_name as string) || 'Usuario';

    switch (type) {
      case 'JOIN_REQUEST':
        return `${requesterName} solicitó unirse al grupo '${groupName}'`;
      case 'MEMBER_ACCEPTED':
        return `Tu solicitud para unirte a '${groupName}' fue aceptada`;
      case 'MEMBER_REJECTED':
        return `Tu solicitud para unirte a '${groupName}' fue rechazada`;
      case 'ADMIN_TRANSFER_REQUESTED':
        return `Te han propuesto como administrador del grupo: ${groupName}`;
      case 'ADMIN_TRANSFER_ACCEPTED':
        return `Transferiste la administración del grupo '${groupName}' a ${newOwnerName}`;
      default:
        return `Notificación del grupo '${groupName}'`;
    }
  }

  /**
   * Get database notification type from event type.
   */
  private getNotificationType(type: string): string {
    return type.toLowerCase();
  }

  /**
   * Obtiene los push tokens activos del usuario desde la tabla push_token de Prisma.
   * Envía push notification via Expo Push API para eventos críticos.
   */
  private async sendPushForEvent(event: StudyGroupEvent): Promise<void> {
    const { targetUserId, type, payload } = event;

    // Obtener tokens activos del usuario desde la tabla push_token (schema Prisma)
    const pushTokens = await this.prisma.push_token.findMany({
      where: { id_user: targetUserId, is_active: true },
      select: { token: true },
    });

    if (pushTokens.length === 0) {
      this.logger.log(
        `No active push tokens for user ${targetUserId} — skipping push for ${type}`,
      );
      return;
    }

    const message = this.buildNotificationMessage(type, payload);
    const title = this.buildPushTitle(type);
    const tokens = pushTokens.map((t) => t.token);

    const messages = tokens.map((to) => ({
      to,
      title,
      body: message,
      sound: 'default',
      data: this.buildPushData(type, payload),
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(
          `Expo push API returned ${response.status} for user ${targetUserId}`,
        );
      } else {
        this.logger.log(
          `Push sent to ${tokens.length} device(s) for user ${targetUserId}: ${type}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Expo push fetch failed for user ${targetUserId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Construye el objeto data del payload push con deep linking.
   */
  private buildPushData(
    type: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      type,
      notification_type: this.getNotificationType(type),
    };

    if (type === 'ADMIN_TRANSFER_REQUESTED') {
      const groupId = payload.id_group as number;
      return {
        ...base,
        id_group: groupId,
        screen: 'GroupInfo',
        params: { groupId, autoOpenAccept: true },
      };
    }

    return { ...base, id_group: payload.id_group };
  }

  /**
   * Título corto para la push notification (aparece en la barra de notificaciones).
   */
  private buildPushTitle(type: string): string {
    switch (type) {
      case 'JOIN_REQUEST':
        return '📥 Nueva solicitud de acceso';
      case 'MEMBER_ACCEPTED':
        return '✅ Solicitud aceptada';
      case 'ADMIN_TRANSFER_REQUESTED':
        return '🛡️ Invitación de Administración';
      default:
        return '🔔 Notificación de grupo';
    }
  }
}
