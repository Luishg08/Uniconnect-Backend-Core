import { Injectable, Logger } from '@nestjs/common';
import { IObserver } from '../../domain/observer/interfaces';
import { MessageDto } from '../../dto/message.dto';
import { ChatGateway } from '../gateways/chat.gateway';

/**
 * Observer for private chat messages.
 * Handles emission of messages to private chat rooms only.
 */
@Injectable()
export class PrivateChatObserver implements IObserver<MessageDto> {
  private readonly logger = new Logger(PrivateChatObserver.name);

  constructor(private readonly chatGateway: ChatGateway) {}

  /**
   * Update method called when a private message needs to be emitted.
   * Only processes messages with chat_type 'private'.
   * 
   * @param message - The message data to process
   */
  update(message: MessageDto): void {
    if (message.chat_type !== 'private') {
      this.logger.warn(
        `PrivateChatObserver received non-private message (type: ${message.chat_type}). Ignoring.`
      );
      return;
    }

    if (!message.room_id) {
      this.logger.error('Private message missing room_id. Cannot emit.');
      return;
    }

    const roomId = message.room_id; // Format: private-{userId1}-{userId2}
    this.logger.log(`Emitting private message to room: ${roomId}`);

    // Enrich message with channel metadata
    const enrichedMessage = {
      ...message,
      timestamp: new Date(),
      channel: 'private',
    };

    try {
      this.chatGateway.emitToRoom(roomId, 'NUEVO_MENSAJE', enrichedMessage);
      this.logger.log(`Successfully emitted private message ${message.id_message} to room ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to emit private message to room ${roomId}: ${error.message}`, error.stack);
    }
  }
}
