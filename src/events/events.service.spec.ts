import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventsService', () => {
  let service: EventsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: {
            event: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return events in FEN format', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Test Event',
          description: 'Test Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(1);

      const result = await service.findAll({}, { page: 1, pageSize: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvents);
      expect(result.error).toBeNull();
      expect(result.metadata).toHaveProperty('total');
      expect(result.metadata).toHaveProperty('page');
      expect(result.metadata).toHaveProperty('pageSize');
      expect(result.metadata).toHaveProperty('hasNextPage');
      expect(result.metadata).toHaveProperty('hasPreviousPage');
    });

    it('should return events ordered chronologically', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event 1',
          description: 'Description 1',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          title: 'Event 2',
          description: 'Description 2',
          date: new Date('2024-03-16'),
          time: '11:00',
          location: 'Room 102',
          type: 'TALLER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(2);

      const result = await service.findAll({}, { page: 1, pageSize: 20 });

      expect(result.success).toBe(true);
      expect((prismaService as any).event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'asc' },
        }),
      );
    });

    it('should handle errors and return FEN error format', async () => {
      (prismaService as any).event.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.findAll({}, { page: 1, pageSize: 20 });

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Date Filtering', () => {
    it('should filter by exact date', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event on 2024-03-15',
          description: 'Test Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(1);

      const result = await service.findAll(
        { date: '2024-03-15' },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect((prismaService as any).event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Event 1',
          description: 'Description 1',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          title: 'Event 2',
          description: 'Description 2',
          date: new Date('2024-03-16'),
          time: '11:00',
          location: 'Room 102',
          type: 'TALLER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(2);

      const result = await service.findAll(
        { startDate: '2024-03-15', endDate: '2024-03-16' },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect((prismaService as any).event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should return empty list when no events match date filter', async () => {
      (prismaService as any).event.findMany.mockResolvedValue([]);
      (prismaService as any).event.count.mockResolvedValue(0);

      const result = await service.findAll(
        { date: '2025-12-31' },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });

    it('should return empty list for future date with no events', async () => {
      (prismaService as any).event.findMany.mockResolvedValue([]);
      (prismaService as any).event.count.mockResolvedValue(0);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const result = await service.findAll(
        { date: futureDateStr },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });

    it('should return empty list for date range with no events', async () => {
      (prismaService as any).event.findMany.mockResolvedValue([]);
      (prismaService as any).event.count.mockResolvedValue(0);

      const result = await service.findAll(
        { startDate: '2025-01-01', endDate: '2025-01-31' },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });
  });

  describe('Type Filtering', () => {
    it('should filter by event type CONFERENCIA', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Conference Event',
          description: 'Test Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(1);

      const result = await service.findAll(
        { type: 'CONFERENCIA' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvents);
      expect((prismaService as any).event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'CONFERENCIA',
          }),
        }),
      );
    });

    it('should return empty list when no events match type filter', async () => {
      (prismaService as any).event.findMany.mockResolvedValue([]);
      (prismaService as any).event.count.mockResolvedValue(0);

      const result = await service.findAll(
        { type: 'DEPORTIVO' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });

    it('should filter by combined date and type', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Conference on 2024-03-15',
          description: 'Test Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(1);

      const result = await service.findAll(
        { date: '2024-03-15', type: 'CONFERENCIA' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvents);
      expect((prismaService as any).event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.any(Object),
            type: 'CONFERENCIA',
          }),
        }),
      );
    });
  });

  describe('Combined Filters (AND Logic)', () => {
    it('should apply AND logic when multiple filters are provided', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Conference on 2024-03-15',
          description: 'Test Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(1);

      const result = await service.findAll(
        { date: '2024-03-15', type: 'CONFERENCIA' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvents);
      
      // Verify that both filters are present in the where clause (AND logic)
      const callArgs = (prismaService as any).event.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('date');
      expect(callArgs.where).toHaveProperty('type');
      expect(callArgs.where.type).toBe('CONFERENCIA');
    });

    it('should apply AND logic with date range and type', async () => {
      const mockEvents = [
        {
          id: '1',
          title: 'Conference in range',
          description: 'Test Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'TALLER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prismaService as any).event.findMany.mockResolvedValue(mockEvents);
      (prismaService as any).event.count.mockResolvedValue(1);

      const result = await service.findAll(
        { startDate: '2024-03-10', endDate: '2024-03-20', type: 'TALLER' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvents);
      
      // Verify that both date range and type filters are present (AND logic)
      const callArgs = (prismaService as any).event.findMany.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('date');
      expect(callArgs.where.date).toHaveProperty('gte');
      expect(callArgs.where.date).toHaveProperty('lt');
      expect(callArgs.where).toHaveProperty('type');
      expect(callArgs.where.type).toBe('TALLER');
    });

    it('should return empty list when combined filters have no matches', async () => {
      (prismaService as any).event.findMany.mockResolvedValue([]);
      (prismaService as any).event.count.mockResolvedValue(0);

      const result = await service.findAll(
        { date: '2024-03-15', type: 'DEPORTIVO' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });

    it('should return empty list when date range and type have no matches', async () => {
      (prismaService as any).event.findMany.mockResolvedValue([]);
      (prismaService as any).event.count.mockResolvedValue(0);

      const result = await service.findAll(
        { startDate: '2025-01-01', endDate: '2025-01-31', type: 'CULTURAL' as any },
        { page: 1, pageSize: 20 },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.metadata.total).toBe(0);
    });
  });
});
