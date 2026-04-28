import { Injectable, Logger } from '@nestjs/common';
import { IObserver } from '../../domain/observer/interfaces';
import { MessageDto } from '../../dto/message.dto';
import { ChatGateway } from '../gateways/chat.gateway';

/**
 * Observer for group chat messages.
 * Handles emission of messages to group chat rooms only.
 */
@Injectable()
export class GroupChatObserver implements IObserver<MessageDto> {
  private readonly logger = new Logger(GroupChatObserver.name);

  constructor(private readonly chatGateway: ChatGateway) {}

  /**
   * Update method called when a group message needs to be emitted.
   * Only processes messages with chat_type 'group'.
   * 
   * @param message - The message data to process
   */
  update(message: MessageDto): void {
    if (message.chat_type !== 'group') {
      this.logger.warn(
        `GroupChatObserver received non-group message (type: ${message.chat_type}). Ignoring.`
      );
      return;
    }

    if (!message.room_id) {
      this.logger.error('Group message missing room_id. Cannot emit.');
      return;
    }

    const roomId = message.room_id; // Format: group-{groupId}
    this.logger.log(`Emitting group message to room: ${roomId}`);

    // Enrich message with channel metadata
    const enrichedMessage = {
      ...message,
      timestamp: new Date(),
      channel: 'group',
    };

    try {
      this.chatGateway.emitToRoom(roomId, 'NUEVO_MENSAJE', enrichedMessage);
      this.logger.log(`Successfully emitted group message ${message.id_message} to room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to emit group message to room ${roomId}: ${error.message}`, error.stack);
    }
  }
}
