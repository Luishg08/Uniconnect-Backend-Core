import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { INotificacionStrategy, NotificacionDTO, ResultadoEnvio } from './interfaces';

@Injectable()
export class PushMovilStrategy implements INotificacionStrategy {
  readonly canal = 'push_movil';
  private readonly logger = new Logger(PushMovilStrategy.name);

  constructor(private readonly prisma: PrismaService) {}

  async enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio> {
    try {
      const tokens = await this.prisma.push_token.findMany({
        where: { id_user: notificacion.id_user, is_active: true },
        select: { token: true },
      });

      if (tokens.length === 0) {
        this.logger.log(
          `Push: usuario ${notificacion.id_user} sin tokens activos — omitiendo`,
        );
        return { canal: this.canal, exitoso: true, timestamp: new Date() };
      }

      const messages = tokens.map(({ token }) => ({
        to: token,
        title: 'Uniconnect',
        body: notificacion.mensaje,
        sound: 'default',
        data: {
          tipo_evento: notificacion.tipo_evento,
          entidad_relacionada_id: notificacion.entidad_relacionada_id,
          ...notificacion.metadata,
        },
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error(`Expo API respondió con status ${response.status}`);
      }

      this.logger.log(
        `Push: enviado a ${tokens.length} dispositivo(s) del usuario ${notificacion.id_user}`,
      );
      return { canal: this.canal, exitoso: true, timestamp: new Date() };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Push: error al enviar: ${mensaje}`);
      return { canal: this.canal, exitoso: false, error: mensaje, timestamp: new Date() };
    }
  }
}
