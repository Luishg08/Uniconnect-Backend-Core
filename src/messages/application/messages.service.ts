import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { ChatSubject } from '../domain/observer/chat-subject';
import { PrivateChatObserver } from '../infrastructure/observers/private-chat.observer';
import { GroupChatObserver } from '../infrastructure/observers/group-chat.observer';
import { MessageDto } from '../dto/message.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { IValidadorMensajeHandler } from '../domain/chain-of-responsibility/interfaces';

export const VALIDACION_CHAIN_TOKEN = 'VALIDACION_CHAIN';

/**
 * Main coordinator service for message processing.
 * Orchestrates the Observer pattern flow: decorators → attach → persist → notify.
 */
@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly chatSubject: ChatSubject,
    private readonly privateChatObserver: PrivateChatObserver,
    private readonly groupChatObserver: GroupChatObserver,
    private readonly prisma: PrismaService,
    @Inject(VALIDACION_CHAIN_TOKEN)
    private readonly validacionChain: IValidadorMensajeHandler,
  ) {}

  /**
   * Main method to send a message through the Observer pattern.
   * 
   * @param messageDto - The message data to process
   * @returns The saved message with generated ID
   */
  async sendMessage(messageDto: MessageDto): Promise<MessageDto> {
    try {
      this.logger.log(`Processing message: ${messageDto.text_content?.substring(0, 50)}...`);

      // 0. Validate using Chain of Responsibility before any processing
      const resultado = this.validacionChain.manejar(messageDto);
      if (!resultado.valido) {
        this.logger.warn(`Message rejected [${resultado.codigoError}]: ${resultado.mensaje}`);
        throw new BadRequestException(resultado.mensaje ?? resultado.codigoError);
      }

      // 1. Apply decorators (placeholder implementation)
      const decoratedMessage = this.applyDecorators(messageDto);

      // 2. Determine chat type and room ID
      const enrichedMessage = this.enrichMessageWithRoomInfo(decoratedMessage);

      // 3. Attach appropriate observer based on chat type
      this.attachObserverForChatType(enrichedMessage.chat_type);

      // 4. Persist message to database
      const savedMessage = await this.persistMessage(enrichedMessage);

      // 5. Notify observers (this will emit via Socket.IO)
      this.chatSubject.notify(savedMessage);

      this.logger.log(`Message sent successfully: ${savedMessage.id_message}`);
      return savedMessage;
    } catch (error) {
      this.logger.error(`Send message failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Apply decorators to the message using the Decorator pattern.
   * Instantiates decorator chain based on DTO fields and generates rendered_content.
   * 
   * @param message - The original message
   * @returns The message with decorator metadata and rendered_content
   */
  private applyDecorators(message: MessageDto): MessageDto {
    this.logger.log('Applying decorators using Decorator pattern');

    // Import decorator classes
    const { BaseMessage } = require('../domain/decorator/base-message');
    const { FileMessageDecorator } = require('../domain/decorator/file-message.decorator');
    const { MentionMessageDecorator } = require('../domain/decorator/mention-message.decorator');
    const { ReactionMessageDecorator } = require('../domain/decorator/reaction-message.decorator');

    // Create base message
    let messageObj = new BaseMessage(
      message.text_content || '',
      message.sender_id || 0,
      message.send_at || new Date(),
    );

    const decoratorsApplied: string[] = [];

    // Apply file decorator if files present
    if (message.files && message.files.length > 0) {
      messageObj = new FileMessageDecorator(messageObj, message.files);
      decoratorsApplied.push('file-attachment');
    }

    // Apply mention decorator if mentions present
    if (message.mentions && message.mentions.length > 0) {
      messageObj = new MentionMessageDecorator(messageObj, message.mentions);
      decoratorsApplied.push('user-mention');
    }

    // Apply reaction decorator if reactions present
    if (message.reactions && message.reactions.length > 0) {
      messageObj = new ReactionMessageDecorator(messageObj, message.reactions);
      decoratorsApplied.push('emoji-reaction');
    }

    // Generate rendered content
    const renderedContent = messageObj.render();

    return {
      ...message,
      rendered_content: renderedContent,
      decorators_applied: decoratorsApplied,
      processed_at: new Date(),
    };
  }

  /**
   * Enrich message with chat type and room ID information.
   * 
   * @param message - The decorated message
   * @returns The message with chat_type and room_id
   */
  private enrichMessageWithRoomInfo(message: MessageDto): MessageDto {
    if (message.id_membership) {
      // Group chat: has membership ID
      return {
        ...message,
        chat_type: 'group',
        room_id: `group-${message.id_membership}`,
      };
    } else if (message.sender_id && message.recipient_id) {
      // Private chat: has sender and recipient IDs
      // Ensure consistent room naming regardless of sender/recipient order
      const [userId1, userId2] = [message.sender_id, message.recipient_id].sort((a, b) => a - b);
      return {
        ...message,
        chat_type: 'private',
        room_id: `private-${userId1}-${userId2}`,
      };
    } else {
      throw new Error('Message must have either id_membership (group) or sender_id/recipient_id (private)');
    }
  }

  /**
   * Attach the appropriate observer based on chat type.
   * 
   * @param chatType - The type of chat ('private' or 'group')
   */
  private attachObserverForChatType(chatType: 'private' | 'group' | undefined): void {
    if (chatType === 'private') {
      this.chatSubject.attach(this.privateChatObserver);
      this.logger.log('Attached PrivateChatObserver');
    } else if (chatType === 'group') {
      this.chatSubject.attach(this.groupChatObserver);
      this.logger.log('Attached GroupChatObserver');
    } else {
      throw new Error(`Invalid chat type: ${chatType}`);
    }
  }

  /**
   * Persist the message to the database.
   * 
   * @param message - The enriched message
   * @returns The saved message with generated ID
   */
  private async persistMessage(message: MessageDto): Promise<MessageDto> {
    try {
      const savedMessage = await this.prisma.message.create({
        data: {
          id_membership: message.id_membership,
          text_content: message.text_content,
          send_at: message.send_at || new Date(),
          attachments: message.attachments,
          is_edited: message.is_edited || false,
        },
      });

      this.logger.log(`Message persisted with ID: ${savedMessage.id_message}`);

      return {
        ...message,
        id_message: savedMessage.id_message,
        send_at: savedMessage.send_at,
      };
    } catch (error) {
      this.logger.error(`Failed to persist message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get observer count for monitoring/debugging.
   */
  getObserverCount(): number {
    return this.chatSubject.getObserverCount();
  }
}
