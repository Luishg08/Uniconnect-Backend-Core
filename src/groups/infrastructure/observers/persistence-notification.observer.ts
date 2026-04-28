import { Injectable, Logger } from '@nestjs/common';
import { IObserver } from '../../../messages/domain/observer/interfaces';
import { StudyGroupEvent } from '../../domain/observer/study-group-event.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Observer that persists study group notifications to the database.
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
   * Persists the notification to the database.
   *
   * @param event - The study group event to persist
   */
  update(event: StudyGroupEvent): void {
    const { targetUserId, type, payload } = event;

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
        return `Te han transferido la administración del grupo '${groupName}'`;
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
}
