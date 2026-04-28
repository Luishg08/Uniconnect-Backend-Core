import { BaseMessage } from '../base-message';
import { MentionMessageDecorator } from '../mention-message.decorator';

describe('MentionMessageDecorator', () => {
  const textContent = 'Hello @user!';
  const userId = 1;
  const timestamp = new Date('2026-04-27T12:00:00Z');
  const mentions = [
    { userId: 2, displayName: 'John Doe', position: 6 },
  ];

  let baseMessage: BaseMessage;
  let decoratedMessage: MentionMessageDecorator;

  beforeEach(() => {
    baseMessage = new BaseMessage(textContent, userId, timestamp);
    decoratedMessage = new MentionMessageDecorator(baseMessage, mentions);
  });

  describe('getContent', () => {
    it('should delegate to wrapped message', () => {
      expect(decoratedMessage.getContent()).toBe(textContent);
    });
  });

  describe('getMetadata', () => {
    it('should delegate to wrapped message', () => {
      const metadata = decoratedMessage.getMetadata();
      expect(metadata.userId).toBe(userId);
    });
  });

  describe('render', () => {
    it('should include mentions in rendered JSON', () => {
      const rendered = decoratedMessage.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.text).toBe(textContent);
      expect(parsed.mentions).toEqual(mentions);
    });

    it('should handle multiple mentions', () => {
      const multipleMentions = [
        { userId: 2, displayName: 'John Doe', position: 6 },
        { userId: 3, displayName: 'Jane Smith', position: 15 },
      ];
      const message = new MentionMessageDecorator(baseMessage, multipleMentions);
      const rendered = message.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.mentions).toHaveLength(2);
      expect(parsed.mentions).toEqual(multipleMentions);
    });
  });
});
