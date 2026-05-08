import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ChatGateway } from '../../../messages/infrastructure/gateways/chat.gateway';
import { ChatSessionManager } from '../../../messages/managers/chat-session.manager';
import { INotificacionStrategy, NotificacionDTO, ResultadoEnvio } from './interfaces';

@Injectable()
export class InAppWebSocketStrategy implements INotificacionStrategy {
  readonly canal = 'in_app_websocket';
  private readonly logger = new Logger(InAppWebSocketStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly sessionManager: ChatSessionManager,
  ) {}

  async enviar(notificacion: NotificacionDTO): Promise<ResultadoEnvio> {
    try {
      await this.prisma.notification.create({
        data: {
          id_user: notificacion.id_user,
          message: notificacion.mensaje,
          is_read: false,
          created_at: new Date(),
          related_entity_id: notificacion.entidad_relacionada_id ?? null,
          notification_type: notificacion.tipo_evento,
        },
      });

      const sockets = this.sessionManager.getUserSockets(notificacion.id_user);
      sockets.forEach((socketId) => {
        this.chatGateway.server.to(socketId).emit('notificacion', {
          mensaje: notificacion.mensaje,
          tipo_evento: notificacion.tipo_evento,
          entidad_relacionada_id: notificacion.entidad_relacionada_id,
          timestamp: new Date(),
        });
      });

      this.logger.log(
        `InApp: notificación persistida y emitida a ${sockets.length} socket(s) del usuario ${notificacion.id_user}`,
      );
      return { canal: this.canal, exitoso: true, timestamp: new Date() };
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.error(`InApp: error al enviar notificación: ${mensaje}`);
      return { canal: this.canal, exitoso: false, error: mensaje, timestamp: new Date() };
    }
  }
}
