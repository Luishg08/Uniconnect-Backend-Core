import { MessageDto } from '../../../dto/message.dto';
import { ResultadoValidacion } from '../interfaces/resultado-validacion.interface';
import { ValidadorMensajeAbstracto } from '../validador-mensaje.abstract';

export class ValidarPermisosHandler extends ValidadorMensajeAbstracto {
  manejar(mensaje: MessageDto): ResultadoValidacion {
    if (!mensaje.sender_id || mensaje.sender_id <= 0) {
      return {
        valido: false,
        codigoError: 'MSG_PERMISOS_INSUFICIENTES',
        mensaje: 'El remitente no está autorizado para enviar mensajes',
      };
    }

    const tieneDestino =
      mensaje.id_membership ||
      (mensaje.sender_id && mensaje.recipient_id && mensaje.recipient_id > 0);

    if (!tieneDestino) {
      return {
        valido: false,
        codigoError: 'MSG_PERMISOS_INSUFICIENTES',
        mensaje: 'El mensaje debe tener un destinatario o membresía válida',
      };
    }

    return super.manejar(mensaje);
  }
}
