import { PrivateChatObserver } from '../infrastructure/observers/private-chat.observer';
import { GroupChatObserver } from '../infrastructure/observers/group-chat.observer';
import { ChatGateway } from '../infrastructure/gateways/chat.gateway';
import { MessageDto } from '../dto/message.dto';

describe('Chat Observers', () => {
  let privateChatObserver: PrivateChatObserver;
  let groupChatObserver: GroupChatObserver;
  let mockChatGateway: jest.Mocked<ChatGateway>;

  beforeEach(() => {
    mockChatGateway = {
      emitToRoom: jest.fn(),
    } as unknown as jest.Mocked<ChatGateway>;

    privateChatObserver = new PrivateChatObserver(mockChatGateway);
    groupChatObserver = new GroupChatObserver(mockChatGateway);
  });

  describe('PrivateChatObserver', () => {
    it('should emit private message to correct room', () => {
      const message: MessageDto = {
        text_content: 'Private message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'private',
        room_id: 'private-1-2',
      };

      privateChatObserver.update(message);

      expect(mockChatGateway.emitToRoom).toHaveBeenCalledWith(
        'private-1-2',
        'NUEVO_MENSAJE',
        expect.objectContaining({
          text_content: 'Private message',
          channel: 'private',
        }),
      );
    });

    it('should ignore non-private messages', () => {
      const message: MessageDto = {
        text_content: 'Group message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-1',
      };

      privateChatObserver.update(message);

      expect(mockChatGateway.emitToRoom).not.toHaveBeenCalled();
    });

    it('should handle missing room_id', () => {
      const message: MessageDto = {
        text_content: 'Message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'private',
        room_id: '',
      };

      expect(() => privateChatObserver.update(message)).not.toThrow();
      expect(mockChatGateway.emitToRoom).not.toHaveBeenCalled();
    });

    it('should handle gateway errors gracefully', () => {
      mockChatGateway.emitToRoom.mockImplementation(() => {
        throw new Error('Gateway error');
      });

      const message: MessageDto = {
        text_content: 'Message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'private',
        room_id: 'private-1-2',
      };

      expect(() => privateChatObserver.update(message)).not.toThrow();
    });
  });

  describe('GroupChatObserver', () => {
    it('should emit group message to correct room', () => {
      const message: MessageDto = {
        text_content: 'Group message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-123',
      };

      groupChatObserver.update(message);

      expect(mockChatGateway.emitToRoom).toHaveBeenCalledWith(
        'group-123',
        'NUEVO_MENSAJE',
        expect.objectContaining({
          text_content: 'Group message',
          channel: 'group',
        }),
      );
    });

    it('should ignore non-group messages', () => {
      const message: MessageDto = {
        text_content: 'Private message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'private',
        room_id: 'private-1-2',
      };

      groupChatObserver.update(message);

      expect(mockChatGateway.emitToRoom).not.toHaveBeenCalled();
    });

    it('should handle missing room_id', () => {
      const message: MessageDto = {
        text_content: 'Message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: '',
      };

      expect(() => groupChatObserver.update(message)).not.toThrow();
      expect(mockChatGateway.emitToRoom).not.toHaveBeenCalled();
    });

    it('should handle gateway errors gracefully', () => {
      mockChatGateway.emitToRoom.mockImplementation(() => {
        throw new Error('Gateway error');
      });

      const message: MessageDto = {
        text_content: 'Message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-123',
      };

      expect(() => groupChatObserver.update(message)).not.toThrow();
    });
  });

  describe('Channel Isolation', () => {
    it('should ensure strict separation between private and group channels', () => {
      const privateMessage: MessageDto = {
        text_content: 'Private',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'private',
        room_id: 'private-1-2',
      };

      const groupMessage: MessageDto = {
        text_content: 'Group',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-123',
      };

      // Private observer should only handle private messages
      privateChatObserver.update(privateMessage);
      expect(mockChatGateway.emitToRoom).toHaveBeenCalledWith('private-1-2', 'NUEVO_MENSAJE', expect.any(Object));
      
      mockChatGateway.emitToRoom.mockClear();
      
      privateChatObserver.update(groupMessage);
      expect(mockChatGateway.emitToRoom).not.toHaveBeenCalled();

      // Group observer should only handle group messages
      groupChatObserver.update(groupMessage);
      expect(mockChatGateway.emitToRoom).toHaveBeenCalledWith('group-123', 'NUEVO_MENSAJE', expect.any(Object));
      
      mockChatGateway.emitToRoom.mockClear();
      
      groupChatObserver.update(privateMessage);
      expect(mockChatGateway.emitToRoom).not.toHaveBeenCalled();
    });
  });
});
