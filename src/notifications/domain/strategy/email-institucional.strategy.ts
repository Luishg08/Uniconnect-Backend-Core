import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { INotificacionStrategy, NotificacionDTO, ResultadoEnvio } from './interfaces';

@Injectable()
export class EmailInstitucionalStrategy implements INotificacionStrategy {
  readonly canal = 'email_institucional';
  private readonly logger = new Logger(EmailInstitucionalStrategy.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ email: string }>>`
        SELECT email FROM "user" WHERE id_user = ${notificacion.id_user}
      `;

      if (rows.length === 0 || !rows[0].email) {
        return { canal: this.canal, exitoso: false, error: 'Email no encontrado', timestamp: new Date() };
      }

      const userEmail = rows[0].email;
      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#D9B97E">Uniconnect</h2>
          <p>${notificacion.mensaje}</p>
          <hr style="border:none;border-top:1px solid #eee"/>
          <small style="color:#888">Evento: ${notificacion.tipo_evento}</small>
        </div>`;

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? `"Uniconnect" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: 'Uniconnect — Nueva notificación',
        html,
      });

      this.logger.log(`Email: enviado a ${userEmail} (usuario ${notificacion.id_user})`);
      return { canal: this.canal, exitoso: true, timestamp: new Date() };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email: error al enviar: ${mensaje}`);
      return { canal: this.canal, exitoso: false, error: mensaje, timestamp: new Date() };
    }
  }
}
