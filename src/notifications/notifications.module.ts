import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MessagesModule } from 'src/messages/messages.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEventListener } from './listeners/notification-event.listener';
import { ResumenDiarioCronService } from './resumen-diario-cron.service';
import { NOTIFICACION_STRATEGIES } from './notifications.tokens';
import { InAppWebSocketStrategy } from './domain/strategy/in-app-websocket.strategy';
import { EmailInstitucionalStrategy } from './domain/strategy/email-institucional.strategy';
import { PushMovilStrategy } from './domain/strategy/push-movil.strategy';
import { ResumenDiarioStrategy } from './domain/strategy/resumen-diario.strategy';

@Module({
  imports: [PrismaModule, MessagesModule, ScheduleModule.forRoot()],
  controllers: [NotificationsController],
  providers: [
    InAppWebSocketStrategy,
    EmailInstitucionalStrategy,
    PushMovilStrategy,
    ResumenDiarioStrategy,
    {
      provide: NOTIFICACION_STRATEGIES,
      useFactory: (
        inApp: InAppWebSocketStrategy,
        email: EmailInstitucionalStrategy,
        push: PushMovilStrategy,
        resumen: ResumenDiarioStrategy,
      ) => [inApp, email, push, resumen],
      inject: [InAppWebSocketStrategy, EmailInstitucionalStrategy, PushMovilStrategy, ResumenDiarioStrategy],
    },
    NotificationsService,
    NotificationEventListener,
    ResumenDiarioCronService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
