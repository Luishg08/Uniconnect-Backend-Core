import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesService as MessagesServiceUS02 } from './application/messages.service';
import { MessagesController } from './messages.controller';
import { ChatGateway } from './infrastructure/gateways/chat.gateway';
import { MessagesGateway } from './messages.gateway';
import { ChatSubject } from './domain/observer/chat-subject';
import { PrivateChatObserver } from './infrastructure/observers/private-chat.observer';
import { GroupChatObserver } from './infrastructure/observers/group-chat.observer';
import { PrismaModule } from '../prisma/prisma.module';
import { MessageRepository } from './message.repository';

/**
 * Messages module that provides real-time chat functionality using the Observer pattern.
 * Includes WebSocket gateway, message service, and observer implementations.
 * Also includes traditional REST API endpoints and repository pattern.
 */
@Module({
  imports: [PrismaModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesServiceUS02,
    ChatGateway,
    MessagesGateway,
    ChatSubject,
    PrivateChatObserver,
    GroupChatObserver,
    MessageRepository,
  ],
  exports: [MessagesService, MessagesServiceUS02, ChatGateway, MessagesGateway, MessageRepository],
})
export class MessagesModule {}
