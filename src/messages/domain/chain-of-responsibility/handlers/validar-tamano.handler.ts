import { MessageDto } from '../../../dto/message.dto';
import { ResultadoValidacion } from '../interfaces/resultado-validacion.interface';
import { ValidadorMensajeAbstracto } from '../validador-mensaje.abstract';

export const MAX_TAMANO_MENSAJE = 500;

export class ValidarTamanoHandler extends ValidadorMensajeAbstracto {
  constructor(private readonly maxLongitud: number = MAX_TAMANO_MENSAJE) {
    super();
  }

  manejar(mensaje: MessageDto): ResultadoValidacion {
    const contenido = mensaje.text_content ?? '';
    if (contenido.length > this.maxLongitud) {
      return {
        valido: false,
        codigoError: 'MSG_TAMANO_EXCEDIDO',
        mensaje: `El mensaje excede el límite de ${this.maxLongitud} caracteres (recibidos: ${contenido.length})`,
      };
    }
    return super.manejar(mensaje);
  }
}
