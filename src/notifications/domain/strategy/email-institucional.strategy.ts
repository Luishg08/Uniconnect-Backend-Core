import { Injectable, Logger } from '@nestjs/common';
import { INotificacionStrategy, NotificacionDTO, ResultadoEnvio } from './interfaces';

@Injectable()
export class EmailInstitucionalStrategy implements INotificacionStrategy {
  readonly canal = 'email_institucional';
  private readonly logger = new Logger(EmailInstitucionalStrategy.name);

  async enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio> {
    try {
      // Placeholder for SMTP/SES integration — replace with real mailer service
      this.logger.log(
        `Email: enviando al usuario ${notificacion.id_user} — tipo="${notificacion.tipo_evento}" mensaje="${notificacion.mensaje}"`,
      );
      return { canal: this.canal, exitoso: true, timestamp: new Date() };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email: error al enviar: ${mensaje}`);
      return { canal: this.canal, exitoso: false, error: mensaje, timestamp: new Date() };
    }
  }
}
