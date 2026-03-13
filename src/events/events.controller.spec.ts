import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { EventType } from './enums/event-type.enum';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service with valid filters', async () => {
      const mockResponse = {
        success: true,
        data: [],
        error: null,
        metadata: {
          total: 0,
          page: 1,
          pageSize: 20,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const filters = {
        date: '2024-03-15',
        type: EventType.CONFERENCIA,
        page: '1',
        pageSize: '20',
      };

      const result = await controller.findAll(filters);

      expect(service.findAll).toHaveBeenCalledWith(
        { date: '2024-03-15', type: EventType.CONFERENCIA },
        {
          page: 1,
          pageSize: 20,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle type filter correctly', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: '1',
            title: 'Conference',
            description: 'Test',
            date: new Date('2024-03-15'),
            time: '10:00',
            location: 'Room 101',
            type: EventType.CONFERENCIA,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        error: null,
        metadata: {
          total: 1,
          page: 1,
          pageSize: 20,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const filters = {
        type: EventType.CONFERENCIA,
        page: '1',
        pageSize: '20',
      };

      const result = await controller.findAll(filters);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.CONFERENCIA,
        }),
        { page: 1, pageSize: 20 },
      );
      expect(result.data?.[0].type).toBe(EventType.CONFERENCIA);
    });

    it('should handle combined date and type filters', async () => {
      const mockResponse = {
        success: true,
        data: [],
        error: null,
        metadata: {
          total: 0,
          page: 1,
          pageSize: 20,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResponse);

      const filters = {
        date: '2024-03-15',
        type: EventType.TALLER,
        page: '1',
        pageSize: '20',
      };

      const result = await controller.findAll(filters);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2024-03-15',
          type: EventType.TALLER,
        }),
        { page: 1, pageSize: 20 },
      );
    });
  });
});
