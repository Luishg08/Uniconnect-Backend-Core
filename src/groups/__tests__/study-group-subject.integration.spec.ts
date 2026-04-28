import { StudyGroupSubject } from '../domain/observer/study-group-subject';
import { WebSocketNotificationObserver } from '../infrastructure/observers/websocket-notification.observer';
import { PersistenceNotificationObserver } from '../infrastructure/observers/persistence-notification.observer';
import { ChatGateway } from '../../messages/infrastructure/gateways/chat.gateway';
import { ChatSessionManager } from '../../messages/managers/chat-session.manager';
import { PrismaService } from '../../prisma/prisma.service';
import { StudyGroupEvent } from '../domain/observer/study-group-event.interface';

describe('StudyGroupSubject - Integration Tests', () => {
  let studyGroupSubject: StudyGroupSubject;
  let websocketObserver: WebSocketNotificationObserver;
  let persistenceObserver: PersistenceNotificationObserver;
  let mockChatGateway: jest.Mocked<ChatGateway>;
  let mockSessionManager: jest.Mocked<ChatSessionManager>;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockChatGateway = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    } as any;

    mockSessionManager = {
      getUserSockets: jest.fn(),
    } as any;

    mockPrismaService = {
      notification: {
        create: jest.fn(),
      },
    } as any;

    studyGroupSubject = new StudyGroupSubject();
    websocketObserver = new WebSocketNotificationObserver(
      mockChatGateway,
      mockSessionManager,
    );
    persistenceObserver = new PersistenceNotificationObserver(
      mockPrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Subject + WebSocketObserver', () => {
    it('should notify WebSocket observer on JOIN_REQUEST', () => {
      studyGroupSubject.attach(websocketObserver);

      const event: StudyGroupEvent = {
        type: 'JOIN_REQUEST',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'John Doe',
        timestamp: new Date(),
        payload: {
          id_group: 100,
          group_name: 'Test Group',
          requester_name: 'John Doe',
        },
      };

      mockSessionManager.getUserSockets.mockReturnValue(['socket-1']);

      studyGroupSubject.notify(event);

      expect(mockSessionManager.getUserSockets).toHaveBeenCalledWith(1);
      expect(mockChatGateway.server.to).toHaveBeenCalledWith('socket-1');
      expect(mockChatGateway.server.emit).toHaveBeenCalledWith(
        'study_group_notification',
        event,
      );
    });

    it('should notify WebSocket observer on MEMBER_ACCEPTED', () => {
      studyGroupSubject.attach(websocketObserver);

      const event: StudyGroupEvent = {
        type: 'MEMBER_ACCEPTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
        payload: {
          id_group: 100,
          group_name: 'Test Group',
        },
      };

      mockSessionManager.getUserSockets.mockReturnValue(['socket-1', 'socket-2']);

      studyGroupSubject.notify(event);

      expect(mockSessionManager.getUserSockets).toHaveBeenCalledWith(1);
      expect(mockChatGateway.server.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Subject + PersistenceObserver', () => {
    it('should notify Persistence observer on JOIN_REQUEST', async () => {
      studyGroupSubject.attach(persistenceObserver);

      const event: StudyGroupEvent = {
        type: 'JOIN_REQUEST',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'John Doe',
        timestamp: new Date(),
        payload: {
          id_group: 100,
          group_name: 'Test Group',
          requester_name: 'John Doe',
        },
      };

      mockPrismaService.notification.create.mockResolvedValue({
        id_notification: 1,
        id_user: 1,
        message: "John Doe solicitó unirse al grupo 'Test Group'",
        is_read: false,
        created_at: new Date(),
        notification_type: 'join_request',
        related_entity_id: 100,
        push_sent: false,
      });

      studyGroupSubject.notify(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 1,
          notification_type: 'join_request',
          related_entity_id: 100,
        }),
      });
    });

    it('should notify Persistence observer on MEMBER_ACCEPTED', async () => {
      studyGroupSubject.attach(persistenceObserver);

      const event: StudyGroupEvent = {
        type: 'MEMBER_ACCEPTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
        payload: {
          id_group: 100,
          group_name: 'Test Group',
        },
      };

      mockPrismaService.notification.create.mockResolvedValue({} as any);

      studyGroupSubject.notify(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 1,
          notification_type: 'member_accepted',
        }),
      });
    });
  });

  describe('Multiple Observers', () => {
    it('should notify both observers simultaneously', async () => {
      studyGroupSubject.attach(websocketObserver);
      studyGroupSubject.attach(persistenceObserver);

      const event: StudyGroupEvent = {
        type: 'MEMBER_ACCEPTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
        payload: {
          id_group: 100,
          group_name: 'Test Group',
        },
      };

      mockSessionManager.getUserSockets.mockReturnValue(['socket-1']);
      mockPrismaService.notification.create.mockResolvedValue({} as any);

      studyGroupSubject.notify(event);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockChatGateway.server.emit).toHaveBeenCalled();
      expect(mockPrismaService.notification.create).toHaveBeenCalled();
    });

    it('should isolate errors between observers', async () => {
      mockChatGateway.server.emit.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      studyGroupSubject.attach(websocketObserver);
      studyGroupSubject.attach(persistenceObserver);

      const event: StudyGroupEvent = {
        type: 'JOIN_REQUEST',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'John Doe',
        timestamp: new Date(),
        payload: {
          id_group: 100,
          group_name: 'Test Group',
          requester_name: 'John Doe',
        },
      };

      mockSessionManager.getUserSockets.mockReturnValue(['socket-1']);
      mockPrismaService.notification.create.mockResolvedValue({} as any);

      expect(() => studyGroupSubject.notify(event)).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPrismaService.notification.create).toHaveBeenCalled();
    });
  });
});
