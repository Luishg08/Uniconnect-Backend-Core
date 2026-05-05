import { MessageDto } from '../../../dto/message.dto';
import { ResultadoValidacion } from './resultado-validacion.interface';

export interface IValidadorMensajeHandler {
  setSiguiente(handler: IValidadorMensajeHandler): IValidadorMensajeHandler;
  manejar(mensaje: MessageDto): ResultadoValidacion;
}
