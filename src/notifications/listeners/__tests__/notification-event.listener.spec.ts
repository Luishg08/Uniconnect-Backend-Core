import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEventListener } from '../notification-event.listener';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications.service';
import { createPrismaMock } from '../../../test/mocks/prisma.mock';

describe('NotificationEventListener - Observer Pattern (Event Reactions)', () => {
  let listener: NotificationEventListener;
  let prisma: ReturnType<typeof createPrismaMock>;
  let notificationsService: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    
    // Mock del NotificationsService
    notificationsService = {
      enviarNotificacion: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventListener,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
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

      await listener.handleMessageSent({
        id_message: 1,
        id_group: 10,
        id_user: 1,
        text_content: 'Hello',
        send_at: new Date(),
        sender_name: 'Alice',
        sender_picture: null,
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledTimes(2);
      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 2,
          tipo_evento: 'message',
          entidad_relacionada_id: 1,
        }),
      );
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
      await listener.handleGroupInvitationSent({
        id_invitation: 1,
        id_group: 10,
        group_name: 'Test Group',
        inviter_id: 2,
        inviter_name: 'Alice',
        invitee_id: 3,
        invited_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 3,
          tipo_evento: 'group_invitation',
          entidad_relacionada_id: 1,
        }),
      );
    });

    it('should not throw if BD fails', async () => {
      notificationsService.enviarNotificacion.mockRejectedValue(new Error('DB Error'));

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

      await listener.handleGroupInvitationAccepted({
        id_invitation: 1,
        id_group: 10,
        group_name: 'Test Group',
        invitee_id: 3,
        invitee_name: 'Bob',
        accepted_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 2,
          tipo_evento: 'group_invitation_accepted',
          entidad_relacionada_id: 1,
        }),
      );
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

      await listener.handleUserJoinedGroup({
        id_user: 3,
        full_name: 'Charlie',
        id_group: 10,
        joined_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledTimes(2);
    });

    it('should not throw if BD fails', async () => {
      prisma.membership.findMany.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleUserJoinedGroup({
          id_user: 3,
          full_name: 'Charlie',
          id_group: 10,
          joined_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleConnectionRequestSent', () => {
    it('should create notification for addressee', async () => {
      await listener.handleConnectionRequestSent({
        id_connection: 1,
        requester_id: 2,
        requester_name: 'Alice',
        addressee_id: 3,
        sent_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 3,
          tipo_evento: 'connection_request',
          entidad_relacionada_id: 1,
        }),
      );
    });

    it('should not throw if BD fails', async () => {
      notificationsService.enviarNotificacion.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleConnectionRequestSent({
          id_connection: 1,
          requester_id: 2,
          requester_name: 'Alice',
          addressee_id: 3,
          sent_at: new Date(),
        }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('handleGroupJoinRequestSent', () => {
    it('should create notification for group owner', async () => {
      await listener.handleGroupJoinRequestSent({
        id_request: 1,
        requester_id: 3,
        requester_name: 'Bob',
        id_group: 10,
        group_name: 'Test Group',
        owner_id: 2,
        requested_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 2,
          tipo_evento: 'group_join_request',
          entidad_relacionada_id: 1,
        }),
      );
    });

    it('should not throw if BD fails', async () => {
      notificationsService.enviarNotificacion.mockRejectedValue(new Error('DB Error'));

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
      await listener.handleGroupJoinRequestAccepted({
        id_request: 1,
        requester_id: 3,
        requester_name: 'Bob',
        id_group: 10,
        group_name: 'Test Group',
        responded_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 3,
          tipo_evento: 'group_join_request_accepted',
          entidad_relacionada_id: 1,
        }),
      );
    });

    it('should not throw if BD fails', async () => {
      notificationsService.enviarNotificacion.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupJoinRequestAccepted({
          id_request: 1,
          requester_id: 3,
          requester_name: 'Bob',
          id_group: 10,
          group_name: 'Test Group',
          responded_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleGroupJoinRequestRejected', () => {
    it('should create notification for requester', async () => {
      await listener.handleGroupJoinRequestRejected({
        id_request: 1,
        requester_id: 3,
        id_group: 10,
        group_name: 'Test Group',
        responded_at: new Date(),
      });

      expect(notificationsService.enviarNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          id_user: 3,
          tipo_evento: 'group_join_request_rejected',
          entidad_relacionada_id: 1,
        }),
      );
    });

    it('should not throw if BD fails', async () => {
      notificationsService.enviarNotificacion.mockRejectedValue(new Error('DB Error'));

      await expect(
        listener.handleGroupJoinRequestRejected({
          id_request: 1,
          requester_id: 3,
          id_group: 10,
          group_name: 'Test Group',
          responded_at: new Date(),
        }),
      ).resolves.not.toThrow();
    });
  });
});
