import { MessagesService } from '../application/messages.service';
import { ChatSubject } from '../domain/observer/chat-subject';
import { PrivateChatObserver } from '../infrastructure/observers/private-chat.observer';
import { GroupChatObserver } from '../infrastructure/observers/group-chat.observer';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageDto } from '../dto/message.dto';

describe('MessagesService (US-O02)', () => {
  let service: MessagesService;
  let chatSubject: ChatSubject;
  let privateChatObserver: PrivateChatObserver;
  let groupChatObserver: GroupChatObserver;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prismaService = {
      message: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    chatSubject = new ChatSubject();
    privateChatObserver = { update: jest.fn() } as any;
    groupChatObserver = { update: jest.fn() } as any;

    const validacionChainMock = {
      setSiguiente: jest.fn(),
      manejar: jest.fn().mockReturnValue({ valido: true }),
    };

    service = new MessagesService(
      chatSubject,
      privateChatObserver,
      groupChatObserver,
      prismaService,
      validacionChainMock,
    );
  });

  describe('sendMessage', () => {
    it('should process group message with correct observer', async () => {
      const messageDto: MessageDto = {
        id_membership: 1,
        text_content: 'Group message',
        send_at: new Date(),
        is_edited: false,
      };

      prismaService.message.create.mockResolvedValue({
        id_message: 1,
        ...messageDto,
      } as any);

      await service.sendMessage(messageDto);

      expect(prismaService.message.create).toHaveBeenCalled();
      expect(groupChatObserver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_type: 'group',
          decorators_applied: expect.any(Array),
        }),
      );
    });

    it('should process private message with correct observer', async () => {
      const messageDto: MessageDto = {
        sender_id: 1,
        recipient_id: 2,
        text_content: 'Private message',
        send_at: new Date(),
        is_edited: false,
      };

      prismaService.message.create.mockResolvedValue({
        id_message: 1,
        ...messageDto,
      } as any);

      await service.sendMessage(messageDto);

      expect(prismaService.message.create).toHaveBeenCalled();
      expect(privateChatObserver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_type: 'private',
          decorators_applied: expect.any(Array),
        }),
      );
    });

    it('should apply decorators before notification', async () => {
      const messageDto: MessageDto = {
        id_membership: 1,
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
      };

      prismaService.message.create.mockResolvedValue({
        id_message: 1,
        ...messageDto,
      } as any);

      await service.sendMessage(messageDto);

      expect(groupChatObserver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          decorators_applied: expect.any(Array),
          processed_at: expect.any(Date),
          rendered_content: expect.any(String),
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      const messageDto: MessageDto = {
        id_membership: 1,
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
      };

      prismaService.message.create.mockRejectedValue(new Error('Database error'));

      await expect(service.sendMessage(messageDto)).rejects.toThrow('Database error');
    });

    it('should clear observers after notification', async () => {
      const messageDto: MessageDto = {
        id_membership: 1,
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
      };

      prismaService.message.create.mockResolvedValue({
        id_message: 1,
        ...messageDto,
      } as any);

      await service.sendMessage(messageDto);

      expect(service.getObserverCount()).toBe(0);
    });
  });

  describe('enrichMessageWithRoomInfo', () => {
    it('should determine group chat type from id_membership', () => {
      const message: MessageDto = {
        id_membership: 1,
        text_content: 'Test',
        send_at: new Date(),
        is_edited: false,
      };

      const enriched = (service as any).enrichMessageWithRoomInfo(message);

      expect(enriched.chat_type).toBe('group');
      expect(enriched.room_id).toBe('group-1');
    });

    it('should determine private chat type from sender/recipient', () => {
      const message: MessageDto = {
        sender_id: 1,
        recipient_id: 2,
        text_content: 'Test',
        send_at: new Date(),
        is_edited: false,
      };

      const enriched = (service as any).enrichMessageWithRoomInfo(message);

      expect(enriched.chat_type).toBe('private');
      expect(enriched.room_id).toBe('private-1-2');
    });

    it('should order user IDs in private room_id', () => {
      const message: MessageDto = {
        sender_id: 5,
        recipient_id: 3,
        text_content: 'Test',
        send_at: new Date(),
        is_edited: false,
      };

      const enriched = (service as any).enrichMessageWithRoomInfo(message);

      expect(enriched.room_id).toBe('private-3-5');
    });
  });
});
