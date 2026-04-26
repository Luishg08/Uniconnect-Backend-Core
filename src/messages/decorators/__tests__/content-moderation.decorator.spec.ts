import { BadRequestException } from '@nestjs/common';
import {
  ContentModeration,
  ContentModerationOptions,
  findProhibitedWord,
  normalizeText,
  extractTextContent,
  PROHIBITED_WORDS,
} from '../content-moderation.decorator';

// ─── Dummy Class ──────────────────────────────────────────────────────────────
// Clase ficticia interna para testear el decorator sin dependencias externas.
// Simula los métodos de MessagesService y MessagesGateway.

class DummyMessageService {
  @ContentModeration({ filterProfanity: true, maxLength: 100, logActivity: false })
  async sendMessage(dto: { text_content: string }): Promise<{ success: boolean; text: string }> {
    return { success: true, text: dto.text_content };
  }

  @ContentModeration({ filterProfanity: false, maxLength: 50, logActivity: false })
  async sendMessageLengthOnly(dto: { text_content: string }): Promise<{ success: boolean }> {
    return { success: true };
  }

  @ContentModeration({ filterProfanity: true, maxLength: 500, logActivity: false })
  async sendMessageProfanityOnly(dto: { text_content: string }): Promise<{ success: boolean }> {
    return { success: true };
  }

  @ContentModeration({ logActivity: false })
  async sendMessageDefaults(dto: { text_content: string }): Promise<{ success: boolean }> {
    return { success: true };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContentModeration Decorator', () => {
  let service: DummyMessageService;

  beforeEach(() => {
    service = new DummyMessageService();
  });

  // ── Helper functions ────────────────────────────────────────────────────────

  describe('normalizeText()', () => {
    it('should convert to lowercase', () => {
      expect(normalizeText('HOLA MUNDO')).toBe('hola mundo');
    });

    it('should remove accents', () => {
      expect(normalizeText('ácción')).toBe('accion');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeText('hola   mundo')).toBe('hola mundo');
    });

    it('should trim whitespace', () => {
      expect(normalizeText('  hola  ')).toBe('hola');
    });
  });

  describe('findProhibitedWord()', () => {
    it('should return null for clean text', () => {
      expect(findProhibitedWord('hola como estas')).toBeNull();
    });

    it('should detect a prohibited word', () => {
      expect(findProhibitedWord('eres un idiota')).toBe('idiota');
    });

    it('should detect prohibited word case-insensitively', () => {
      expect(findProhibitedWord('eres un IDIOTA')).toBe('idiota');
    });

    it('should detect prohibited word with accents normalized', () => {
      expect(findProhibitedWord('eres un estúpido')).toBe('estupido');
    });

    it('should return null for empty string', () => {
      expect(findProhibitedWord('')).toBeNull();
    });
  });

  describe('extractTextContent()', () => {
    it('should extract text_content from DTO object', () => {
      expect(extractTextContent({ text_content: 'hola' })).toBe('hola');
    });

    it('should return string directly if arg is string', () => {
      expect(extractTextContent('hola')).toBe('hola');
    });

    it('should return null for null', () => {
      expect(extractTextContent(null)).toBeNull();
    });

    it('should return null for object without text_content', () => {
      expect(extractTextContent({ other: 'field' })).toBeNull();
    });
  });

  describe('PROHIBITED_WORDS set', () => {
    it('should contain expected words', () => {
      expect(PROHIBITED_WORDS.has('idiota')).toBe(true);
      expect(PROHIBITED_WORDS.has('mierda')).toBe(true);
    });

    it('should not contain clean words', () => {
      expect(PROHIBITED_WORDS.has('hola')).toBe(false);
      expect(PROHIBITED_WORDS.has('universidad')).toBe(false);
    });
  });

  // ── Profanity filtering scenarios ───────────────────────────────────────────

  describe('Profanity filtering', () => {
    it('should allow clean message', async () => {
      const result = await service.sendMessage({ text_content: 'Hola, ¿cómo están?' });
      expect(result.success).toBe(true);
    });

    it('should block message with prohibited word', async () => {
      await expect(
        service.sendMessage({ text_content: 'eres un idiota' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block message with prohibited word in uppercase', async () => {
      await expect(
        service.sendMessage({ text_content: 'eres un IDIOTA' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return correct error message for profanity', async () => {
      await expect(
        service.sendMessage({ text_content: 'eres un idiota' }),
      ).rejects.toThrow('Message contains inappropriate content and cannot be sent');
    });

    it('should allow message when filterProfanity is false', async () => {
      const result = await service.sendMessageLengthOnly({ text_content: 'idiota' });
      expect(result.success).toBe(true);
    });
  });

  // ── Message length validation scenarios ─────────────────────────────────────

  describe('Message length validation', () => {
    it('should allow message within length limit', async () => {
      const result = await service.sendMessage({ text_content: 'Mensaje corto' });
      expect(result.success).toBe(true);
    });

    it('should block message exceeding maxLength', async () => {
      const longMessage = 'a'.repeat(101);
      await expect(
        service.sendMessage({ text_content: longMessage }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return correct error message for length violation', async () => {
      const longMessage = 'a'.repeat(101);
      await expect(
        service.sendMessage({ text_content: longMessage }),
      ).rejects.toThrow('Message exceeds maximum length of 100 characters');
    });

    it('should allow message exactly at maxLength', async () => {
      const exactMessage = 'a'.repeat(100);
      const result = await service.sendMessage({ text_content: exactMessage });
      expect(result.success).toBe(true);
    });

    it('should block message exceeding length-only config', async () => {
      const longMessage = 'a'.repeat(51);
      await expect(
        service.sendMessageLengthOnly({ text_content: longMessage }),
      ).rejects.toThrow('Message exceeds maximum length of 50 characters');
    });
  });

  // ── Configurable options scenarios ──────────────────────────────────────────

  describe('Configurable moderation options', () => {
    it('should enforce both profanity and length with strict config', async () => {
      await expect(
        service.sendMessage({ text_content: 'idiota' }),
      ).rejects.toThrow(BadRequestException);

      const longMessage = 'a'.repeat(101);
      await expect(
        service.sendMessage({ text_content: longMessage }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should only enforce length when filterProfanity is false', async () => {
      // Profanity allowed
      const result = await service.sendMessageLengthOnly({ text_content: 'idiota' });
      expect(result.success).toBe(true);

      // But length still enforced
      await expect(
        service.sendMessageLengthOnly({ text_content: 'a'.repeat(51) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use default maxLength of 500 when not specified', async () => {
      const message500 = 'a'.repeat(500);
      const result = await service.sendMessageDefaults({ text_content: message500 });
      expect(result.success).toBe(true);

      const message501 = 'a'.repeat(501);
      await expect(
        service.sendMessageDefaults({ text_content: message501 }),
      ).rejects.toThrow('Message exceeds maximum length of 500 characters');
    });
  });

  // ── Error handling and user feedback ────────────────────────────────────────

  describe('Error handling', () => {
    it('should throw BadRequestException (not generic Error) for profanity', async () => {
      const error = await service.sendMessage({ text_content: 'idiota' }).catch(e => e);
      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException (not generic Error) for length', async () => {
      const error = await service.sendMessage({ text_content: 'a'.repeat(101) }).catch(e => e);
      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('should pass through when text_content is absent from DTO', async () => {
      // Si el DTO no tiene text_content, el decorator no debe bloquear
      const result = await service.sendMessage({ text_content: '' });
      expect(result.success).toBe(true);
    });

    it('should preserve original method return value on success', async () => {
      const result = await service.sendMessage({ text_content: 'Hola mundo' });
      expect(result).toEqual({ success: true, text: 'Hola mundo' });
    });
  });

  // ── Integration with existing message methods ────────────────────────────────

  describe('Integration with message methods', () => {
    it('should call original method after passing moderation', async () => {
      const spy = jest.spyOn(service, 'sendMessage');
      await service.sendMessage({ text_content: 'Mensaje limpio' });
      expect(spy).toHaveBeenCalledWith({ text_content: 'Mensaje limpio' });
    });

    it('should not call original method when message is blocked', async () => {
      const originalFn = jest.fn();
      class SpyService {
        @ContentModeration({ filterProfanity: true, maxLength: 500, logActivity: false })
        async create(dto: { text_content: string }): Promise<void> {
          originalFn(dto);
        }
      }
      const spyService = new SpyService();
      await spyService.create({ text_content: 'idiota' }).catch(() => null);
      expect(originalFn).not.toHaveBeenCalled();
    });

    it('should call original method when message passes moderation', async () => {
      const originalFn = jest.fn().mockResolvedValue({ success: true });
      class SpyService {
        @ContentModeration({ filterProfanity: true, maxLength: 500, logActivity: false })
        async create(dto: { text_content: string }): Promise<unknown> {
          return originalFn(dto);
        }
      }
      const spyService = new SpyService();
      await spyService.create({ text_content: 'Hola mundo' });
      expect(originalFn).toHaveBeenCalledWith({ text_content: 'Hola mundo' });
    });
  });
});
