import { MessageDto } from '../../dto/message.dto';
import { IValidadorMensajeHandler } from './interfaces/validador-mensaje-handler.interface';
import { ResultadoValidacion } from './interfaces/resultado-validacion.interface';

export abstract class ValidadorMensajeAbstracto implements IValidadorMensajeHandler {
  private siguiente: IValidadorMensajeHandler | null = null;

  setSiguiente(handler: IValidadorMensajeHandler): IValidadorMensajeHandler {
    this.siguiente = handler;
    return handler;
  }

  manejar(mensaje: MessageDto): ResultadoValidacion {
    if (this.siguiente) {
      return this.siguiente.manejar(mensaje);
    }
    return { valido: true };
  }
}
