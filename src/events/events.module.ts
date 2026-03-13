import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [PrismaModule],
  providers: [EventsService, AdminGuard],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
