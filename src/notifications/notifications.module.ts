import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from './expopush.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, ExpoPushService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule { }
