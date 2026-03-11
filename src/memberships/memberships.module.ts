import { Module } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MembershipRepository } from './repositories/membership.repository';

@Module({
  imports: [PrismaModule],
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipRepository],
  exports: [MembershipsService, MembershipRepository],
})
export class MembershipsModule {}
