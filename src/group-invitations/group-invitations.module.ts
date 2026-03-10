import { Module } from '@nestjs/common';
import { GroupInvitationsService } from './group-invitations.service';
import { GroupInvitationsController } from './group-invitations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [PrismaModule, GroupsModule],
  controllers: [GroupInvitationsController],
  providers: [GroupInvitationsService],
  exports: [GroupInvitationsService],
})
export class GroupInvitationsModule {}
