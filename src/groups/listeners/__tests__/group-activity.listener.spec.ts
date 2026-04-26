import { Test, TestingModule } from '@nestjs/testing';
import { GroupActivityListener } from '../group-activity.listener';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  GroupCreatedPayload,
  GroupUpdatedPayload,
  GroupDeletedPayload,
  UserLeftGroupPayload,
} from '../../../messages/events/message.events';

describe('GroupActivityListener - Observer Pattern', () => {
  let listener: GroupActivityListener;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupActivityListener,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              createMany: jest.fn(),
            },
            membership: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    listener = module.get<GroupActivityListener>(GroupActivityListener);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleGroupCreated', () => {
    it('should create notification for owner on GROUP_CREATED', async () => {
      const payload: GroupCreatedPayload = {
        id_group: 1,
        group_name: 'Test Group',
        owner_id: 10,
        owner_name: 'John Doe',
        id_course: 5,
        course_name: 'Math',
        created_at: new Date(),
      };

      await listener.handleGroupCreated(payload);

      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          id_user: 10,
          message: "Grupo 'Test Group' creado exitosamente",
          is_read: false,
          created_at: expect.any(Date),
          related_entity_id: 1,
          notification_type: 'group_created',
        },
      });
    });
  });

  describe('handleGroupUpdated', () => {
    it('should create notifications for members on GROUP_UPDATED', async () => {
      const payload: GroupUpdatedPayload = {
        id_group: 1,
        group_name: 'Test Group',
        owner_id: 10,
        updated_fields: ['name'],
        updated_at: new Date(),
      };

      (prismaService.membership.findMany as jest.Mock).mockResolvedValue([
        { id_user: 20 },
        { id_user: 30 },
      ]);

      await listener.handleGroupUpdated(payload);

      expect(prismaService.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id_user: 20,
            message: "El grupo 'Test Group' fue actualizado",
            notification_type: 'group_updated',
          }),
          expect.objectContaining({
            id_user: 30,
            message: "El grupo 'Test Group' fue actualizado",
            notification_type: 'group_updated',
          }),
        ]),
      });
    });
  });

  describe('handleGroupDeleted', () => {
    it('should create notifications for members on GROUP_DELETED', async () => {
      const payload: GroupDeletedPayload = {
        id_group: 1,
        group_name: 'Test Group',
        owner_id: 10,
        member_ids: [10, 20, 30],
        deleted_at: new Date(),
      };

      await listener.handleGroupDeleted(payload);

      expect(prismaService.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            id_user: 10,
            message: "El grupo 'Test Group' fue eliminado",
            notification_type: 'group_deleted',
          }),
        ]),
      });
    });
  });

  describe('handleUserLeftGroup', () => {
    it('should create notifications for remaining members on USER_LEFT_GROUP', async () => {
      const payload: UserLeftGroupPayload = {
        id_user: 20,
        user_name: 'Jane Doe',
        id_group: 1,
        group_name: 'Test Group',
        left_at: new Date(),
      };

      (prismaService.membership.findMany as jest.Mock).mockResolvedValue([
        { id_user: 10 },
        { id_user: 30 },
      ]);

      await listener.handleUserLeftGroup(payload);

      expect(prismaService.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            message: "Jane Doe salió del grupo 'Test Group'",
            notification_type: 'user_left_group',
          }),
        ]),
      });
    });
  });

  describe('error handling', () => {
    it('should log error but not throw when notification creation fails', async () => {
      const payload: GroupCreatedPayload = {
        id_group: 1,
        group_name: 'Test Group',
        owner_id: 10,
        owner_name: 'John Doe',
        id_course: 5,
        course_name: 'Math',
        created_at: new Date(),
      };

      (prismaService.notification.create as jest.Mock).mockRejectedValue(
        new Error('DB Error'),
      );

      // Should not throw
      await expect(listener.handleGroupCreated(payload)).resolves.not.toThrow();
    });
  });
});
