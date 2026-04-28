import { BaseMessage } from '../base-message';
import { FileMessageDecorator } from '../file-message.decorator';
import { MentionMessageDecorator } from '../mention-message.decorator';
import { ReactionMessageDecorator } from '../reaction-message.decorator';

describe('Decorator Composition', () => {
  const textContent = 'Hello @user, check this file!';
  const userId = 1;
  const timestamp = new Date('2026-04-27T12:00:00Z');

  const files = [
    { url: 'https://example.com/file.pdf', name: 'file.pdf', mimeType: 'application/pdf', size: 1024 },
  ];

  const mentions = [
    { userId: 2, displayName: 'John Doe', position: 6 },
  ];

  const reactions = [
    { emoji: '👍', count: 2, users: [3, 4] },
  ];

  describe('File + Mention composition', () => {
    it('should include both files and mentions in rendered JSON', () => {
      let message = new BaseMessage(textContent, userId, timestamp);
      message = new FileMessageDecorator(message, files);
      message = new MentionMessageDecorator(message, mentions);

      const rendered = message.render();
      const parsed = JSON.parse(rendered);

      expect(parsed.text).toBe(textContent);
      expect(parsed.files).toEqual(files);
      expect(parsed.mentions).toEqual(mentions);
    });
  });

  describe('File + Mention + Reaction composition', () => {
    it('should include all decorators in rendered JSON', () => {
      let message = new BaseMessage(textContent, userId, timestamp);
      message = new FileMessageDecorator(message, files);
      message = new MentionMessageDecorator(message, mentions);
      message = new ReactionMessageDecorator(message, reactions);

      const rendered = message.render();
      const parsed = JSON.parse(rendered);

      expect(parsed.text).toBe(textContent);
      expect(parsed.files).toEqual(files);
      expect(parsed.mentions).toEqual(mentions);
      expect(parsed.reactions).toEqual(reactions);
    });
  });

  describe('Order independence', () => {
    it('should produce same result regardless of decorator order', () => {
      // Order 1: File -> Mention -> Reaction
      let message1 = new BaseMessage(textContent, userId, timestamp);
      message1 = new FileMessageDecorator(message1, files);
      message1 = new MentionMessageDecorator(message1, mentions);
      message1 = new ReactionMessageDecorator(message1, reactions);

      // Order 2: Reaction -> Mention -> File
      let message2 = new BaseMessage(textContent, userId, timestamp);
      message2 = new ReactionMessageDecorator(message2, reactions);
      message2 = new MentionMessageDecorator(message2, mentions);
      message2 = new FileMessageDecorator(message2, files);

      const parsed1 = JSON.parse(message1.render());
      const parsed2 = JSON.parse(message2.render());

      expect(parsed1).toEqual(parsed2);
    });
  });
});
