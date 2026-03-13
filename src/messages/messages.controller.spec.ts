import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByGroup: jest.fn(),
            findByMembership: jest.fn(),
            findRecentByGroup: jest.fn(),
            countByGroup: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a message', async () => {
      const createMessageDto = {
        id_membership: 1,
        text_content: 'Hola grupo!',
      };

      jest.spyOn(service, 'create').mockResolvedValue({
        id_message: 1,
        ...createMessageDto,
        attachments: null,
        send_at: new Date(),
        membership: null,
        edited_at: null,
        is_edited: false,
        files: [],
      });

      const result = await controller.create(createMessageDto);
      expect(result).toBeDefined();
      expect(service.create).toHaveBeenCalledWith(createMessageDto);
    });
  });

  describe('findByGroup', () => {
    it('should return array of messages from a group', async () => {
      jest.spyOn(service, 'findByGroup').mockResolvedValue([]);

      const result = await controller.findByGroup(1);
      expect(Array.isArray(result)).toBe(true);
      expect(service.findByGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('findRecentByGroup', () => {
    it('should return recent messages from a group', async () => {
      jest.spyOn(service, 'findRecentByGroup').mockResolvedValue([]);

      const result = await controller.findRecentByGroup(1, 50);
      expect(Array.isArray(result)).toBe(true);
      expect(service.findRecentByGroup).toHaveBeenCalledWith(1, 50);
    });
  });
});
