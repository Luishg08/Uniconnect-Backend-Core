import { Logger } from '@nestjs/common';

/**
 * Interfaz para datos de sesión de usuario
 */
export interface UserSession {
  socketId: string;
  userId: number;
  membershipId?: number;
  groupId?: number;
  connectedAt: Date;
}

/**
 * Singleton para gestionar sesiones de chat en tiempo real
 * Mantiene el estado de conexiones WebSocket de manera centralizada
 */
export class ChatSessionManager {
  private static instance: ChatSessionManager;
  private readonly logger = new Logger(ChatSessionManager.name);

  // Mapeo de usuarios a sus sesiones (sockets)
  private userSessions: Map<number, UserSession[]>;

  // Mapeo de grupos a los sockets que están conectados
  private groupRooms: Map<number, Set<string>>;

  // Mapeo de socketId a userId para búsqueda rápida
  private socketToUser: Map<string, number>;

  private constructor() {
    this.userSessions = new Map();
    this.groupRooms = new Map();
    this.socketToUser = new Map();
    this.logger.log('ChatSessionManager initialized (Singleton)');
  }

  /**
   * Obtiene la instancia única del manager
   */
  public static getInstance(): ChatSessionManager {
    if (!ChatSessionManager.instance) {
      ChatSessionManager.instance = new ChatSessionManager();
    }
    return ChatSessionManager.instance;
  }

  /**
   * Registra una nueva sesión de usuario
   */
  public addUserSession(session: UserSession): void {
    const { userId, socketId } = session;

    // Agregar a mapa de usuarios
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, []);
    }
    this.userSessions.get(userId)!.push(session);

    // Agregar a mapa inverso
    this.socketToUser.set(socketId, userId);

    this.logger.log(
      `User ${userId} connected with socket ${socketId}. Total sessions: ${this.userSessions.get(userId)!.length}`,
    );
  }

  /**
   * Remueve una sesión de usuario por socket ID
   */
  public removeUserSession(socketId: string): void {
    const userId = this.socketToUser.get(socketId);

    if (!userId) {
      this.logger.warn(`Socket ${socketId} not found in session map`);
      return;
    }

    // Remover de userSessions
    const sessions = this.userSessions.get(userId);
    if (sessions) {
      const index = sessions.findIndex((s) => s.socketId === socketId);
      if (index > -1) {
        sessions.splice(index, 1);

        if (sessions.length === 0) {
          this.userSessions.delete(userId);
          this.logger.log(`User ${userId} has no more active sessions`);
        } else {
          this.logger.log(
            `User ${userId} disconnected socket ${socketId}. Remaining sessions: ${sessions.length}`,
          );
        }
      }
    }

    // Remover de socketToUser
    this.socketToUser.delete(socketId);

    // Remover de groupRooms
    for (const [groupId, sockets] of this.groupRooms.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.groupRooms.delete(groupId);
        }
      }
    }
  }

  /**
   * Agrega un socket a una sala de grupo
   */
  public joinGroupRoom(groupId: number, socketId: string): void {
    if (!this.groupRooms.has(groupId)) {
      this.groupRooms.set(groupId, new Set());
    }
    this.groupRooms.get(groupId)!.add(socketId);
    this.logger.log(
      `Socket ${socketId} joined group ${groupId}. Total in room: ${this.groupRooms.get(groupId)!.size}`,
    );
  }

  /**
   * Remueve un socket de una sala de grupo
   */
  public leaveGroupRoom(groupId: number, socketId: string): void {
    const room = this.groupRooms.get(groupId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.groupRooms.delete(groupId);
      }
      this.logger.log(
        `Socket ${socketId} left group ${groupId}. Remaining: ${room.size}`,
      );
    }
  }

  /**
   * Obtiene todos los sockets de un usuario
   */
  public getUserSockets(userId: number): string[] {
    const sessions = this.userSessions.get(userId);
    return sessions ? sessions.map((s) => s.socketId) : [];
  }

  /**
   * Obtiene todos los sockets conectados a un grupo
   */
  public getGroupSockets(groupId: number): string[] {
    const room = this.groupRooms.get(groupId);
    return room ? Array.from(room) : [];
  }

  /**
   * Obtiene la sesión de un usuario por socket ID
   */
  public getSessionBySocket(socketId: string): UserSession | undefined {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return undefined;

    const sessions = this.userSessions.get(userId);
    return sessions?.find((s) => s.socketId === socketId);
  }

  /**
   * Verifica si un usuario está conectado
   */
  public isUserOnline(userId: number): boolean {
    return this.userSessions.has(userId);
  }

  /**
   * Obtiene el número de usuarios conectados
   */
  public getOnlineUsersCount(): number {
    return this.userSessions.size;
  }

  /**
   * Obtiene el número de grupos activos
   */
  public getActiveGroupsCount(): number {
    return this.groupRooms.size;
  }

  /**
   * Obtiene estadísticas del gestor
   */
  public getStats() {
    return {
      onlineUsers: this.getOnlineUsersCount(),
      activeGroups: this.getActiveGroupsCount(),
      totalSockets: this.socketToUser.size,
    };
  }

  /**
   * Limpia todas las sesiones (útil para testing)
   */
  public clearAll(): void {
    this.userSessions.clear();
    this.groupRooms.clear();
    this.socketToUser.clear();
    this.logger.warn('All sessions cleared');
  }
}
