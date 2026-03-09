import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { SendMessageDto, MessageEventDto } from './dto/websocket-message.dto';
import { Logger } from '@nestjs/common';
import { SocketData } from './types/SocketData';

@WebSocketGateway({
  cors: {
    origin: '*', // Cambiar esto en producción a tu dominio frontend
    methods: ['GET', 'POST'],
  },
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  server: Server;
  private readonly logger = new Logger(MessagesGateway.name);
  private userSockets: Map<number, string[]> = new Map(); // id_user -> socket ids

  constructor(private messagesService: MessagesService) {}

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('WebSocket initialized');
  }

  /**
   * Cuando un cliente se conecta
   */
  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // El cliente debe enviar su información después de conectarse con 'authenticate'
  }

  /**
   * Cuando un cliente se desconecta
   */
  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Buscar y eliminar el socket del mapa de usuarios
    for (const [userId, socketIds] of this.userSockets.entries()) {
      const index = socketIds.indexOf(client.id);
      if (index > -1) {
        socketIds.splice(index, 1);
        if (socketIds.length === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
  }

  /**
   * Cliente se autentica y se une a un grupo
   * Evento: 'authenticate'
   * Datos: { id_user, id_membership, id_group }
   */
  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id_user: number; id_membership: number; id_group: number },
  ) {
    const socketData: SocketData = {
      id_user: data.id_user,
      id_membership: data.id_membership,
      id_group: data.id_group,
    };

    // Guardar datos en el socket
    Object.assign(client.data, socketData);

    // Agregar socket a mapa de usuarios
    if (!this.userSockets.has(data.id_user)) {
      this.userSockets.set(data.id_user, []);
    }
    this.userSockets.get(data.id_user)!.push(client.id);

    // Unirse a sala del grupo
    const roomName = `group-${data.id_group}`;
    client.join(roomName);

    this.logger.log(
      `User ${data.id_user} joined group ${data.id_group} (room: ${roomName})`,
    );

    // Notificar al grupo que un usuario se conectó
    this.server.to(roomName).emit('user:connected', {
      id_user: data.id_user,
      id_membership: data.id_membership,
      message: 'Usuario conectado',
    });

    return { success: true, message: 'Authenticated' };
  }

  /**
   * Recibir nuevo mensaje en tiempo real
   * Evento: 'message:send'
   * Datos: { id_membership, text_content, attachments? }
   */
  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() createMessageDto: SendMessageDto,
  ) {
    try {
      const id_group = client.data.id_group as number;
      
      this.logger.debug(`handleMessage client.data:`, client.data);
      
      if (!id_group) {
        this.logger.warn(`Usuario no autenticado, id_group: ${id_group}`);
        return { error: 'Usuario no autenticado' };
      }

      // Guardar mensaje en BD
      const message = await this.messagesService.create(createMessageDto);
      const sendAt = message.send_at ?? new Date();

      // Validar que exista el usuario
      if (!message.membership?.user) {
        this.logger.error(
          `Usuario faltante en mensaje ${message.id_message}`,
          { membership: message.membership },
        );
        return { error: 'Error: usuario faltante en la base de datos' };
      }

      // Formatear mensaje para envio a clientes
      const messageEvent: MessageEventDto = {
        id_message: message.id_message,
        id_membership: message.id_membership!,
        text_content: message.text_content || '',
        send_at: sendAt,
        attachments: message.attachments || '',
        user: {
          id_user: message.membership.user.id_user,
          full_name: message.membership.user.full_name!,
          picture: message.membership.user.picture ?? undefined,
        },
        group: {
          id_group: message.membership.group?.id_group ?? id_group,
          name: message.membership.group?.name || 'Grupo',
        },
      };

      // Emitir a todos en la sala (incluyendo el remitente)
      const roomName = `group-${id_group}`;
      this.server.to(roomName).emit('message:new', messageEvent);

      this.logger.log(
        `Message sent to group ${id_group} - User ${client.data.id_user}`,
      );

      return { success: true, message: messageEvent };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      return { error: 'Error al enviar mensaje' };
    }
  }

  /**
   * Editar un mensaje
   * Evento: 'message:edit'
   * Datos: { id_message, text_content }
   */
  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id_message: number; text_content: string },
  ) {
    try {
      const id_group = client.data.id_group as number;

      if (!id_group) {
        return { error: 'Usuario no autenticado' };
      }

      // Actualizar en BD
      const updatedMessage = await this.messagesService.update(data.id_message, {
        text_content: data.text_content,
      });

      const roomName = `group-${id_group}`;
      this.server.to(roomName).emit('message:edited', {
        id_message: updatedMessage.id_message,
        text_content: updatedMessage.text_content,
        send_at: updatedMessage.send_at,
      });

      this.logger.log(`Message ${data.id_message} edited in group ${id_group}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Error editing message:', error);
      return { error: 'Error al editar mensaje' };
    }
  }

  /**
   * Eliminar un mensaje
   * Evento: 'message:delete'
   * Datos: { id_message }
   */
  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id_message: number },
  ) {
    try {
      const id_group = client.data.id_group as number;

      if (!id_group) {
        return { error: 'Usuario no autenticado' };
      }

      // Eliminar de BD
      await this.messagesService.remove(data.id_message);

      const roomName = `group-${id_group}`;
      this.server.to(roomName).emit('message:deleted', {
        id_message: data.id_message,
      });

      this.logger.log(`Message ${data.id_message} deleted in group ${id_group}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      return { error: 'Error al eliminar mensaje' };
    }
  }

  /**
   * Usuario escribiendo (indicador de escritura)
   * Evento: 'user:typing'
   * Datos: { id_user, is_typing }
   */
  @SubscribeMessage('user:typing')
  handleUserTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { is_typing: boolean },
  ) {
    const id_group = client.data.id_group as number;
    const id_user = client.data.id_user as number;

    if (!id_group) {
      return { error: 'Usuario no autenticado' };
    }

    const roomName = `group-${id_group}`;
    this.server.to(roomName).emit('user:typing', {
      id_user,
      is_typing: data.is_typing,
    });

    return { success: true };
  }

  /**
   * Obtener mensajes recientes de un grupo
   * Evento: 'loadMessages'
   * Datos: { id_group, limit }
   */
  @SubscribeMessage('loadMessages')
  async handleLoadMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number } = {},
  ) {
    try {
      const id_group = client.data.id_group as number;

      if (!id_group) {
        return { error: 'Usuario no autenticado' };
      }

      const messages = await this.messagesService.findRecentByGroup(
        id_group,
        data.limit || 50,
      );

      return {
        success: true,
        messages: messages.reverse(), // Más antiguos primero
      };
    } catch (error) {
      this.logger.error('Error loading messages:', error);
      return { error: 'Error al cargar mensajes' };
    }
  }

  /**
   * Método para emitir a un grupo específico desde otras partes del código
   */
  sendMessageToGroup(id_group: number, event: string, data: any) {
    const roomName = `group-${id_group}`;
    this.server.to(roomName).emit(event, data);
  }

  /**
   * Obtener usuarios conectados
   */
  getConnectedUsers(): Map<number, string[]> {
    return this.userSockets;
  }
}
