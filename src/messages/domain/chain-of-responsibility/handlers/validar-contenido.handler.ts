import { MessageDto } from '../../../dto/message.dto';
import { ResultadoValidacion } from '../interfaces/resultado-validacion.interface';
import { ValidadorMensajeAbstracto } from '../validador-mensaje.abstract';
import { findProhibitedWord } from '../../../decorators/content-moderation.decorator';

export class ValidarContenidoHandler extends ValidadorMensajeAbstracto {
  manejar(mensaje: MessageDto): ResultadoValidacion {
    const contenido = mensaje.text_content ?? '';
    if (contenido.trim().length === 0) {
      return {
        valido: false,
        codigoError: 'MSG_CONTENIDO_VACIO',
        mensaje: 'El mensaje no puede estar vacío',
      };
    }
    const palabraProhibida = findProhibitedWord(contenido);
    if (palabraProhibida !== null) {
      return {
        valido: false,
        codigoError: 'MSG_CONTENIDO_INAPROPIADO',
        mensaje: 'El mensaje contiene contenido inapropiado',
      };
    }
    return super.manejar(mensaje);
  }
}
