import { BaseMessage } from '../base-message';
import { ReactionMessageDecorator } from '../reaction-message.decorator';

describe('ReactionMessageDecorator', () => {
  const textContent = 'Great message!';
  const userId = 1;
  const timestamp = new Date('2026-04-27T12:00:00Z');
  const reactions = [
    { emoji: '👍', count: 3, users: [2, 3, 4] },
  ];

  let baseMessage: BaseMessage;
  let decoratedMessage: ReactionMessageDecorator;

  beforeEach(() => {
    baseMessage = new BaseMessage(textContent, userId, timestamp);
    decoratedMessage = new ReactionMessageDecorator(baseMessage, reactions);
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
    it('should include reactions in rendered JSON', () => {
      const rendered = decoratedMessage.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.text).toBe(textContent);
      expect(parsed.reactions).toEqual(reactions);
    });

    it('should handle multiple reaction types', () => {
      const multipleReactions = [
        { emoji: '👍', count: 3, users: [2, 3, 4] },
        { emoji: '❤️', count: 2, users: [5, 6] },
      ];
      const message = new ReactionMessageDecorator(baseMessage, multipleReactions);
      const rendered = message.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.reactions).toHaveLength(2);
      expect(parsed.reactions).toEqual(multipleReactions);
    });
  });
});
