import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesService } from './roles/roles.service';
import { PermissionsService } from './permissions/permissions.service';
import { CoursesModule } from './courses/courses.module';
import { ProgramsModule } from './programs/programs.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { GroupsModule } from './groups/groups.module';
import { ConnectionsModule } from './connections/connections.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MembershipsModule } from './memberships/memberships.module';
import { MessagesModule } from './messages/messages.module';

@Module({
   imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', 
    }),
    AuthModule,
    UsersModule,
    PrismaModule,
    CoursesModule,
    ProgramsModule,
    EnrollmentsModule,
    GroupsModule,
    ConnectionsModule,
    NotificationsModule,
    MembershipsModule,
    MessagesModule
  ],
  controllers: [AppController],
  providers: [AppService, RolesService, PermissionsService],
})
export class AppModule {}
