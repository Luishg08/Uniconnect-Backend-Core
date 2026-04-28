import { PersistenceNotificationObserver } from '../persistence-notification.observer';
import { PrismaService } from '../../../../prisma/prisma.service';
import { StudyGroupEvent } from '../../../domain/observer/study-group-event.interface';

describe('PersistenceNotificationObserver', () => {
  let observer: PersistenceNotificationObserver;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    mockPrismaService = {
      notification: {
        create: jest.fn(),
      },
    } as any;

    observer = new PersistenceNotificationObserver(mockPrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should persist notification to database', async () => {
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

    observer.update(event);

    // Wait for async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id_user: 1,
        notification_type: 'join_request',
        related_entity_id: 100,
        is_read: false,
      }),
    });
  });

  it('should handle missing user data gracefully', async () => {
    const event: StudyGroupEvent = {
      type: 'MEMBER_ACCEPTED',
      targetUserId: 999,
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

    expect(() => observer.update(event)).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockPrismaService.notification.create).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const event: StudyGroupEvent = {
      type: 'MEMBER_REJECTED',
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

    mockPrismaService.notification.create.mockRejectedValue(
      new Error('Database error'),
    );

    expect(() => observer.update(event)).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockPrismaService.notification.create).toHaveBeenCalled();
  });

  it('should validate notification type mapping', async () => {
    const events: StudyGroupEvent[] = [
      {
        type: 'JOIN_REQUEST',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'John',
        timestamp: new Date(),
        payload: { id_group: 100, group_name: 'Test Group' },
      },
      {
        type: 'MEMBER_ACCEPTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
        payload: { id_group: 100, group_name: 'Test Group' },
      },
      {
        type: 'MEMBER_REJECTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Admin',
        timestamp: new Date(),
        payload: { id_group: 100, group_name: 'Test Group' },
      },
      {
        type: 'ADMIN_TRANSFER_REQUESTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Owner',
        timestamp: new Date(),
        payload: { id_group: 100, group_name: 'Test Group' },
      },
      {
        type: 'ADMIN_TRANSFER_ACCEPTED',
        targetUserId: 1,
        groupId: 100,
        groupName: 'Test Group',
        actorId: 2,
        actorName: 'Owner',
        timestamp: new Date(),
        payload: { id_group: 100, group_name: 'Test Group', new_owner_name: 'New Owner' },
      },
    ];

    mockPrismaService.notification.create.mockResolvedValue({} as any);

    events.forEach((event) => {
      observer.update(event);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockPrismaService.notification.create).toHaveBeenCalledTimes(5);
    expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notification_type: 'join_request',
        }),
      }),
    );
    expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notification_type: 'member_accepted',
        }),
      }),
    );
  });
});
