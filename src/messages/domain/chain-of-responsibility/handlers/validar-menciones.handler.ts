import { MessageDto } from '../../../dto/message.dto';
import { ResultadoValidacion } from '../interfaces/resultado-validacion.interface';
import { ValidadorMensajeAbstracto } from '../validador-mensaje.abstract';

export const MAX_MENCIONES_POR_MENSAJE = 10;

export class ValidarMencionesHandler extends ValidadorMensajeAbstracto {
  constructor(private readonly maxMenciones: number = MAX_MENCIONES_POR_MENSAJE) {
    super();
  }

  manejar(mensaje: MessageDto): ResultadoValidacion {
    const menciones = mensaje.mentions ?? [];

    if (menciones.length > this.maxMenciones) {
      return {
        valido: false,
        codigoError: 'MSG_MENCIONES_EXCEDIDAS',
        mensaje: `El mensaje excede el límite de ${this.maxMenciones} menciones (recibidas: ${menciones.length})`,
      };
    }

    for (const mencion of menciones) {
      if (!mencion.userId || mencion.userId <= 0) {
        return {
          valido: false,
          codigoError: 'MSG_MENCIONES_INVALIDAS',
          mensaje: 'Una o más menciones contienen un userId inválido',
        };
      }
    }

    return super.manejar(mensaje);
  }
}
