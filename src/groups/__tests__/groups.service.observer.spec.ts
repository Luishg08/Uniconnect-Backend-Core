import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupsService } from '../groups.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupBusinessValidator } from '../validators/group-business.validator';
import { GroupRepository } from '../repositories/group.repository';
import { MESSAGE_EVENTS } from '../../messages/events/message.events';
import { StudyGroupSubject } from '../domain/observer/study-group-subject';

describe('GroupsService - Observer Pattern (Event Emissions)', () => {
  let service: GroupsService;
  let eventEmitter: EventEmitter2;
  let prismaService: PrismaService;
  let studyGroupSubject: StudyGroupSubject;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: StudyGroupSubject,
          useValue: {
            notify: jest.fn(),
            attach: jest.fn(),
            detach: jest.fn(),
            getObserverCount: jest.fn().mockReturnValue(0),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            group: {
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findUnique: jest.fn(),
            },
            membership: {
              findMany: jest.fn(),
              delete: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            course: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: GroupBusinessValidator,
          useValue: {
            validateMaxGroupsPerCourse: jest.fn(),
            validateCourseEnrollment: jest.fn(),
          },
        },
        {
          provide: GroupRepository,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create - GROUP_CREATED emission', () => {
    it('should emit GROUP_CREATED after successful group creation', async () => {
      const createDto = {
        name: 'Test Group',
        description: 'Test Description',
        id_course: 5,
      };
      const userId = 10;

      const mockGroup = {
        id_group: 1,
        name: 'Test Group',
        owner_id: 10,
        id_course: 5,
        created_at: new Date(),
      };

      const mockUser = { id_user: 10, full_name: 'John Doe' };
      const mockCourse = { id_course: 5, name: 'Math' };

      (prismaService.$transaction as jest.Mock).mockResolvedValue(mockGroup);
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.course.findUnique as jest.Mock).mockResolvedValue(mockCourse);

      await service.create(createDto, userId);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MESSAGE_EVENTS.GROUP_CREATED,
        expect.objectContaining({
          id_group: 1,
          group_name: 'Test Group',
          owner_id: 10,
          owner_name: 'John Doe',
          id_course: 5,
          course_name: 'Math',
          created_at: expect.any(Date),
        }),
      );
    });
  });

  describe('update - GROUP_UPDATED emission', () => {
    it('should emit GROUP_UPDATED after successful group update', async () => {
      const updateDto = {
        name: 'Updated Group',
        description: 'Updated Description',
      };
      const groupId = 1;
      const userId = 10;

      const mockGroup = {
        id_group: 1,
        name: 'Old Group',
        owner_id: 10,
        is_direct_message: false,
      };

      const mockUpdated = {
        id_group: 1,
        name: 'Updated Group',
        description: 'Updated Description',
        owner_id: 10,
        updated_at: new Date(),
      };

      (prismaService.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);
      (prismaService.group.update as jest.Mock).mockResolvedValue(mockUpdated);

      await service.update(groupId, userId, updateDto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MESSAGE_EVENTS.GROUP_UPDATED,
        expect.objectContaining({
          id_group: 1,
          group_name: 'Updated Group',
          owner_id: 10,
          updated_fields: ['name', 'description'],
          updated_at: expect.any(Date),
        }),
      );
    });
  });

  describe('remove - GROUP_DELETED emission', () => {
    it('should emit GROUP_DELETED with member_ids after successful deletion', async () => {
      const groupId = 1;
      const userId = 10;

      const mockGroup = {
        id_group: 1,
        name: 'Test Group',
        owner_id: 10,
      };

      const mockMembers = [
        { id_user: 10 },
        { id_user: 20 },
        { id_user: 30 },
      ];

      (prismaService.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);
      (prismaService.membership.findMany as jest.Mock).mockResolvedValue(mockMembers);
      (prismaService.group.delete as jest.Mock).mockResolvedValue(mockGroup);

      await service.remove(groupId, userId);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MESSAGE_EVENTS.GROUP_DELETED,
        expect.objectContaining({
          id_group: 1,
          group_name: 'Test Group',
          owner_id: 10,
          member_ids: [10, 20, 30],
          deleted_at: expect.any(Date),
        }),
      );
    });
  });

  describe('leaveGroup - USER_LEFT_GROUP emission', () => {
    it('should emit USER_LEFT_GROUP after user successfully leaves', async () => {
      const userId = 20;
      const groupId = 1;

      const mockMembership = {
        id_membership: 5,
        id_user: 20,
        id_group: 1,
        user: { id_user: 20, full_name: 'Jane Doe' },
        group: { id_group: 1, name: 'Test Group', owner_id: 10 },
      };

      (prismaService.membership.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (prismaService.membership.delete as jest.Mock).mockResolvedValue(mockMembership);

      await service.leaveGroup(groupId, userId);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        MESSAGE_EVENTS.USER_LEFT_GROUP,
        expect.objectContaining({
          id_user: 20,
          user_name: 'Jane Doe',
          id_group: 1,
          group_name: 'Test Group',
          left_at: expect.any(Date),
        }),
      );
    });
  });

  describe('event emission timing', () => {
    it('should NOT emit GROUP_CREATED if transaction fails', async () => {
      const createDto = {
        name: 'Test Group',
        id_course: 5,
      };

      (prismaService.$transaction as jest.Mock).mockRejectedValue(
        new Error('DB Error'),
      );

      await expect(service.create(createDto, 10)).rejects.toThrow();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should NOT emit GROUP_UPDATED if update fails', async () => {
      (prismaService.group.update as jest.Mock).mockRejectedValue(
        new Error('DB Error'),
      );

      await expect(service.update(1, 10, { name: 'New Name' })).rejects.toThrow();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
