import { BadRequestException } from '@nestjs/common';
import { UniconnectLogger } from '../../core/logger/uniconnect-logger.singleton';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Opciones de configuración para el decorator @ContentModeration.
 * Permite ajustar el comportamiento de moderación por método.
 */
export interface ContentModerationOptions {
  /** Activar filtrado de palabras prohibidas. Default: true */
  filterProfanity?: boolean;
  /** Longitud máxima del mensaje en caracteres. Default: 500 */
  maxLength?: number;
  /** Registrar actividad de moderación en logs. Default: true */
  logActivity?: boolean;
}

/**
 * Contexto extraído del primer argumento del método decorado.
 * Permite al decorator acceder a los datos del mensaje.
 */
export interface ModerationContext {
  text_content?: string;
  id_user?: number;
  id_group?: number;
  id_membership?: number;
}

// ─── Prohibited Words ─────────────────────────────────────────────────────────

/**
 * Lista de palabras prohibidas para el entorno educativo Uniconnect.
 * Se usa un Set para O(1) lookup.
 */
export const PROHIBITED_WORDS: ReadonlySet<string> = new Set([
  'idiota',
  'imbecil',
  'estupido',
  'estupida',
  'maldito',
  'maldita',
  'inutil',
  'basura',
  'asco',
  'odio',
  'mierda',
  'puta',
  'puto',
  'cabron',
  'cabrona',
  'pendejo',
  'pendeja',
  'chinga',
  'chingada',
  'verga',
  'culero',
  'culera',
  'mamada',
  'joder',
  'coño',
  'gilipollas',
  'capullo',
  'zorra',
  'perra',
  'bastardo',
  'bastarda',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza el texto para comparación: minúsculas y espacios colapsados.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // eliminar acentos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica si el texto contiene alguna palabra prohibida.
 * Retorna la primera palabra encontrada o null.
 */
export function findProhibitedWord(text: string): string | null {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (PROHIBITED_WORDS.has(clean)) {
      return clean;
    }
  }
  return null;
}

/**
 * Extrae el texto del mensaje del primer argumento del método decorado.
 * Soporta tanto objetos DTO como strings directos.
 */
export function extractTextContent(arg: unknown): string | null {
  if (typeof arg === 'string') return arg;
  if (arg !== null && typeof arg === 'object') {
    const obj = arg as Record<string, unknown>;
    if (typeof obj['text_content'] === 'string') return obj['text_content'];
  }
  return null;
}

// ─── Decorator ────────────────────────────────────────────────────────────────

/**
 * Custom Method Decorator para moderación de contenido en mensajes de chat grupal.
 *
 * Intercepta el método decorado antes de su ejecución para:
 * 1. Filtrar palabras prohibidas (configurable)
 * 2. Validar longitud máxima del mensaje
 * 3. Registrar actividad de moderación con UniconnectLogger
 *
 * @example
 * ```typescript
 * @ContentModeration({ filterProfanity: true, maxLength: 500 })
 * async create(dto: CreateMessageDto) { ... }
 * ```
 */
export function ContentModeration(options: ContentModerationOptions = {}) {
  const {
    filterProfanity = true,
    maxLength = 500,
    logActivity = true,
  } = options;

  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const logger = UniconnectLogger.getInstance();

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const start = Date.now();
      const textContent = extractTextContent(args[0]);

      if (textContent !== null) {
        // Validar longitud
        if (textContent.length > maxLength) {
          if (logActivity) {
            logger.warn(
              `[ContentModeration] ${propertyKey}: message rejected - exceeds maxLength (${textContent.length}/${maxLength})`,
            );
          }
          throw new BadRequestException(
            `Message exceeds maximum length of ${maxLength} characters`,
          );
        }

        // Filtrar palabras prohibidas
        if (filterProfanity) {
          const found = findProhibitedWord(textContent);
          if (found !== null) {
            if (logActivity) {
              logger.warn(
                `[ContentModeration] ${propertyKey}: message rejected - prohibited word detected`,
              );
            }
            throw new BadRequestException(
              'Message contains inappropriate content and cannot be sent',
            );
          }
        }

        if (logActivity) {
          logger.info(
            `[ContentModeration] ${propertyKey}: message passed moderation (${Date.now() - start}ms)`,
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
