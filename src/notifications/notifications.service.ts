import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        private prisma: PrismaService,
        private fcmService: FcmService,
    ) { }

    // ─── FCM Token Management ─────────────────────────────────────────────────

    async registerToken(userId: number, dto: RegisterFcmTokenDto) {
        // Si el token ya existe lo reactivamos (upsert por token)
        const token = await this.prisma.push_token.upsert({
            where: { token: dto.token },
            update: {
                id_user: userId,
                device_type: dto.device_type,
                device_name: dto.device_name,
                is_active: true,
                updated_at: new Date(),
            },
            create: {
                id_user: userId,
                token: dto.token,
                device_type: dto.device_type,
                device_name: dto.device_name,
                is_active: true,
            },
        });
        return { message: 'Token registrado correctamente', id_token: token.id_token };
    }

    async removeToken(userId: number, token: string) {
        const existing = await this.prisma.push_token.findFirst({
            where: { token, id_user: userId },
        });

        if (!existing) {
            throw new NotFoundException('Token no encontrado');
        }

        await this.prisma.push_token.update({
            where: { id_token: existing.id_token },
            data: { is_active: false },
        });

        return { message: 'Token desregistrado correctamente' };
    }

    // ─── Notification CRUD ────────────────────────────────────────────────────

    async getUserNotifications(userId: number) {
        return this.prisma.notification.findMany({
            where: { id_user: userId },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
    }

    async markAsRead(notificationId: number, userId: number) {
        const notif = await this.prisma.notification.findFirst({
            where: { id_notification: notificationId, id_user: userId },
        });

        if (!notif) {
            throw new NotFoundException('Notificación no encontrada');
        }

        return this.prisma.notification.update({
            where: { id_notification: notificationId },
            data: { is_read: true },
        });
    }

    async markAllAsRead(userId: number) {
        await this.prisma.notification.updateMany({
            where: { id_user: userId, is_read: false },
            data: { is_read: true },
        });
        return { message: 'Todas las notificaciones marcadas como leídas' };
    }

    // ─── Internal: Create notification + Send push ────────────────────────────

    /**
     * Crea una notificación en BD y envía push a todos los tokens activos del usuario.
     * Llamado internamente desde ConnectionsService, GroupsService, etc.
     */
    async createAndSend(params: {
        userId: number;
        message: string;
        notification_type: string;
        related_entity_id?: number;
        pushTitle: string;
        pushBody: string;
        pushData?: Record<string, string>;
    }) {
        const { userId, message, notification_type, related_entity_id, pushTitle, pushBody, pushData } = params;

        // 1. Guardar en BD
        const notification = await this.prisma.notification.create({
            data: {
                id_user: userId,
                message,
                notification_type,
                related_entity_id: related_entity_id ?? null,
                is_read: false,
                created_at: new Date(),
                push_sent: false,
            },
        });

        // 2. Obtener tokens activos del usuario
        const tokens = await this.prisma.push_token.findMany({
            where: { id_user: userId, is_active: true },
            select: { token: true },
        });

        const tokenStrings = tokens.map((t) => t.token);

        let pushSent = false;
        if (tokenStrings.length > 0) {
            await this.fcmService.sendToTokens(tokenStrings, pushTitle, pushBody, pushData);
            pushSent = true;
        }

        // 3. Actualizar push_sent en BD
        await this.prisma.notification.update({
            where: { id_notification: notification.id_notification },
            data: { push_sent: pushSent },
        });

        return notification;
    }

    // ─── Helpers específicos por tipo ─────────────────────────────────────────

    async notifyConnectionRequest(params: {
        toUserId: number;
        fromUserName: string;
        connectionId: number;
    }) {
        return this.createAndSend({
            userId: params.toUserId,
            message: `${params.fromUserName} te envió una solicitud de conexión`,
            notification_type: 'connection_request',
            related_entity_id: params.connectionId,
            pushTitle: 'Nueva solicitud de conexión',
            pushBody: `${params.fromUserName} quiere conectarse contigo`,
            pushData: {
                type: 'connection_request',
                connection_id: String(params.connectionId),
            },
        });
    }

    async notifyNewMessage(params: {
        toUserId: number;
        fromUserName: string;
        groupName: string;
        membershipId: number;
    }) {
        return this.createAndSend({
            userId: params.toUserId,
            message: `${params.fromUserName} envió un mensaje en "${params.groupName}"`,
            notification_type: 'new_message',
            related_entity_id: params.membershipId,
            pushTitle: `${params.groupName}`,
            pushBody: `${params.fromUserName}: Nuevo mensaje`,
            pushData: {
                type: 'new_message',
                membership_id: String(params.membershipId),
            },
        });
    }
}
