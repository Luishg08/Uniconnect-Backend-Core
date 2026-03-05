import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { RegisterExpoPushTokenDto } from './dto/register-expo-push-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetClaim } from '../auth/decorators/get-token-claim.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('expo-push-token')
  @ApiOperation({ summary: 'Registra un token Expo Push para el dispositivo del usuario' })
  @ApiResponse({ status: 201, description: 'Token registrado correctamente' })
  async registerToken(
    @GetClaim('sub') userId: number,
    @Body() dto: RegisterExpoPushTokenDto,
  ) {
    return this.notificationsService.registerToken(userId, dto);
  }

  @Delete('expo-push-token/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desregistra un token Expo Push (logout del dispositivo)' })
  async removeToken(
    @GetClaim('sub') userId: number,
    @Param('token') token: string,
  ) {
    return this.notificationsService.removeToken(userId, token);
  }

  @Get()
  @ApiOperation({ summary: 'Obtiene las últimas 50 notificaciones del usuario autenticado' })
  async getMyNotifications(@GetClaim('sub') userId: number) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca una notificación específica como leída' })
  async markAsRead(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
  ) {
    return this.notificationsService.markAsRead(+id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marca todas las notificaciones del usuario como leídas' })
  async markAllAsRead(@GetClaim('sub') userId: number) {
    return this.notificationsService.markAllAsRead(userId);
  }
}