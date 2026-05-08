import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { INotificacionStrategy, NotificacionDTO, ResultadoEnvio } from './interfaces';

/**
 * Demuestra el principio Open/Closed: canal nuevo sin modificar NotificationsService
 * ni ninguna estrategia existente.
 * Encola notificaciones para un resumen diario por lote.
 */
@Injectable()
export class ResumenDiarioStrategy implements INotificacionStrategy {
  readonly canal = 'resumen_diario';
  private readonly logger = new Logger(ResumenDiarioStrategy.name);

  constructor(private readonly prisma: PrismaService) {}

  async enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio> {
    try {
      await this.prisma.daily_digest_queue.create({
        data: {
          id_user: notificacion.id_user,
          mensaje: notificacion.mensaje,
          tipo_evento: notificacion.tipo_evento ?? null,
        },
      });
      this.logger.log(
        `ResumenDiario: encolado para usuario ${notificacion.id_user} — tipo="${notificacion.tipo_evento}"`,
      );
      return { canal: this.canal, exitoso: true, timestamp: new Date() };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`ResumenDiario: error al encolar: ${mensaje}`);
      return { canal: this.canal, exitoso: false, error: mensaje, timestamp: new Date() };
    }
  }
}
