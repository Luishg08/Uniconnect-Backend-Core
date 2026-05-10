import { MessageDto } from '../../../dto/message.dto';
import { ResultadoValidacion } from '../interfaces/resultado-validacion.interface';
import { ValidadorMensajeAbstracto } from '../validador-mensaje.abstract';

export const MAX_TAMANO_ADJUNTO_MB = 10;
export const TIPOS_MIME_PERMITIDOS: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
]);

export class ValidarAdjuntoHandler extends ValidadorMensajeAbstracto {
  constructor(
    private readonly maxTamanoMb: number = MAX_TAMANO_ADJUNTO_MB,
    private readonly tiposPermitidos: ReadonlySet<string> = TIPOS_MIME_PERMITIDOS,
  ) {
    super();
  }

  manejar(mensaje: MessageDto): ResultadoValidacion {
    const archivos = mensaje.files ?? [];
    const maxBytes = this.maxTamanoMb * 1024 * 1024;

    for (const archivo of archivos) {
      if (archivo.size > maxBytes) {
        return {
          valido: false,
          codigoError: 'MSG_ADJUNTO_TAMANO_EXCEDIDO',
          mensaje: `El adjunto "${archivo.name}" excede el tamaño máximo de ${this.maxTamanoMb}MB`,
        };
      }
      if (!this.tiposPermitidos.has(archivo.mimeType)) {
        return {
          valido: false,
          codigoError: 'MSG_ADJUNTO_TIPO_NO_PERMITIDO',
          mensaje: `El tipo de archivo "${archivo.mimeType}" no está permitido`,
        };
      }
    }

    return super.manejar(mensaje);
  }
}
