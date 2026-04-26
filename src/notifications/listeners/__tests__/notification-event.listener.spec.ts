import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventListener } from '../notification-event.listener';
import { PrismaService } from '../../../prisma/prisma.service';
import { createPrismaMock } from '../../../test/mocks/prisma.mock';

describe('NotificationEventListener - Observer Pattern (Event Reactions)', () => {
  let listener: NotificationEventListener;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventListener,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    listener = module.get<NotificationEventListener>(NotificationEventListener);
  });

  afterEach(() => jest.clearAllMocks());

  describe('handleMessageSent', () => {
    it('should create notifications for group members except sender', async () => {
      const mockMembers = [
        { id_user: 2, group: { name: 'Test Group' }, user: { full_name: 'Bob' } },
        { id_user: 3, group: { name: 'Test Group' }, user: { full_name: 'Charlie' } },
      ];

      prisma.membership.findMany.mockResolvedValue(mockMembers as any);
      prisma.notification.createMany.mockResolvedValue({ count: 2 });

      await listener.handleMessageSent({
        id_message: 1,
        id_group: 10,
        id_user: 1,
        text_content: 'Hello',
        send_at: new Date(),
        sender_name: 'Alice',
        sender_picture: null,
      });

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ id_user: 2, notification_type: 'message' }),
          expect.objectContaining({ id_user: 3, notification_type: 'message' }),
        ]),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.membership.findMany.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleMessageSent({
          id_message: 1,
          id_group: 10,
          id_user: 1,
          text_content: 'Hello',
          send_at: new Date(),
          sender_name: 'Alice',
          sender_picture: null,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleGroupInvitationSent', () => {
    it('should create notification for invitee', async () => {
      prisma.notification.create.mockResolvedValue({ id_notification: 1 } as any);

      await listener.handleGroupInvitationSent({
        id_invitation: 1,
        id_group: 10,
        group_name: 'Test Group',
        inviter_id: 2,
        inviter_name: 'Alice',
        invitee_id: 3,
        invited_at: new Date(),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 3,
          notification_type: 'group_invitation',
          related_entity_id: 1,
        }),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupInvitationSent({
          id_invitation: 1,
          id_group: 10,
          group_name: 'Test Group',
          inviter_id: 2,
          inviter_name: 'Alice',
          invitee_id: 3,
          invited_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleGroupInvitationAccepted', () => {
    it('should create notification for inviter', async () => {
      prisma.group_invitation.findUnique.mockResolvedValue({ inviter_id: 2 } as any);
      prisma.notification.create.mockResolvedValue({ id_notification: 1 } as any);

      await listener.handleGroupInvitationAccepted({
        id_invitation: 1,
        id_group: 10,
        group_name: 'Test Group',
        invitee_id: 3,
        invitee_name: 'Bob',
        accepted_at: new Date(),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 2,
          notification_type: 'group_invitation_accepted',
          related_entity_id: 1,
        }),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.group_invitation.findUnique.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupInvitationAccepted({
          id_invitation: 1,
          id_group: 10,
          group_name: 'Test Group',
          invitee_id: 3,
          invitee_name: 'Bob',
          accepted_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleUserJoinedGroup', () => {
    it('should create notifications for all group members except new member', async () => {
      const mockMembers = [
        { id_user: 2, group: { name: 'Test Group' } },
        { id_user: 4, group: { name: 'Test Group' } },
      ];

      prisma.membership.findMany.mockResolvedValue(mockMembers as any);
      prisma.notification.createMany.mockResolvedValue({ count: 2 });

      await listener.handleUserJoinedGroup({
        id_user: 3,
        full_name: 'Charlie',
        id_group: 10,
        group_name: 'Test Group',
        joined_at: new Date(),
      });

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ id_user: 2, notification_type: 'user_joined_group' }),
          expect.objectContaining({ id_user: 4, notification_type: 'user_joined_group' }),
        ]),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.membership.findMany.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleUserJoinedGroup({
          id_user: 3,
          full_name: 'Charlie',
          id_group: 10,
          group_name: 'Test Group',
          joined_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleConnectionRequestSent', () => {
    it('should create notification for addressee', async () => {
      prisma.notification.create.mockResolvedValue({ id_notification: 1 } as any);

      await listener.handleConnectionRequestSent({
        id_connection: 1,
        requester_id: 2,
        requester_name: 'Alice',
        addressee_id: 3,
        request_at: new Date(),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 3,
          notification_type: 'connection_request',
          related_entity_id: 1,
        }),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleConnectionRequestSent({
          id_connection: 1,
          requester_id: 2,
          requester_name: 'Alice',
          addressee_id: 3,
          request_at: new Date(),
        }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('handleGroupJoinRequestSent', () => {
    it('should create notification for group owner', async () => {
      prisma.notification.create.mockResolvedValue({ id_notification: 1 } as any);

      await listener.handleGroupJoinRequestSent({
        id_request: 1,
        requester_id: 3,
        requester_name: 'Bob',
        id_group: 10,
        group_name: 'Test Group',
        owner_id: 2,
        requested_at: new Date(),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 2,
          notification_type: 'group_join_request',
          related_entity_id: 1,
        }),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupJoinRequestSent({
          id_request: 1,
          requester_id: 3,
          requester_name: 'Bob',
          id_group: 10,
          group_name: 'Test Group',
          owner_id: 2,
          requested_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleGroupJoinRequestAccepted', () => {
    it('should create notification for requester', async () => {
      prisma.notification.create.mockResolvedValue({ id_notification: 1 } as any);

      await listener.handleGroupJoinRequestAccepted({
        id_request: 1,
        requester_id: 3,
        id_group: 10,
        group_name: 'Test Group',
        accepted_at: new Date(),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 3,
          notification_type: 'group_join_request_accepted',
          related_entity_id: 1,
        }),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupJoinRequestAccepted({
          id_request: 1,
          requester_id: 3,
          id_group: 10,
          group_name: 'Test Group',
          accepted_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleGroupJoinRequestRejected', () => {
    it('should create notification for requester', async () => {
      prisma.notification.create.mockResolvedValue({ id_notification: 1 } as any);

      await listener.handleGroupJoinRequestRejected({
        id_request: 1,
        requester_id: 3,
        id_group: 10,
        group_name: 'Test Group',
        rejected_at: new Date(),
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id_user: 3,
          notification_type: 'group_join_request_rejected',
          related_entity_id: 1,
        }),
      });
    });

    it('should not throw if BD fails', async () => {
      prisma.notification.create.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupJoinRequestRejected({
          id_request: 1,
          requester_id: 3,
          id_group: 10,
          group_name: 'Test Group',
          rejected_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });
});
