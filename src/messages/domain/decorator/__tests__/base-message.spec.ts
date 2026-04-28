import { BaseMessage } from '../base-message';

describe('BaseMessage', () => {
  const textContent = 'Hello World';
  const userId = 1;
  const timestamp = new Date('2026-04-27T12:00:00Z');

  let message: BaseMessage;

  beforeEach(() => {
    message = new BaseMessage(textContent, userId, timestamp);
  });

  describe('getContent', () => {
    it('should return the text content', () => {
      expect(message.getContent()).toBe(textContent);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata with userId and timestamp', () => {
      const metadata = message.getMetadata();
      expect(metadata.userId).toBe(userId);
      expect(metadata.timestamp).toBe(timestamp.toISOString());
    });
  });

  describe('render', () => {
    it('should return JSON string with text property', () => {
      const rendered = message.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.text).toBe(textContent);
    });

    it('should return valid JSON', () => {
      const rendered = message.render();
      expect(() => JSON.parse(rendered)).not.toThrow();
    });
  });
});
