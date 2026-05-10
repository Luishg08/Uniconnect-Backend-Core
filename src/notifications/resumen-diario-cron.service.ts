import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResumenDiarioCronService {
  private readonly logger = new Logger(ResumenDiarioCronService.name);
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

  @Cron('0 8 * * *')
  async enviarResumenesDiarios(): Promise<void> {
    this.logger.log('Iniciando envío de resúmenes diarios...');

    const pendientes = await this.prisma.daily_digest_queue.findMany({
      where: { sent: false },
      orderBy: [{ id_user: 'asc' }, { created_at: 'asc' }],
    });

    if (pendientes.length === 0) {
      this.logger.log('Sin notificaciones pendientes para el resumen diario.');
      return;
    }

    const porUsuario = new Map<number, typeof pendientes>();
    for (const row of pendientes) {
      const lista = porUsuario.get(row.id_user) ?? [];
      lista.push(row);
      porUsuario.set(row.id_user, lista);
    }

    for (const [userId, items] of porUsuario) {
      const userRecord = await this.prisma.user.findUnique({
        where: { id_user: userId },
        select: { email: true },
      });

      if (!userRecord?.email) {
        this.logger.warn(`ResumenDiario: usuario ${userId} sin email — omitiendo`);
        continue;
      }

      const itemsHtml = items
        .map(
          (n) =>
            `<li style="margin-bottom:8px">
              <strong>${n.tipo_evento ?? 'Notificación'}</strong>: ${n.mensaje}
            </li>`,
        )
        .join('');

      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#D9B97E">Uniconnect — Resumen diario</h2>
          <p>Tienes <strong>${items.length}</strong> notificación(es) pendiente(s):</p>
          <ul style="padding-left:20px">${itemsHtml}</ul>
          <hr style="border:none;border-top:1px solid #eee"/>
          <small style="color:#888">Este es un resumen automático de Uniconnect.</small>
        </div>`;

      try {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM ?? `"Uniconnect" <${process.env.SMTP_USER}>`,
          to: userRecord.email,
          subject: `Uniconnect — ${items.length} notificación(es) pendiente(s)`,
          html,
        });

        await this.prisma.daily_digest_queue.updateMany({
          where: { id: { in: items.map((n) => n.id) } },
          data: { sent: true },
        });

        this.logger.log(`ResumenDiario: enviado a ${userRecord.email} con ${items.length} item(s)`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`ResumenDiario: error enviando a usuario ${userId}: ${msg}`);
      }
    }
  }
}
