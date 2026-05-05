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

  /**
   * Envía una notificación usando las estrategias activas para ese usuario y tipo de evento.
   * El error de una estrategia queda aislado; las demás siguen ejecutándose.
   */
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
    await this.ensurePreferencesTable();

    const preferencias = await this.prisma.$queryRaw<
      Array<{ canal: string; activo: boolean }>
    >`
      SELECT canal, activo
      FROM user_notification_preference
      WHERE id_user = ${userId} AND tipo_evento = ${tipoEvento}
    `;

    // Sin preferencias configuradas → todas las estrategias activas por defecto
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
    await this.ensurePreferencesTable();

    return this.prisma.$queryRaw<
      Array<{ tipo_evento: string; canal: string; activo: boolean }>
    >`
      SELECT tipo_evento, canal, activo
      FROM user_notification_preference
      WHERE id_user = ${userId}
      ORDER BY tipo_evento, canal
    `;
  }

  async actualizarPreferencia(
    userId: number,
    tipoEvento: string,
    canal: string,
    activo: boolean,
  ) {
    await this.ensurePreferencesTable();

    await this.prisma.$executeRaw`
      INSERT INTO user_notification_preference (id_user, tipo_evento, canal, activo)
      VALUES (${userId}, ${tipoEvento}, ${canal}, ${activo})
      ON CONFLICT (id_user, tipo_evento, canal)
      DO UPDATE SET activo = EXCLUDED.activo
    `;

    return { success: true };
  }

  private async ensurePreferencesTable(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_notification_preference (
        id          SERIAL PRIMARY KEY,
        id_user     INTEGER NOT NULL REFERENCES "user"(id_user) ON DELETE CASCADE,
        tipo_evento VARCHAR(100) NOT NULL,
        canal       VARCHAR(100) NOT NULL,
        activo      BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (id_user, tipo_evento, canal)
      )
    `);
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
    await this.ensurePushTokenTable();

    await this.prisma.$executeRaw`
      INSERT INTO user_push_token (id_user, token, platform)
      VALUES (${userId}, ${dto.token}, ${dto.platform ?? null})
      ON CONFLICT (id_user, token)
      DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
    `;

    return {
      success: true,
      message: 'Expo push token saved',
    };
  }

  async deleteExpoPushToken(userId: number, token: string) {
    await this.ensurePushTokenTable();

    const deleted = await this.prisma.$executeRaw`
      DELETE FROM user_push_token
      WHERE id_user = ${userId} AND token = ${token}
    `;

    return {
      success: true,
      deleted,
    };
  }

  private async ensurePushTokenTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS user_push_token (
        id_push_token SERIAL PRIMARY KEY,
        id_user INTEGER NOT NULL REFERENCES "user"(id_user) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        platform VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (id_user, token)
      )
    `;

    await this.prisma.$executeRawUnsafe(query);
  }
}
