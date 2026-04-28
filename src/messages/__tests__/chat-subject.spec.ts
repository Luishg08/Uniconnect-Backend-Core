import { Test, TestingModule } from '@nestjs/testing';
import { ChatSubject } from '../domain/observer/chat-subject';
import { IObserver } from '../domain/observer/interfaces';
import { MessageDto } from '../dto/message.dto';

describe('ChatSubject', () => {
  let chatSubject: ChatSubject;
  let mockObserver1: IObserver<MessageDto>;
  let mockObserver2: IObserver<MessageDto>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatSubject],
    }).compile();

    chatSubject = module.get<ChatSubject>(ChatSubject);

    mockObserver1 = {
      update: jest.fn(),
    };

    mockObserver2 = {
      update: jest.fn(),
    };
  });

  describe('attach', () => {
    it('should attach observer to the subject', () => {
      chatSubject.attach(mockObserver1);
      expect(chatSubject.getObserverCount()).toBe(1);
    });

    it('should not attach duplicate observers', () => {
      chatSubject.attach(mockObserver1);
      chatSubject.attach(mockObserver1);
      expect(chatSubject.getObserverCount()).toBe(1);
    });

    it('should attach multiple different observers', () => {
      chatSubject.attach(mockObserver1);
      chatSubject.attach(mockObserver2);
      expect(chatSubject.getObserverCount()).toBe(2);
    });
  });

  describe('detach', () => {
    it('should detach observer from the subject', () => {
      chatSubject.attach(mockObserver1);
      chatSubject.detach(mockObserver1);
      expect(chatSubject.getObserverCount()).toBe(0);
    });

    it('should handle detaching non-existent observer', () => {
      chatSubject.detach(mockObserver1);
      expect(chatSubject.getObserverCount()).toBe(0);
    });

    it('should detach only the specified observer', () => {
      chatSubject.attach(mockObserver1);
      chatSubject.attach(mockObserver2);
      chatSubject.detach(mockObserver1);
      expect(chatSubject.getObserverCount()).toBe(1);
    });
  });

  describe('notify', () => {
    it('should notify all attached observers', () => {
      chatSubject.attach(mockObserver1);
      chatSubject.attach(mockObserver2);

      const message: MessageDto = {
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-1',
      };

      chatSubject.notify(message);

      expect(mockObserver1.update).toHaveBeenCalledWith(message);
      expect(mockObserver2.update).toHaveBeenCalledWith(message);
    });

    it('should clear observers after notification', () => {
      chatSubject.attach(mockObserver1);
      
      const message: MessageDto = {
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-1',
      };

      chatSubject.notify(message);
      expect(chatSubject.getObserverCount()).toBe(0);
    });

    it('should handle observer errors gracefully', () => {
      const errorObserver: IObserver<MessageDto> = {
        update: jest.fn().mockImplementation(() => {
          throw new Error('Observer error');
        }),
      };

      chatSubject.attach(errorObserver);
      chatSubject.attach(mockObserver1);

      const message: MessageDto = {
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-1',
      };

      expect(() => chatSubject.notify(message)).not.toThrow();
      expect(mockObserver1.update).toHaveBeenCalledWith(message);
    });

    it('should not notify if no observers attached', () => {
      const message: MessageDto = {
        text_content: 'Test message',
        send_at: new Date(),
        is_edited: false,
        chat_type: 'group',
        room_id: 'group-1',
      };

      expect(() => chatSubject.notify(message)).not.toThrow();
    });
  });
});
