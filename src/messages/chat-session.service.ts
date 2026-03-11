import { Injectable } from '@nestjs/common';

/**
 * Patrón Singleton — NestJS garantiza una sola instancia con Scope.DEFAULT.
 *
 * Responsabilidad: mantener en memoria qué sockets pertenecen a qué usuario,
 * y qué grupos tiene activos cada socket. Esto permite:
 *  - Que el frontend reconecte sin re-cargar historial innecesariamente.
 *  - Que al hacer logout el socket se cierre pero los mensajes ya persistan en BD.
 *  - Que un usuario tenga múltiples grupos/pestañas activos al mismo tiempo.
 */
@Injectable()
export class ChatSessionService {
  /** id_user → Set<socketId> */
  private readonly userSockets = new Map<number, Set<string>>();

  /** socketId → id_user */
  private readonly socketUser = new Map<string, number>();

  /** socketId → Set<id_group> (grupos activos en ese socket) */
  private readonly socketGroups = new Map<string, Set<number>>();

  // ── Registro de conexión ──────────────────────────────────────────────────

  registerSocket(socketId: string, userId: number): void {
    this.socketUser.set(socketId, userId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    if (!this.socketGroups.has(socketId)) {
      this.socketGroups.set(socketId, new Set());
    }
  }

  removeSocket(socketId: string): void {
    const userId = this.socketUser.get(socketId);
    if (userId !== undefined) {
      this.userSockets.get(userId)?.delete(socketId);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.socketUser.delete(socketId);
    this.socketGroups.delete(socketId);
  }

  // ── Gestión de grupos por socket ─────────────────────────────────────────

  joinGroup(socketId: string, groupId: number): void {
    if (!this.socketGroups.has(socketId)) {
      this.socketGroups.set(socketId, new Set());
    }
    this.socketGroups.get(socketId)!.add(groupId);
  }

  leaveGroup(socketId: string, groupId: number): void {
    this.socketGroups.get(socketId)?.delete(groupId);
  }

  /** ¿El socket tiene ese grupo activo (join autenticado)? */
  isInGroup(socketId: string, groupId: number): boolean {
    return this.socketGroups.get(socketId)?.has(groupId) ?? false;
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  getUserIdBySocket(socketId: string): number | undefined {
    return this.socketUser.get(socketId);
  }

  getSocketsByUser(userId: number): Set<string> {
    return this.userSockets.get(userId) ?? new Set();
  }

  isUserOnline(userId: number): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }
}
