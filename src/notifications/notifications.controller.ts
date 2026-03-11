import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ExpoPushTokenDto } from './dto/expo-push-token.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@GetClaim('sub') userId: number) {
    return this.notificationsService.findAllForUser(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@GetClaim('sub') userId: number) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  async markAsRead(
    @GetClaim('sub') userId: number,
    @Param('id', ParseIntPipe) notificationId: number,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@GetClaim('sub') userId: number) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Post('expo-push-token')
  async saveExpoPushToken(
    @GetClaim('sub') userId: number,
    @Body() dto: ExpoPushTokenDto,
  ) {
    return this.notificationsService.saveExpoPushToken(userId, dto);
  }

  @Delete('expo-push-token/:token')
  async deleteExpoPushToken(
    @GetClaim('sub') userId: number,
    @Param('token') token: string,
  ) {
    return this.notificationsService.deleteExpoPushToken(userId, token);
  }
}
