import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MessagesService', () => {
  let service: MessagesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: PrismaService,
          useValue: {
            message: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a message', async () => {
      const createMessageDto = {
        id_membership: 1,
        text_content: 'Hola grupo!',
        attachments: undefined,
      };

      jest.spyOn(prismaService.message, 'create').mockResolvedValue({
        id_message: 1,
        id_membership: createMessageDto.id_membership,
        text_content: createMessageDto.text_content,
        attachments: null,
        send_at: new Date(),
        edited_at: null,
        is_edited: false,
      });

      const result = await service.create(createMessageDto);
      expect(result).toBeDefined();
      expect(prismaService.message.create).toHaveBeenCalled();
    });
  });

  describe('findByGroup', () => {
    it('should find all messages in a group', async () => {
      jest.spyOn(prismaService.message, 'findMany').mockResolvedValue([]);

      const result = await service.findByGroup(1);
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.message.findMany).toHaveBeenCalled();
    });
  });

  describe('findRecentByGroup', () => {
    it('should find recent messages in a group', async () => {
      jest.spyOn(prismaService.message, 'findMany').mockResolvedValue([]);

      const result = await service.findRecentByGroup(1, 50);
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.message.findMany).toHaveBeenCalled();
    });
  });

  describe('countByGroup', () => {
    it('should count messages in a group', async () => {
      jest.spyOn(prismaService.message, 'count').mockResolvedValue(5);

      const result = await service.countByGroup(1);
      expect(result).toBe(5);
      expect(prismaService.message.count).toHaveBeenCalled();
    });
  });
});
