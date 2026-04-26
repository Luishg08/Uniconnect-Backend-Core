import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from '../messages.gateway';
import { MessagesService } from '../messages.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { MessageReadDto, UserPresenceDto, GroupActivityDto } from '../dto/websocket-message.dto';
import { ChatSessionManager } from '../managers/chat-session.manager';

describe('MessagesGateway - Observer Pattern', () => {
  let gateway: MessagesGateway;
  let server: Server;
  let mockClient: Socket;
  let sessionManager: ChatSessionManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        {
          provide: MessagesService,
          useValue: {
            create: jest.fn(),
            findRecentByGroup: jest.fn(),
            findByGroup: jest.fn(),
            searchInGroup: jest.fn(),
            editMessage: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            membership: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    sessionManager = ChatSessionManager.getInstance();

    // Mock del servidor Socket.IO
    server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    gateway.server = server;

    // Mock del cliente Socket
    mockClient = {
      id: 'test-socket-id',
      data: {
        id_user: 1,
        id_membership: 10,
        id_group: 100,
      },
      join: jest.fn(),
      leave: jest.fn(),
    } as any;

    // Limpiar sesiones antes de cada test
    sessionManager.clearAll();
  });

  afterEach(() => {
    sessionManager.clearAll();
    jest.clearAllMocks();
  });

  describe('message:read handler', () => {
    it('should notify observers when message is read', async () => {
      const readDto: MessageReadDto = {
        id_message: 1,
        id_user: 1,
        read_at: new Date(),
      };

      const result = await gateway.handleMessageRead(mockClient, readDto);

      expect(result).toEqual({ success: true });
      expect(server.to).toHaveBeenCalledWith('group-100');
      expect(server.emit).toHaveBeenCalledWith('message:read', {
        id_message: 1,
        id_user: 1,
        read_at: readDto.read_at,
      });
    });

    it('should return error when user not authenticated', async () => {
      const unauthenticatedClient = {
        ...mockClient,
        data: {},
      } as any;

      const readDto: MessageReadDto = {
        id_message: 1,
        id_user: 1,
        read_at: new Date(),
      };

      const result = await gateway.handleMessageRead(unauthenticatedClient, readDto);

      expect(result).toEqual({ error: 'Usuario no autenticado' });
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('user:presence handler', () => {
    it('should broadcast user presence to group', async () => {
      const presenceData = { status: 'online' as const };

      const result = await gateway.handleUserPresence(mockClient, presenceData);

      expect(result).toEqual({ success: true });
      expect(server.to).toHaveBeenCalledWith('group-100');
      expect(server.emit).toHaveBeenCalledWith('user:presence', {
        id_user: 1,
        status: 'online',
        last_seen: expect.any(Date),
      });
    });

    it('should update presence in ChatSessionManager', async () => {
      const presenceData = { status: 'away' as const };

      await gateway.handleUserPresence(mockClient, presenceData);

      const presence = sessionManager.getUserPresence(1);
      expect(presence).toBe('away');
    });

    it('should throttle presence updates to 5 seconds', async () => {
      const presenceData = { status: 'online' as const };

      // Primera emisión
      const result1 = await gateway.handleUserPresence(mockClient, presenceData);
      expect(result1).toEqual({ success: true });
      expect(server.emit).toHaveBeenCalledTimes(1);

      // Segunda emisión inmediata (debe ser throttled)
      const result2 = await gateway.handleUserPresence(mockClient, presenceData);
      expect(result2).toEqual({ success: true, throttled: true });
      expect(server.emit).toHaveBeenCalledTimes(1); // No debe emitir de nuevo

      // Simular paso de 5 segundos
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 5001);

      // Tercera emisión después de 5 segundos (debe pasar)
      const result3 = await gateway.handleUserPresence(mockClient, presenceData);
      expect(result3).toEqual({ success: true });
      expect(server.emit).toHaveBeenCalledTimes(2);
    });

    it('should return error when user not authenticated', async () => {
      const unauthenticatedClient = {
        ...mockClient,
        data: {},
      } as any;

      const presenceData = { status: 'online' as const };

      const result = await gateway.handleUserPresence(unauthenticatedClient, presenceData);

      expect(result).toEqual({ error: 'Usuario no autenticado' });
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('group:activity handler', () => {
    it('should emit group activity events', async () => {
      const activityDto: GroupActivityDto = {
        id_group: 100,
        activity_type: 'member_joined',
        actor_id: 2,
        actor_name: 'John Doe',
        timestamp: new Date(),
      };

      const result = await gateway.handleGroupActivity(mockClient, activityDto);

      expect(result).toEqual({ success: true });
      expect(server.to).toHaveBeenCalledWith('group-100');
      expect(server.emit).toHaveBeenCalledWith('group:activity', {
        id_group: 100,
        activity_type: 'member_joined',
        actor_id: 2,
        actor_name: 'John Doe',
        timestamp: activityDto.timestamp,
      });
    });

    it('should validate activity_type', async () => {
      const invalidActivityDto = {
        id_group: 100,
        activity_type: 'invalid_type',
        actor_id: 2,
        actor_name: 'John Doe',
        timestamp: new Date(),
      } as any;

      const result = await gateway.handleGroupActivity(mockClient, invalidActivityDto);

      expect(result).toEqual({ error: 'Tipo de actividad inválido' });
      expect(server.to).not.toHaveBeenCalled();
    });

    it('should return error when user not authenticated', async () => {
      const unauthenticatedClient = {
        ...mockClient,
        data: {},
      } as any;

      const activityDto: GroupActivityDto = {
        id_group: 100,
        activity_type: 'member_joined',
        actor_id: 2,
        actor_name: 'John Doe',
        timestamp: new Date(),
      };

      const result = await gateway.handleGroupActivity(unauthenticatedClient, activityDto);

      expect(result).toEqual({ error: 'Usuario no autenticado' });
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect - Observer Pattern', () => {
    it('should set presence to offline on disconnect', async () => {
      // Establecer presencia inicial
      sessionManager.setUserPresence(1, 'online');
      sessionManager.addUserSession({
        socketId: 'test-socket-id',
        userId: 1,
        membershipId: 10,
        groupId: 100,
        connectedAt: new Date(),
      });

      await gateway.handleDisconnect(mockClient);

      expect(server.to).toHaveBeenCalledWith('group-100');
      expect(server.emit).toHaveBeenCalledWith('user:presence', {
        id_user: 1,
        status: 'offline',
        last_seen: expect.any(Date),
      });

      // Verificar que la presencia se estableció a offline
      const presence = sessionManager.getUserPresence(1);
      expect(presence).toBe('offline');
    });
  });

  describe('Observer Pattern - Multiple Observers', () => {
    it('should only notify users in the same group', async () => {
      const readDto: MessageReadDto = {
        id_message: 1,
        id_user: 1,
        read_at: new Date(),
      };

      await gateway.handleMessageRead(mockClient, readDto);

      // Verificar que solo se emite al room del grupo específico
      expect(server.to).toHaveBeenCalledWith('group-100');
      expect(server.to).not.toHaveBeenCalledWith('group-200');
    });

    it('should broadcast to all observers in the group room', async () => {
      // Simular múltiples usuarios en el mismo grupo
      sessionManager.addUserSession({
        socketId: 'socket-1',
        userId: 1,
        groupId: 100,
        connectedAt: new Date(),
      });
      sessionManager.addUserSession({
        socketId: 'socket-2',
        userId: 2,
        groupId: 100,
        connectedAt: new Date(),
      });
      sessionManager.addUserSession({
        socketId: 'socket-3',
        userId: 3,
        groupId: 100,
        connectedAt: new Date(),
      });

      const presenceData = { status: 'online' as const };
      await gateway.handleUserPresence(mockClient, presenceData);

      // Verificar que se emite al room (todos los observadores reciben)
      expect(server.to).toHaveBeenCalledWith('group-100');
      expect(server.emit).toHaveBeenCalledWith('user:presence', expect.any(Object));
    });
  });
});
