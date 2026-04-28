import { BaseMessage } from '../base-message';
import { FileMessageDecorator } from '../file-message.decorator';

describe('FileMessageDecorator', () => {
  const textContent = 'Check this file';
  const userId = 1;
  const timestamp = new Date('2026-04-27T12:00:00Z');
  const files = [
    { url: 'https://example.com/file.pdf', name: 'file.pdf', mimeType: 'application/pdf', size: 1024 },
  ];

  let baseMessage: BaseMessage;
  let decoratedMessage: FileMessageDecorator;

  beforeEach(() => {
    baseMessage = new BaseMessage(textContent, userId, timestamp);
    decoratedMessage = new FileMessageDecorator(baseMessage, files);
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
    it('should include files in rendered JSON', () => {
      const rendered = decoratedMessage.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.text).toBe(textContent);
      expect(parsed.files).toEqual(files);
    });

    it('should handle multiple files', () => {
      const multipleFiles = [
        { url: 'https://example.com/file1.pdf', name: 'file1.pdf', mimeType: 'application/pdf', size: 1024 },
        { url: 'https://example.com/file2.jpg', name: 'file2.jpg', mimeType: 'image/jpeg', size: 2048 },
      ];
      const message = new FileMessageDecorator(baseMessage, multipleFiles);
      const rendered = message.render();
      const parsed = JSON.parse(rendered);
      expect(parsed.files).toHaveLength(2);
      expect(parsed.files).toEqual(multipleFiles);
    });
  });
});
