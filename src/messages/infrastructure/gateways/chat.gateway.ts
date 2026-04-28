import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

interface AuthenticatePayload {
  token?: string;
  userId?: number;
  userName?: string;
}

interface JoinRoomPayload {
  roomId?: string;
}

/**
 * WebSocket Gateway for real-time chat functionality.
 * Handles client connections, authentication, and room management.
 * Uses socket.data for per-connection state storage.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Handle client authentication.
   * Stores userId and userName in socket.data for per-connection state.
   */
  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AuthenticatePayload,
  ): void {
    try {
      if (data.userId !== undefined) {
        client.data.userId = data.userId;
      }
      if (data.userName !== undefined) {
        client.data.userName = data.userName;
      }
      client.emit('authenticated', { success: true, userId: data.userId });
      this.logger.log(`Client authenticated: ${client.id}, User: ${data.userId}`);
    } catch (error) {
      const err = error as Error;
      client.emit('authenticated', { success: false, error: err.message });
      this.logger.error(`Authentication failed for client ${client.id}: ${err.message}`);
    }
  }

  /**
   * Handle client joining a room.
   * Joins the room directly without requiring prior authentication.
   */
  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomPayload,
  ): void {
    try {
      if (!data.roomId) {
        return;
      }
      client.join(data.roomId);
      client.emit('room_joined', { roomId: data.roomId, success: true });
      this.logger.log(`Client ${client.id} joined room: ${data.roomId}`);
    } catch (error) {
      const err = error as Error;
      client.emit('room_joined', {
        roomId: data.roomId,
        success: false,
        error: err.message,
      });
      this.logger.error(`Join room failed for client ${client.id}: ${err.message}`);
    }
  }

  /**
   * Emit an event to all clients in a specific room.
   * Used by observers to broadcast messages.
   */
  emitToRoom(roomId: string, event: string, data: unknown): void {
    this.server.to(roomId).emit(event, data);
    this.logger.log(`Emitted ${event} to room ${roomId}`);
  }
}
