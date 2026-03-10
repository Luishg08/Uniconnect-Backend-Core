import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupBusinessValidator } from './validators/group-business.validator';
import { GroupOwnershipGuard } from './guards/group-ownership.guard';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { GroupRepository } from './repositories/group.repository';

@Module({
  imports: [PrismaModule],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    GroupBusinessValidator,
    GroupOwnershipGuard,
    AdminOnlyGuard,
    GroupRepository,
  ],
  exports: [GroupsService, GroupBusinessValidator, GroupRepository],
})
export class GroupsModule {}