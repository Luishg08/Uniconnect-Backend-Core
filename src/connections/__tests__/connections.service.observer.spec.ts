import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConnectionsService } from '../connections.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGE_EVENTS } from '../../messages/events/message.events';
import { createPrismaMock } from '../../test/mocks/prisma.mock';
import { createEventEmitterMock } from '../../test/mocks/event-emitter.mock';

describe('ConnectionsService - Observer Pattern (Event Emissions)', () => {
  let service: ConnectionsService;
  let eventEmitter: EventEmitter2;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const emitterMock = createEventEmitterMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: emitterMock },
      ],
    }).compile();

    service = module.get<ConnectionsService>(ConnectionsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendConnectionRequest - CONNECTION_REQUEST_SENT', () => {
    it('should emit CONNECTION_REQUEST_SENT after successful connection request', async () => {
      const mockConnection = {
        id_connection: 1,
        requester_id: 10,
        adressee_id: 20,
        status: 'pending',
        request_at: new Date(),
        requester: { id_user: 10, full_name: 'Alice', picture: null },
      };

      prisma.connection.findFirst.mockResolvedValue(null);
      prisma.connection.create.mockResolvedValue(mockConnection);

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.sendConnectionRequest(10, 20);

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.CONNECTION_REQUEST_SENT,
        expect.objectContaining({
          id_connection: 1,
          requester_id: 10,
          addressee_id: 20,
        }),
      );
    });

    it('should NOT emit if BD operation fails', async () => {
      prisma.connection.findFirst.mockResolvedValue(null);
      prisma.connection.create.mockRejectedValue(new Error('DB Error'));

      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await expect(service.sendConnectionRequest(10, 20)).rejects.toThrow();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
