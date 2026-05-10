import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService, VALIDACION_CHAIN_REST_TOKEN } from './messages.service';
import { MessageRepository } from './message.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MESSAGE_EVENTS } from './events/message.events';
import { createPrismaMock } from '../test/mocks/prisma.mock';
import { PrismaService } from '../prisma/prisma.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let messageRepository: MessageRepository;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: MessageRepository,
          useValue: {
            createWithFiles: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findByGroup: jest.fn(),
            findRecentByGroup: jest.fn(),
            findByMembership: jest.fn(),
            updateIfOwner: jest.fn(),
            markAsEdited: jest.fn(),
            removeIfOwnerOrAdmin: jest.fn(),
            searchInGroup: jest.fn(),
            countByGroup: jest.fn(),
            getLastMessageByGroup: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: VALIDACION_CHAIN_REST_TOKEN,
          useValue: {
            setSiguiente: jest.fn(),
            manejar: jest.fn().mockReturnValue({ valido: true }),
          },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    messageRepository = module.get<MessageRepository>(MessageRepository);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a message and emit event with sender_name and sender_picture', async () => {
      const createMessageDto = {
        id_membership: 1,
        text_content: 'Hola grupo!',
        attachments: null,
        files: [],
      };

      const mockMessage = {
        id_message: 1,
        id_membership: 1,
        text_content: 'Hola grupo!',
        attachments: null,
        send_at: new Date(),
        edited_at: null,
        is_edited: false,
        membership: {
          user: {
            id_user: 1,
            full_name: 'Juan Pérez',
            picture: 'https://example.com/avatar.jpg',
          },
          group: {
            id_group: 1,
            name: 'Grupo Test',
          },
        },
        files: [],
      };

      jest.spyOn(messageRepository, 'createWithFiles').mockResolvedValue(mockMessage as any);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      const result = await service.create(createMessageDto);

      expect(result).toBeDefined();
      expect(messageRepository.createWithFiles).toHaveBeenCalledWith(createMessageDto, []);
      
      // Verificar que el evento fue emitido con sender_name y sender_picture
      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.MESSAGE_SENT,
        expect.objectContaining({
          id_message: 1,
          id_group: 1,
          id_user: 1,
          text_content: 'Hola grupo!',
          sender_name: 'Juan Pérez',
          sender_picture: 'https://example.com/avatar.jpg',
        })
      );
    });

    it('should emit event with sender_picture as null when user has no picture', async () => {
      const createMessageDto = {
        id_membership: 1,
        text_content: 'Hola!',
        attachments: null,
        files: [],
      };

      const mockMessage = {
        id_message: 2,
        id_membership: 1,
        text_content: 'Hola!',
        attachments: null,
        send_at: new Date(),
        edited_at: null,
        is_edited: false,
        membership: {
          user: {
            id_user: 2,
            full_name: 'María García',
            picture: null,
          },
          group: {
            id_group: 1,
            name: 'Grupo Test',
          },
        },
        files: [],
      };

      jest.spyOn(messageRepository, 'createWithFiles').mockResolvedValue(mockMessage as any);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.create(createMessageDto);

      // Verificar que sender_picture es null cuando el usuario no tiene foto
      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.MESSAGE_SENT,
        expect.objectContaining({
          sender_name: 'María García',
          sender_picture: null,
        })
      );
    });

    it('should not emit event when message has no user data', async () => {
      const createMessageDto = {
        id_membership: 1,
        text_content: 'Test',
        attachments: null,
        files: [],
      };

      const mockMessage = {
        id_message: 3,
        id_membership: 1,
        text_content: 'Test',
        attachments: null,
        send_at: new Date(),
        edited_at: null,
        is_edited: false,
        membership: null,
        files: [],
      };

      jest.spyOn(messageRepository, 'createWithFiles').mockResolvedValue(mockMessage as any);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.create(createMessageDto);

      // No debe emitir evento si no hay datos de usuario
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('findByGroup', () => {
    it('should find all messages in a group', async () => {
      jest.spyOn(messageRepository, 'findByGroup').mockResolvedValue([]);

      const result = await service.findByGroup(1);
      expect(Array.isArray(result)).toBe(true);
      expect(messageRepository.findByGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('findRecentByGroup', () => {
    it('should find recent messages in a group', async () => {
      jest.spyOn(messageRepository, 'findRecentByGroup').mockResolvedValue([]);

      const result = await service.findRecentByGroup(1, 50);
      expect(Array.isArray(result)).toBe(true);
      expect(messageRepository.findRecentByGroup).toHaveBeenCalledWith(1, 50, undefined);
    });
  });

  describe('countByGroup', () => {
    it('should count messages in a group', async () => {
      jest.spyOn(messageRepository, 'countByGroup').mockResolvedValue(5);

      const result = await service.countByGroup(1);
      expect(result).toBe(5);
      expect(messageRepository.countByGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('Observer Pattern - Event Emissions', () => {
    const mockMessageWithRelations = {
      id_message: 1,
      text_content: 'Hello',
      send_at: new Date(),
      edited_at: null,
      is_edited: false,
      membership: {
        user: { id_user: 10, full_name: 'Alice', picture: null },
        group: { id_group: 5, name: 'Test Group' },
      },
    };

    it('should emit MESSAGE_SENT after successful message creation', async () => {
      jest.spyOn(messageRepository, 'createWithFiles').mockResolvedValue(mockMessageWithRelations as any);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.create({ id_membership: 1, text_content: 'Hello', files: [] } as any);

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.MESSAGE_SENT,
        expect.objectContaining({ id_message: 1, id_group: 5, id_user: 10 }),
      );
    });

    it('should NOT emit MESSAGE_SENT if create fails', async () => {
      jest.spyOn(messageRepository, 'createWithFiles').mockRejectedValue(new Error('DB Error'));
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await expect(service.create({ id_membership: 1, text_content: 'Hello', files: [] } as any)).rejects.toThrow();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should emit MESSAGE_EDITED after successful edit', async () => {
      jest.spyOn(messageRepository, 'markAsEdited').mockResolvedValue(mockMessageWithRelations as any);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.editMessage(1, 10, 'Updated content');

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.MESSAGE_EDITED,
        expect.objectContaining({ id_message: 1, id_group: 5 }),
      );
    });

    it('should emit MESSAGE_DELETED after successful delete', async () => {
      jest.spyOn(messageRepository, 'findById').mockResolvedValue(mockMessageWithRelations as any);
      jest.spyOn(messageRepository, 'removeIfOwnerOrAdmin').mockResolvedValue(mockMessageWithRelations as any);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.remove(1, 10);

      expect(emitSpy).toHaveBeenCalledWith(
        MESSAGE_EVENTS.MESSAGE_DELETED,
        expect.objectContaining({ id_message: 1, id_group: 5, id_user: 10 }),
      );
    });
  });
});
