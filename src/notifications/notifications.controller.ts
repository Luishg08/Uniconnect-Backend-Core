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
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetClaim } from '../auth/decorators/get-token-claim.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    // ─── FCM Token ────────────────────────────────────────────────────────────

    @Post('fcm-token')
    @ApiOperation({ summary: 'Registra un token FCM para el dispositivo del usuario' })
    @ApiResponse({ status: 201, description: 'Token registrado correctamente' })
    async registerToken(
        @GetClaim('sub') userId: number,
        @Body() dto: RegisterFcmTokenDto,
    ) {
        return this.notificationsService.registerToken(userId, dto);
    }

    @Delete('fcm-token/:token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Desregistra un token FCM (logout del dispositivo)' })
    async removeToken(
        @GetClaim('sub') userId: number,
        @Param('token') token: string,
    ) {
        return this.notificationsService.removeToken(userId, token);
    }

    // ─── Notifications ────────────────────────────────────────────────────────

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
