import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesService as MessagesServiceUS02, VALIDACION_CHAIN_TOKEN } from './application/messages.service';
import { VALIDACION_CHAIN_REST_TOKEN } from './messages.service';
import { MessagesController } from './messages.controller';
import { ChatGateway } from './infrastructure/gateways/chat.gateway';
import { MessagesGateway } from './messages.gateway';
import { ChatSubject } from './domain/observer/chat-subject';
import { PrivateChatObserver } from './infrastructure/observers/private-chat.observer';
import { GroupChatObserver } from './infrastructure/observers/group-chat.observer';
import { PrismaModule } from '../prisma/prisma.module';
import { MessageRepository } from './message.repository';
import { ChatSessionManager } from './managers/chat-session.manager';
import { ValidacionChainFactory } from './domain/chain-of-responsibility/validacion-chain.factory';

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
    {
      provide: ChatSessionManager,
      useFactory: () => ChatSessionManager.getInstance(),
    },
    {
      provide: VALIDACION_CHAIN_TOKEN,
      useFactory: () => ValidacionChainFactory.crearCadena(),
    },
    {
      provide: VALIDACION_CHAIN_REST_TOKEN,
      useFactory: () =>
        ValidacionChainFactory.crearCadena({ incluirValidacionPermisos: false }),
    },
  ],
  exports: [MessagesService, MessagesServiceUS02, ChatGateway, MessagesGateway, MessageRepository, ChatSessionManager],
})
export class MessagesModule {}
