import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupInvitationsService } from '../group-invitations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupBusinessValidator } from '../../groups/validators/group-business.validator';
import { MESSAGE_EVENTS } from '../../messages/events/message.events';
import { createPrismaMock } from '../../test/mocks/prisma.mock';
import { createEventEmitterMock } from '../../test/mocks/event-emitter.mock';

describe('GroupInvitationsService - Observer Pattern (Event Emissions)', () => {
  let service: GroupInvitationsService;
  let eventEmitter: EventEmitter2;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const emitterMock = createEventEmitterMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: emitterMock },
        {
          provide: GroupBusinessValidator,
          useValue: {
            validateMaxGroupsPerCourse: jest.fn(),
            validateCourseEnrollment: jest.fn(),
            validateAdminInvitation: jest.fn(),
            validateInviteeEnrollment: jest.fn(),
            validateNotAlreadyMember: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GroupInvitationsService>(GroupInvitationsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendInvitation - GROUP_INVITATION_SENT', () => {
    it('should emit GROUP_INVITATION_SENT after successful invitation creation', async () => {
      const mockInvitation = {
        id_invitation: 1,
        id_group: 10,
        inviter_id: 2,
        invitee_id: 3,
        status: 'pending',
        invited_at: new Date(),
        group: { id_group: 10, name: 'Test Group', course: { name: 'Math' } },
        inviter: { id_user: 2, full_name: 'Alice', picture: null },
      };

      prisma.group_invitation.upsert.mockResolvedValue(mockInvitation);

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.sendInvitation({ id_group: 10, inviter_id: 2, invitee_id: 3 });

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.GROUP_INVITATION_SENT,
        expect.objectContaining({
          id_invitation: 1,
          id_group: 10,
          inviter_id: 2,
          invitee_id: 3,
        }),
      );
    });

    it('should NOT emit if BD operation fails', async () => {
      prisma.group_invitation.upsert.mockRejectedValue(new Error('DB Error'));

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await expect(service.sendInvitation({ id_group: 10, inviter_id: 2, invitee_id: 3 })).rejects.toThrow();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('respondToInvitation - accepted', () => {
    it('should emit GROUP_INVITATION_ACCEPTED and USER_JOINED_GROUP on accept', async () => {
      const mockInvitation = {
        id_invitation: 1,
        id_group: 10,
        inviter_id: 2,
        invitee_id: 3,
        status: 'pending',
        group: { name: 'Test Group' },
      };
      const mockMembership = {
        id_membership: 5,
        id_user: 3,
        id_group: 10,
        user: { full_name: 'Bob' },
      };

      prisma.group_invitation.findUnique.mockResolvedValue(mockInvitation);
      prisma.membership.findFirst.mockResolvedValue(null);
      prisma.group_invitation.update.mockResolvedValue({ ...mockInvitation, status: 'accepted' });
      prisma.membership.create.mockResolvedValue(mockMembership);
      prisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        return Promise.all(ops.map((op) => (op instanceof Promise ? op : Promise.resolve(op))));
      });

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.respondToInvitation(1, 3, { status: 'accepted' });

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.GROUP_INVITATION_ACCEPTED,
        expect.objectContaining({ id_invitation: 1, id_group: 10 }),
      );
      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.USER_JOINED_GROUP,
        expect.objectContaining({ id_user: 3, id_group: 10 }),
      );
    });
  });

  describe('respondToInvitation - rejected', () => {
    it('should emit GROUP_INVITATION_REJECTED and NOT emit USER_JOINED_GROUP on reject', async () => {
      const mockInvitation = {
        id_invitation: 1,
        id_group: 10,
        inviter_id: 2,
        invitee_id: 3,
        status: 'pending',
        group: { name: 'Test Group' },
      };

      prisma.group_invitation.findUnique.mockResolvedValue(mockInvitation);
      prisma.membership.findFirst.mockResolvedValue(null);
      prisma.group_invitation.update.mockResolvedValue({ ...mockInvitation, status: 'rejected' });

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.respondToInvitation(1, 3, { status: 'rejected' });

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.GROUP_INVITATION_REJECTED,
        expect.objectContaining({ id_invitation: 1, id_group: 10 }),
      );
      expect(emitSpy).not.toHaveBeenCalledWith(
        MESSAGE_EVENTS.USER_JOINED_GROUP,
        expect.anything(),
      );
    });
  });
});
