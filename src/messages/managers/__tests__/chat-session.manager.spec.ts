import { ChatSessionManager } from '../chat-session.manager';

describe('ChatSessionManager - Presence Management', () => {
  let manager: ChatSessionManager;

  beforeEach(() => {
    manager = ChatSessionManager.getInstance();
    manager.clearAll();
  });

  afterEach(() => {
    manager.clearAll();
  });

  describe('setUserPresence and getUserPresence', () => {
    it('should set and get user presence', () => {
      manager.setUserPresence(1, 'online');

      const presence = manager.getUserPresence(1);
      expect(presence).toBe('online');
    });

    it('should update user presence', () => {
      manager.setUserPresence(1, 'online');
      manager.setUserPresence(1, 'away');

      const presence = manager.getUserPresence(1);
      expect(presence).toBe('away');
    });

    it('should return null for non-existent user presence', () => {
      const presence = manager.getUserPresence(999);
      expect(presence).toBeNull();
    });

    it('should handle all presence states', () => {
      manager.setUserPresence(1, 'online');
      manager.setUserPresence(2, 'offline');
      manager.setUserPresence(3, 'away');

      expect(manager.getUserPresence(1)).toBe('online');
      expect(manager.getUserPresence(2)).toBe('offline');
      expect(manager.getUserPresence(3)).toBe('away');
    });
  });

  describe('getGroupPresences', () => {
    it('should get all presences for a group', () => {
      // Agregar usuarios al grupo
      manager.addUserSession({
        socketId: 'socket-1',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });
      manager.addUserSession({
        socketId: 'socket-2',
        userId: 2,
        groupId: 100,
        connectedAt: new Date(),
      });
      manager.addUserSession({
        socketId: 'socket-3',
        userId: 3,
        groupId: 100,
        connectedAt: new Date(),
      });

      manager.joinGroupRoom(100, 'socket-1');
      manager.joinGroupRoom(100, 'socket-2');
      manager.joinGroupRoom(100, 'socket-3');

      // Establecer presencias
      manager.setUserPresence(1, 'online');
      manager.setUserPresence(2, 'away');
      manager.setUserPresence(3, 'offline');

      const presences = manager.getGroupPresences(100);

      expect(presences.size).toBe(3);
      expect(presences.get(1)).toBe('online');
      expect(presences.get(2)).toBe('away');
      expect(presences.get(3)).toBe('offline');
    });

    it('should return empty map for group with no users', () => {
      const presences = manager.getGroupPresences(999);
      expect(presences.size).toBe(0);
    });

    it('should only include users with presence set', () => {
      manager.addUserSession({
        socketId: 'socket-1',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });
      manager.addUserSession({
        socketId: 'socket-2',
        userId: 2,
        groupId: 100,
        connectedAt: new Date(),
      });

      manager.joinGroupRoom(100, 'socket-1');
      manager.joinGroupRoom(100, 'socket-2');

      // Solo establecer presencia para usuario 1
      manager.setUserPresence(1, 'online');

      const presences = manager.getGroupPresences(100);

      expect(presences.size).toBe(1);
      expect(presences.get(1)).toBe('online');
      expect(presences.has(2)).toBe(false);
    });
  });

  describe('removeUserSession - Presence Integration', () => {
    it('should set presence to offline on removeUserSession', () => {
      manager.addUserSession({
        socketId: 'socket-1',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });

      manager.setUserPresence(1, 'online');

      // Remover sesión
      manager.removeUserSession('socket-1');

      // Verificar que la presencia se estableció a offline
      const presence = manager.getUserPresence(1);
      expect(presence).toBe('offline');
    });

    it('should not change presence if user has multiple sessions', () => {
      // Usuario con 2 sesiones
      manager.addUserSession({
        socketId: 'socket-1',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });
      manager.addUserSession({
        socketId: 'socket-2',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });

      manager.setUserPresence(1, 'online');

      // Remover solo una sesión
      manager.removeUserSession('socket-1');

      // La presencia debe seguir siendo online (aún tiene sesión activa)
      const presence = manager.getUserPresence(1);
      expect(presence).toBe('online');
    });

    it('should set presence to offline when last session is removed', () => {
      // Usuario con 2 sesiones
      manager.addUserSession({
        socketId: 'socket-1',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });
      manager.addUserSession({
        socketId: 'socket-2',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });

      manager.setUserPresence(1, 'online');

      // Remover ambas sesiones
      manager.removeUserSession('socket-1');
      manager.removeUserSession('socket-2');

      // La presencia debe ser offline
      const presence = manager.getUserPresence(1);
      expect(presence).toBe('offline');
    });
  });

  describe('clearAll - Presence Integration', () => {
    it('should clear all presences when clearAll is called', () => {
      manager.setUserPresence(1, 'online');
      manager.setUserPresence(2, 'away');
      manager.setUserPresence(3, 'offline');

      manager.clearAll();

      expect(manager.getUserPresence(1)).toBeNull();
      expect(manager.getUserPresence(2)).toBeNull();
      expect(manager.getUserPresence(3)).toBeNull();
    });
  });
});
