import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Middleware para autenticación de WebSocket
 * Valida que el cliente tenga datos de sesión válidos
 */
export class WsAuthMiddleware {
  private static readonly logger = new Logger('WsAuthMiddleware');

  /**
   * Valida que el socket tenga datos de autenticación
   */
  static validateAuth(socket: Socket): boolean {
    const { id_user, id_membership, id_group } = socket.data;

    if (!id_user || !id_membership || !id_group) {
      WsAuthMiddleware.logger.warn(
        `Socket ${socket.id} intenta acceder sin autenticación completa`,
      );
      return false;
    }

    return true;
  }

  /**
   * Middleware para validar pre-autenticación
   */
  static authMiddleware() {
    return (socket: Socket, next: (err?: Error) => void) => {
      // Aquí podrías validar JWT desde query params o headers
      // Por ahora, permitimos la conexión y requerimos authenticate después
      
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (token) {
        // Aquí podrías decodificar y validar el JWT
        // Por ahora lo dejamos pasar
        WsAuthMiddleware.logger.log(`Socket ${socket.id} connecting with token`);
      }

      next();
    };
  }
}
