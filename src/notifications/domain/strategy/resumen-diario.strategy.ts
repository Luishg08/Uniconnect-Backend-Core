import { Injectable, Logger } from '@nestjs/common';
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

  async enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio> {
    try {
      this.logger.log(
        `ResumenDiario: encolando para usuario ${notificacion.id_user} — tipo="${notificacion.tipo_evento}"`,
      );
      // Encolar en sistema de batch (SQS, BullMQ, etc.) para envío posterior
      return { canal: this.canal, exitoso: true, timestamp: new Date() };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`ResumenDiario: error al encolar: ${mensaje}`);
      return { canal: this.canal, exitoso: false, error: mensaje, timestamp: new Date() };
    }
  }
}
