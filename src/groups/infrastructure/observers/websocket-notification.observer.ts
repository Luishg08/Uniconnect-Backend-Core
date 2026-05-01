import { Injectable, Logger } from '@nestjs/common';
import { IObserver } from '../../../messages/domain/observer/interfaces';
import { StudyGroupEvent } from '../../domain/observer/study-group-event.interface';
import { ChatGateway } from '../../../messages/infrastructure/gateways/chat.gateway';
import { ChatSessionManager } from '../../../messages/managers/chat-session.manager';

/**
 * Observer that emits study group notifications via WebSocket.
 * Sends real-time notifications to the target user's active socket connections.
 */
@Injectable()
export class WebSocketNotificationObserver
  implements IObserver<StudyGroupEvent>
{
  private readonly logger = new Logger(WebSocketNotificationObserver.name);

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly sessionManager: ChatSessionManager,
  ) {}

  /**
   * Update method called by subject when a study group event occurs.
   * Emits the event to all of the target user's active WebSocket connections.
   *
   * @param event - The study group event to emit
   */
  update(event: StudyGroupEvent): void {
    const { targetUserId, type } = event;

    this.logger.log(
      `Emitting WebSocket notification: ${type} to user ${targetUserId}`,
    );

    // Get all active sockets for the target user
    const userSockets = this.sessionManager.getUserSockets(targetUserId);

    if (userSockets.length === 0) {
      this.logger.log(
        `User ${targetUserId} has no active sockets (offline). Notification will be in DB.`,
      );
      return;
    }

    // When a member is removed or left voluntarily, force them out of the group room
    if (type === 'MEMBER_REMOVED') {
      const idGroup = event.payload.id_group as number;
      const roomName = `group-${idGroup}`;

      userSockets.forEach((socketId) => {
        try {
          this.chatGateway.server.in(socketId).socketsLeave(roomName);
          this.sessionManager.leaveGroupRoom(idGroup, socketId);
          this.chatGateway.server.to(socketId).emit('group:access_revoked', {
            id_group: idGroup,
            group_name: event.payload.group_name,
          });
          this.logger.log(
            `Removed socket ${socketId} from room ${roomName} for user ${targetUserId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to remove socket ${socketId} from room ${roomName}: ${error.message}`,
            error.stack,
          );
        }
      });
      return;
    }

    // Emit to all user's sockets (multiple devices)
    userSockets.forEach((socketId) => {
      try {
        this.chatGateway.server
          .to(socketId)
          .emit('study_group_notification', event);
        this.logger.log(
          `Emitted to socket ${socketId} for user ${targetUserId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to emit to socket ${socketId}: ${error.message}`,
          error.stack,
        );
      }
    });
  }
}
