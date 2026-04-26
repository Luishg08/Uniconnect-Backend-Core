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
      expect(result.data).toEqual([]);
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

  describe('Bug Condition Exploration - Edit Permissions', () => {
    beforeEach(() => {
      // Setup mock for update method
      (prismaService as any).event.findUnique = jest.fn();
      (prismaService as any).event.update = jest.fn();
    });

    /**
     * Property 1: Fault Condition - Validación de Permisos de Edición
     * **Validates: Requirements 1.1, 1.2, 2.1**
     * 
     * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
     * DO NOT attempt to fix the test or code when it fails
     * NOTE: This test encodes the expected behavior - it will validate the fix when it passes after implementation
     * OBJECTIVE: Expose counterexamples that demonstrate the bug exists
     * 
     * Bounded PBT Approach: For this deterministic bug, scope the property to the concrete failing case:
     * admin with id_user=5 editing event with created_by=3
     */
    it('should return 403 when admin tries to edit event created by another admin', async () => {
      // Arrange: Admin with id_user=5 tries to edit event created by admin with id_user=3
      const eventId = '123'; // Valid numeric ID
      const userId = 5; // Admin trying to edit
      const createdBy = 3; // Original creator
      
      const existingEvent = {
        id_event: 123, // Use id_event instead of id
        title: 'Original Event',
        description: 'Original Description',
        date: new Date('2024-03-15'),
        time: '10:00',
        location: 'Room 101',
        type: 'CONFERENCIA',
        created_by: createdBy, // Event created by user 3
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto = {
        title: 'Updated Event',
        description: 'Updated Description',
      };

      (prismaService as any).event.findUnique.mockResolvedValue(existingEvent);

      // Act: Admin (userId=5) attempts to update event created by another admin (created_by=3)
      const result = await service.update(eventId, updateDto, userId, 'admin');

      // Assert: Expected behavior - should return 403 Forbidden
      // EXPECTED RESULT: Test FAILS (this is correct - proves the bug exists)
      // The current code allows the update, but it should return an error
      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(result.error?.message).toBe('Solo puedes editar tus propios eventos');
      
      // Verify that update was NOT called (permission check should prevent it)
      expect((prismaService as any).event.update).not.toHaveBeenCalled();
    });

    it('should allow superadmin to edit any event', async () => {
      // Arrange: Superadmin tries to edit event created by another user
      const eventId = '123'; // Valid numeric ID
      const userId = 10; // Superadmin
      const createdBy = 3; // Original creator
      
      const existingEvent = {
        id_event: 123, // Use id_event instead of id
        title: 'Original Event',
        description: 'Original Description',
        date: new Date('2024-03-15'),
        time: '10:00',
        location: 'Room 101',
        type: 'CONFERENCIA',
        created_by: createdBy, // Event created by user 3
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateDto = {
        title: 'Updated Event',
        description: 'Updated Description',
      };

      const updatedEvent = {
        ...existingEvent,
        ...updateDto,
        creator: {
          id_user: createdBy,
          full_name: 'Original Creator',
          email: 'creator@example.com',
        },
      };

      (prismaService as any).event.findUnique.mockResolvedValue(existingEvent);
      (prismaService as any).event.update.mockResolvedValue(updatedEvent);

      // Act: Superadmin (userId=10) attempts to update event created by another user (created_by=3)
      const result = await service.update(eventId, updateDto, userId, 'superadmin');

      // Assert: Expected behavior - should allow update
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedEvent);
      expect(result.error).toBeNull();
      
      // Verify that update was called
      expect((prismaService as any).event.update).toHaveBeenCalled();
    });
  });

  describe('Preservation Tests - Backend Existing Behaviors', () => {
    beforeEach(() => {
      // Setup mock for update method
      (prismaService as any).event.findUnique = jest.fn();
      (prismaService as any).event.update = jest.fn();
      (prismaService as any).user = {
        findUnique: jest.fn(),
      };
    });

    /**
     * Property 2: Preservation - Comportamientos Backend Existentes
     * **Validates: Requirements 3.1, 3.2, 3.3**
     * 
     * IMPORTANT: Follow observation-first methodology
     * Observe behavior in UNFIXED code for non-buggy inputs
     * Write property-based tests capturing observed behavior patterns
     * 
     * EXPECTED RESULT: Tests PASS (this confirms baseline behavior to preserve)
     * 
     * Behaviors to observe and capture:
     * 1. Students receive 403 when attempting PUT /events/:id (AdminGuard)
     * 2. Admin editing their own event (event.created_by === userId) updates successfully
     * 3. Superadmin editing any event updates successfully
     * 4. Non-existent event returns 404
     * 5. Responses follow FEN format
     */

    describe('Preservation: Non-existent event returns 404', () => {
      it('should return 404 when event does not exist', async () => {
        // Arrange: Event does not exist
        const eventId = '999'; // Valid numeric ID but event doesn't exist
        const userId = 5;
        const updateDto = {
          title: 'Updated Event',
          description: 'Updated Description',
        };

        (prismaService as any).event.findUnique.mockResolvedValue(null);

        // Act
        const result = await service.update(eventId, updateDto, userId, 'admin');

        // Assert: Should return 404 Not Found
        expect(result.success).toBe(false);
        expect(result.error).not.toBeNull();
        expect(result.error?.code).toBe('NOT_FOUND');
        expect(result.error?.message).toBe('Evento no encontrado');
        
        // Verify that update was NOT called
        expect((prismaService as any).event.update).not.toHaveBeenCalled();
      });
    });

    describe('Preservation: Admin editing own event updates successfully', () => {
      it('should allow admin to update their own event', async () => {
        // Arrange: Admin editing their own event
        const eventId = '123'; // Valid numeric ID
        const userId = 5; // Admin
        const createdBy = 5; // Same user
        
        const existingEvent = {
          id_event: 123, // Use id_event instead of id
          title: 'Original Event',
          description: 'Original Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          created_by: createdBy, // Event created by same user
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updateDto = {
          title: 'Updated Event',
          description: 'Updated Description',
        };

        const updatedEvent = {
          ...existingEvent,
          ...updateDto,
          creator: {
            id_user: userId,
            full_name: 'Admin User',
            email: 'admin@example.com',
          },
        };

        (prismaService as any).event.findUnique.mockResolvedValue(existingEvent);
        (prismaService as any).event.update.mockResolvedValue(updatedEvent);

        // Act
        const result = await service.update(eventId, updateDto, userId, 'admin');

        // Assert: Should update successfully
        expect(result.success).toBe(true);
        expect(result.data).toEqual(updatedEvent);
        expect(result.error).toBeNull();
        
        // Verify FEN format
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('total');
        expect(result.metadata).toHaveProperty('page');
        expect(result.metadata).toHaveProperty('timestamp');
        
        // Verify that update was called
        expect((prismaService as any).event.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id_event: 123 }, // Use id_event as integer
            data: expect.objectContaining(updateDto),
          }),
        );
      });
    });

    describe('Preservation: FEN format is maintained', () => {
      it('should maintain FEN format for successful updates', async () => {
        // Arrange
        const eventId = 'event-123';
        const userId = 5;
        
        const existingEvent = {
          id: eventId,
          title: 'Original Event',
          description: 'Original Description',
          date: new Date('2024-03-15'),
          time: '10:00',
          location: 'Room 101',
          type: 'CONFERENCIA',
          created_by: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const updateDto = {
          title: 'Updated Event',
        };

        const updatedEvent = {
          ...existingEvent,
          ...updateDto,
          creator: {
            id_user: userId,
            full_name: 'Admin User',
            email: 'admin@example.com',
          },
        };

        (prismaService as any).event.findUnique.mockResolvedValue(existingEvent);
        (prismaService as any).event.update.mockResolvedValue(updatedEvent);

        // Act
        const result = await service.update(eventId, updateDto, userId, 'admin');

        // Assert: FEN format structure
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('metadata');
        
        // Metadata structure
        expect(result.metadata).toHaveProperty('total');
        expect(result.metadata).toHaveProperty('page');
        expect(result.metadata).toHaveProperty('pageSize');
        expect(result.metadata).toHaveProperty('hasNextPage');
        expect(result.metadata).toHaveProperty('hasPreviousPage');
        expect(result.metadata).toHaveProperty('timestamp');
        
        // Verify timestamp is ISO string
        expect(typeof result.metadata.timestamp).toBe('string');
        expect(() => new Date(result.metadata.timestamp)).not.toThrow();
      });

      it('should maintain FEN format for error responses', async () => {
        // Arrange: Non-existent event
        const eventId = 'non-existent';
        const userId = 5;
        const updateDto = { title: 'Updated' };

        (prismaService as any).event.findUnique.mockResolvedValue(null);

        // Act
        const result = await service.update(eventId, updateDto, userId, 'admin');

        // Assert: FEN format structure for errors
        expect(result).toHaveProperty('success');
        expect(result.success).toBe(false);
        expect(result).toHaveProperty('data');
        expect(result.data).toBeNull();
        expect(result).toHaveProperty('error');
        expect(result.error).not.toBeNull();
        expect(result).toHaveProperty('metadata');
        
        // Error structure
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        
        // Metadata structure
        expect(result.metadata).toHaveProperty('timestamp');
        expect(typeof result.metadata.timestamp).toBe('string');
      });
    });

    describe('Preservation: Property-Based Tests', () => {
      /**
       * Property-based test: Admin can always update their own events
       * This test generates random event data and verifies that admins can update their own events
       */
      it('PBT: Admin can update their own events with any valid data', async () => {
        const fc = require('fast-check');

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 1000 }), // eventId as integer
            fc.integer({ min: 1, max: 1000 }), // userId
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.string({ minLength: 1, maxLength: 500 }),
              location: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            async (eventIdNum, userId, updateDto) => {
              const eventId = eventIdNum.toString(); // Convert to string for API
              // Arrange: Admin editing their own event
              const existingEvent = {
                id_event: eventIdNum, // Use id_event as integer
                title: 'Original Event',
                description: 'Original Description',
                date: new Date('2024-03-15'),
                time: '10:00',
                location: 'Room 101',
                type: 'CONFERENCIA',
                created_by: userId, // Same user
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              const updatedEvent = {
                ...existingEvent,
                ...updateDto,
                creator: {
                  id_user: userId,
                  full_name: 'Admin User',
                  email: 'admin@example.com',
                },
              };

              (prismaService as any).event.findUnique.mockResolvedValue(existingEvent);
              (prismaService as any).event.update.mockResolvedValue(updatedEvent);

              // Act
              const result = await service.update(eventId, updateDto, userId, 'admin');

              // Assert: Should update successfully
              expect(result.success).toBe(true);
              expect(result.data).toBeDefined();
              expect(result.error).toBeNull();
              
              // Verify FEN format
              expect(result).toHaveProperty('metadata');
              expect(result.metadata).toHaveProperty('timestamp');
            },
          ),
          { numRuns: 20 }, // Run 20 random test cases
        );
      });

      /**
       * Property-based test: Non-existent events always return 404
       * This test generates random event IDs and verifies that non-existent events return 404
       */
      it('PBT: Non-existent events always return 404', async () => {
        const fc = require('fast-check');

        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 1000 }), // eventId as integer
            fc.integer({ min: 1, max: 1000 }), // userId
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            async (eventIdNum, userId, updateDto) => {
              const eventId = eventIdNum.toString(); // Convert to string for API
              // Arrange: Event does not exist
              (prismaService as any).event.findUnique.mockResolvedValue(null);

              // Act
              const result = await service.update(eventId, updateDto, userId, 'admin');

              // Assert: Should return 404
              expect(result.success).toBe(false);
              expect(result.error).not.toBeNull();
              expect(result.error?.code).toBe('NOT_FOUND');
              expect(result.error?.message).toBe('Evento no encontrado');
              
              // Verify FEN format
              expect(result).toHaveProperty('metadata');
              expect(result.metadata).toHaveProperty('timestamp');
            },
          ),
          { numRuns: 20 }, // Run 20 random test cases
        );
      });

      /**
       * Property-based test: All responses maintain FEN format
       * This test verifies that both success and error responses maintain the FEN format structure
       */
      it('PBT: All update responses maintain FEN format structure', async () => {
        const fc = require('fast-check');

        await fc.assert(
          fc.asyncProperty(
            fc.uuid(), // eventId
            fc.integer({ min: 1, max: 1000 }), // userId
            fc.boolean(), // eventExists
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            async (eventId, userId, eventExists, updateDto) => {
              // Arrange
              if (eventExists) {
                const existingEvent = {
                  id: eventId,
                  title: 'Original Event',
                  description: 'Original Description',
                  date: new Date('2024-03-15'),
                  time: '10:00',
                  location: 'Room 101',
                  type: 'CONFERENCIA',
                  created_by: userId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                const updatedEvent = {
                  ...existingEvent,
                  ...updateDto,
                  creator: {
                    id_user: userId,
                    full_name: 'Admin User',
                    email: 'admin@example.com',
                  },
                };

                (prismaService as any).event.findUnique.mockResolvedValue(existingEvent);
                (prismaService as any).event.update.mockResolvedValue(updatedEvent);
              } else {
                (prismaService as any).event.findUnique.mockResolvedValue(null);
              }

              // Act
              const result = await service.update(eventId, updateDto, userId, 'admin');

              // Assert: FEN format structure
              expect(result).toHaveProperty('success');
              expect(result).toHaveProperty('data');
              expect(result).toHaveProperty('error');
              expect(result).toHaveProperty('metadata');
              
              // Metadata structure
              expect(result.metadata).toHaveProperty('total');
              expect(result.metadata).toHaveProperty('page');
              expect(result.metadata).toHaveProperty('pageSize');
              expect(result.metadata).toHaveProperty('hasNextPage');
              expect(result.metadata).toHaveProperty('hasPreviousPage');
              expect(result.metadata).toHaveProperty('timestamp');
              
              // Verify timestamp is ISO string
              expect(typeof result.metadata.timestamp).toBe('string');
              expect(() => new Date(result.metadata.timestamp)).not.toThrow();
              
              // Verify success/error consistency
              if (result.success) {
                expect(result.data).not.toBeNull();
                expect(result.error).toBeNull();
              } else {
                expect(result.data).toBeNull();
                expect(result.error).not.toBeNull();
                expect(result.error).toHaveProperty('code');
                expect(result.error).toHaveProperty('message');
              }
            },
          ),
          { numRuns: 30 }, // Run 30 random test cases
        );
      });
    });
  });
});
