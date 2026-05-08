import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ExpoPushTokenDto } from './dto/expo-push-token.dto';
import { INotificacionStrategy, NotificacionDTO, ResultadoEnvio } from './domain/strategy/interfaces';
import { NOTIFICACION_STRATEGIES } from './notifications.tokens';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICACION_STRATEGIES)
    private readonly estrategias: INotificacionStrategy[],
  ) {}

  // ─── Strategy Context ─────────────────────────────────────────────────────

  async enviarNotificacion(notificacion: NotificacionDTO): Promise<ResultadoEnvio[]> {
    const estrategiasActivas = await this.filtrarEstrategiasActivas(
      notificacion.id_user,
      notificacion.tipo_evento,
    );

    const resultados = await Promise.allSettled(
      estrategiasActivas.map((e) => e.enviar(notificacion)),
    );

    return resultados.map((resultado, i) => {
      if (resultado.status === 'fulfilled') {
        return resultado.value;
      }
      const canal = estrategiasActivas[i].canal;
      this.logger.error(
        `Estrategia "${canal}" falló de forma inesperada: ${resultado.reason}`,
      );
      return {
        canal,
        exitoso: false,
        error: String(resultado.reason),
        timestamp: new Date(),
      };
    });
  }

  private async filtrarEstrategiasActivas(
    userId: number,
    tipoEvento: string,
  ): Promise<INotificacionStrategy[]> {
    const preferencias = await this.prisma.user_notification_preference.findMany({
      where: { id_user: userId, tipo_evento: tipoEvento },
      select: { canal: true, activo: true },
    });

    if (preferencias.length === 0) {
      return this.estrategias;
    }

    const canalesActivos = new Set(
      preferencias.filter((p) => p.activo).map((p) => p.canal),
    );

    return this.estrategias.filter((e) => canalesActivos.has(e.canal));
  }

  // ─── Preferencias de canal ────────────────────────────────────────────────

  async obtenerPreferencias(userId: number) {
    return this.prisma.user_notification_preference.findMany({
      where: { id_user: userId },
      select: { tipo_evento: true, canal: true, activo: true },
      orderBy: [{ tipo_evento: 'asc' }, { canal: 'asc' }],
    });
  }

  async actualizarPreferencia(
    userId: number,
    tipoEvento: string,
    canal: string,
    activo: boolean,
  ) {
    await this.prisma.user_notification_preference.upsert({
      where: {
        id_user_tipo_evento_canal: { id_user: userId, tipo_evento: tipoEvento, canal },
      },
      update: { activo },
      create: { id_user: userId, tipo_evento: tipoEvento, canal, activo },
    });

    return { success: true };
  }

  // ─── CRUD REST existente ──────────────────────────────────────────────────

  async findAllForUser(userId: number) {
    const notifications = await (this.prisma.notification as any).findMany({
      where: { id_user: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id_notification: true,
        message: true,
        is_read: true,
        created_at: true,
        notification_type: true,
        related_entity_id: true,
      },
    });

    return notifications.map((notification: any) => ({
      id_notification: notification.id_notification,
      message: notification.message ?? '',
      is_read: Boolean(notification.is_read),
      created_at: (notification.created_at ?? new Date(0)).toISOString(),
      notification_type: notification.notification_type ?? null,
      related_entity_id: notification.related_entity_id ?? null,
    }));
  }

  async getUnreadCount(userId: number) {
    const count = await (this.prisma.notification as any).count({
      where: { id_user: userId, is_read: false },
    });
    return { count };
  }

  async markAsRead(userId: number, notificationId: number) {
    const result = await (this.prisma.notification as any).updateMany({
      where: {
        id_notification: notificationId,
        id_user: userId,
      },
      data: {
        is_read: true,
      },
    });

    if (!result.count) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Notification not found',
        error: 'Not Found',
      });
    }

    return { success: true };
  }

  async markAllAsRead(userId: number) {
    const result = await (this.prisma.notification as any).updateMany({
      where: { id_user: userId },
      data: { is_read: true },
    });

    return {
      success: true,
      updated: result.count,
    };
  }

  async saveExpoPushToken(userId: number, dto: ExpoPushTokenDto) {
    await this.prisma.user_push_token.upsert({
      where: { id_user_token: { id_user: userId, token: dto.token } },
      update: { platform: dto.platform ?? null, updated_at: new Date() },
      create: { id_user: userId, token: dto.token, platform: dto.platform ?? null },
    });

    return {
      success: true,
      message: 'Expo push token saved',
    };
  }

  async deleteExpoPushToken(userId: number, token: string) {
    const result = await this.prisma.user_push_token.deleteMany({
      where: { id_user: userId, token },
    });

    return {
      success: true,
      deleted: result.count,
    };
  }
}
