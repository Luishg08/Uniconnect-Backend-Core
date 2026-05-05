import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MessagesModule } from 'src/messages/messages.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { NOTIFICACION_STRATEGIES } from './notifications.tokens';
import { InAppWebSocketStrategy } from './domain/strategy/in-app-websocket.strategy';
import { EmailInstitucionalStrategy } from './domain/strategy/email-institucional.strategy';
import { PushMovilStrategy } from './domain/strategy/push-movil.strategy';

@Module({
  imports: [PrismaModule, MessagesModule],
  controllers: [NotificationsController],
  providers: [
    InAppWebSocketStrategy,
    EmailInstitucionalStrategy,
    PushMovilStrategy,
    {
      provide: NOTIFICACION_STRATEGIES,
      useFactory: (
        inApp: InAppWebSocketStrategy,
        email: EmailInstitucionalStrategy,
        push: PushMovilStrategy,
      ) => [inApp, email, push],
      inject: [InAppWebSocketStrategy, EmailInstitucionalStrategy, PushMovilStrategy],
    },
    NotificationsService,
    NotificationEventListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
