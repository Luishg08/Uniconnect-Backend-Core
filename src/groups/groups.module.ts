import { Module, OnModuleInit } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesModule } from '../messages/messages.module';
import { GroupBusinessValidator } from './validators/group-business.validator';
import { GroupOwnershipGuard } from './guards/group-ownership.guard';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { GroupRepository } from './repositories/group.repository';
import { GroupActivityListener } from './listeners/group-activity.listener';
import { StudyGroupSubject } from './domain/observer/study-group-subject';
import { WebSocketNotificationObserver } from './infrastructure/observers/websocket-notification.observer';
import { PersistenceNotificationObserver } from './infrastructure/observers/persistence-notification.observer';

@Module({
  imports: [PrismaModule, MessagesModule],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    GroupBusinessValidator,
    GroupOwnershipGuard,
    AdminOnlyGuard,
    GroupRepository,
    GroupActivityListener,
    StudyGroupSubject,
    WebSocketNotificationObserver,
    PersistenceNotificationObserver,
  ],
  exports: [GroupsService, GroupBusinessValidator, GroupRepository],
})
export class GroupsModule implements OnModuleInit {
  constructor(
    private readonly subject: StudyGroupSubject,
    private readonly webSocketObserver: WebSocketNotificationObserver,
    private readonly persistenceObserver: PersistenceNotificationObserver,
  ) {}

  /**
   * Initialize module by attaching observers to the subject.
   * Called automatically by NestJS when the module is initialized.
   */
  onModuleInit() {
    this.subject.attach(this.webSocketObserver);
    this.subject.attach(this.persistenceObserver);
  }
}