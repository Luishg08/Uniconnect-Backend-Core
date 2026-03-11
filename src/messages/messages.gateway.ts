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
import { ChatSessionManager } from './managers/chat-session.manager';
import { PrismaService } from '../prisma/prisma.service';

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
  private readonly sessionManager = ChatSessionManager.getInstance();

  constructor(
    private messagesService: MessagesService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('WebSocket initialized');
    this.logger.log(
      `ChatSessionManager stats: ${JSON.stringify(this.sessionManager.getStats())}`,
    );
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
    this.sessionManager.removeUserSession(client.id);
  }

  /**
   * Cliente se autentica y se une a un grupo
   * Evento: 'authenticate'
   * Datos: { id_user, id_group } - id_membership es opcional, se busca automáticamente
   */
  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id_user: number; id_membership?: number; id_group: number },
  ) {
    try {
      let membershipId = data.id_membership;

      // Si no envían id_membership o es 0, buscarlo automáticamente
      if (!membershipId || membershipId === 0) {
        const membership = await this.prisma.membership.findFirst({
          where: {
            id_user: data.id_user,
            id_group: data.id_group,
          },
        });

        if (!membership) {
          this.logger.error(
            `No membership found for user ${data.id_user} in group ${data.id_group}`,
          );
          return {
            success: false,
            error: 'No eres miembro de este grupo',
          };
        }

        membershipId = membership.id_membership;
        this.logger.log(
          `Auto-detected membership ID: ${membershipId} for user ${data.id_user} in group ${data.id_group}`,
        );
      }

      const socketData: SocketData = {
        id_user: data.id_user,
        id_membership: membershipId,
        id_group: data.id_group,
      };

      // Guardar datos en el socket
      Object.assign(client.data, socketData);

      // Agregar sesión al manager (Singleton)
      this.sessionManager.addUserSession({
        socketId: client.id,
        userId: data.id_user,
        membershipId: membershipId,
        groupId: data.id_group,
        connectedAt: new Date(),
      });

      // Unirse a sala del grupo usando el manager
      const roomName = `group-${data.id_group}`;
      client.join(roomName);
      this.sessionManager.joinGroupRoom(data.id_group, client.id);

      this.logger.log(
        `User ${data.id_user} joined group ${data.id_group} with membership ${membershipId} (room: ${roomName})`,
      );

      // Notificar al grupo que un usuario se conectó
      this.server.to(roomName).emit('user:connected', {
        id_user: data.id_user,
        id_membership: membershipId,
        message: 'Usuario conectado',
      });

      return { success: true, message: 'Authenticated', id_membership: membershipId };
    } catch (error) {
      this.logger.error('Error authenticating:', error);
      return {
        success: false,
        error: 'Error al autenticar',
      };
    }
  }

  /**
   * Recibir nuevo mensaje en tiempo real
   * Evento: 'message:send'
   * Datos: { text_content, attachments? }
   * El id_membership se toma de la sesión autenticada
   */
  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text_content: string; attachments?: string },
  ) {
    try {
      const id_group = client.data.id_group as number;
      const id_membership = client.data.id_membership as number;
      const id_user = client.data.id_user as number;
      
      this.logger.debug(`handleMessage client.data:`, client.data);
      
      if (!id_group || !id_membership || !id_user) {
        this.logger.warn(`Usuario no autenticado completamente`, client.data);
        return { error: 'Usuario no autenticado. Llama a authenticate primero.' };
      }

      // Crear DTO con el id_membership correcto de la sesión
      const createMessageDto = {
        id_membership: id_membership,
        text_content: data.text_content,
        attachments: data.attachments || '',
      };

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
      const id_user = client.data.id_user as number;

      if (!id_group || !id_user) {
        return { error: 'Usuario no autenticado' };
      }

      // Editar usando el repository que valida ownership
      const updatedMessage = await this.messagesService.editMessage(
        data.id_message,
        id_user,
        data.text_content,
      );

      if (!updatedMessage) {
        return { error: 'No tienes permiso para editar este mensaje' };
      }

      const roomName = `group-${id_group}`;
      this.server.to(roomName).emit('message:edited', {
        id_message: updatedMessage.id_message,
        text_content: updatedMessage.text_content,
        is_edited: updatedMessage.is_edited,
        edited_at: updatedMessage.edited_at,
      });

      this.logger.log(`Message ${data.id_message} edited in group ${id_group}`);

      return { success: true, message: updatedMessage };
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
      const id_user = client.data.id_user as number;

      if (!id_group || !id_user) {
        return { error: 'Usuario no autenticado' };
      }

      // Eliminar validando permisos (autor o admin)
      await this.messagesService.remove(data.id_message, id_user);

      const roomName = `group-${id_group}`;
      this.server.to(roomName).emit('message:deleted', {
        id_message: data.id_message,
      });

      this.logger.log(`Message ${data.id_message} deleted in group ${id_group}`);

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      return { error: error.message || 'Error al eliminar mensaje' };
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
   * Obtener historial de mensajes con paginación
   * Evento: 'messages:history'
   * Datos: { cursor?, limit? }
   */
  @SubscribeMessage('messages:history')
  async handleMessagesHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cursor?: number; limit?: number } = {},
  ) {
    try {
      const id_group = client.data.id_group as number;

      if (!id_group) {
        return { error: 'Usuario no autenticado' };
      }

      const messages = await this.messagesService.findByGroup(id_group);
      const limit = data.limit || 50;
      const cursor = data.cursor || 0;

      // Paginación simple
      const paginatedMessages = messages.slice(cursor, cursor + limit);
      const hasMore = messages.length > cursor + limit;

      return {
        success: true,
        messages: paginatedMessages,
        cursor: cursor + limit,
        hasMore,
      };
    } catch (error) {
      this.logger.error('Error loading message history:', error);
      return { error: 'Error al cargar historial' };
    }
  }

  /**
   * Salir de un grupo (room)
   * Evento: 'room:leave'
   */
  @SubscribeMessage('room:leave')
  handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const id_group = client.data.id_group as number;

    if (id_group) {
      const roomName = `group-${id_group}`;
      client.leave(roomName);
      this.sessionManager.leaveGroupRoom(id_group, client.id);

      this.logger.log(`User ${client.data.id_user} left group ${id_group}`);

      return { success: true, message: 'Left room' };
    }

    return { error: 'No estás en ningún grupo' };
  }

  /**
   * Buscar mensajes en el grupo
   * Evento: 'messages:search'
   * Datos: { searchTerm }
   */
  @SubscribeMessage('messages:search')
  async handleSearchMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { searchTerm: string },
  ) {
    try {
      const id_group = client.data.id_group as number;

      if (!id_group) {
        return { error: 'Usuario no autenticado' };
      }

      if (!data.searchTerm || data.searchTerm.trim().length < 2) {
        return { error: 'El término de búsqueda debe tener al menos 2 caracteres' };
      }

      const messages = await this.messagesService.searchInGroup(
        id_group,
        data.searchTerm.trim(),
      );

      return {
        success: true,
        messages,
        count: messages.length,
      };
    } catch (error) {
      this.logger.error('Error searching messages:', error);
      return { error: 'Error al buscar mensajes' };
    }
  }

  /**
   * Obtener estadísticas de sesiones
   * Evento: 'session:stats'
   */
  @SubscribeMessage('session:stats')
  handleGetStats(@ConnectedSocket() client: Socket) {
    const stats = this.sessionManager.getStats();
    const id_group = client.data.id_group as number;

    if (id_group) {
      const groupSockets = this.sessionManager.getGroupSockets(id_group);
      return {
        success: true,
        stats,
        currentGroup: {
          id_group,
          connectedUsers: groupSockets.length,
        },
      };
    }

    return { success: true, stats };
  }

  /**
   * Método para emitir a un grupo específico desde otras partes del código
   */
  sendMessageToGroup(id_group: number, event: string, data: any) {
    const roomName = `group-${id_group}`;
    this.server.to(roomName).emit(event, data);
  }

  /**
   * Obtener usuarios conectados en un grupo
   */
  getGroupConnectedUsers(id_group: number): string[] {
    return this.sessionManager.getGroupSockets(id_group);
  }

  /**
   * Verificar si un usuario está online
   */
  isUserOnline(userId: number): boolean {
    return this.sessionManager.isUserOnline(userId);
  }
}
