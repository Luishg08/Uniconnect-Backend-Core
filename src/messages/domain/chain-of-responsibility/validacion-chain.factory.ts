import { IValidadorMensajeHandler } from './interfaces/validador-mensaje-handler.interface';
import {
  ValidarTamanoHandler,
  ValidarContenidoHandler,
  ValidarMencionesHandler,
  ValidarPermisosHandler,
  ValidarAdjuntoHandler,
} from './handlers';

export interface ValidacionChainOptions {
  maxLongitud?: number;
  maxMenciones?: number;
  maxTamanoAdjuntoMb?: number;
  incluirValidacionAdjunto?: boolean;
  /** Omitir ValidarPermisosHandler cuando auth se garantiza externamente (p.ej. guards REST) */
  incluirValidacionPermisos?: boolean;
}

/**
 * Único punto de construcción de la cadena de validación de mensajes.
 * Cualquier modificación en el orden o la incorporación de nuevos handlers
 * ocurre exclusivamente aquí, sin tocar los handlers existentes.
 */
export class ValidacionChainFactory {
  static crearCadena(opciones: ValidacionChainOptions = {}): IValidadorMensajeHandler {
    const {
      maxLongitud,
      maxMenciones,
      maxTamanoAdjuntoMb,
      incluirValidacionAdjunto = true,
      incluirValidacionPermisos = true,
    } = opciones;

    const validarTamano = new ValidarTamanoHandler(maxLongitud);
    const validarContenido = new ValidarContenidoHandler();
    const validarMenciones = new ValidarMencionesHandler(maxMenciones);

    // Orden explícito y configurable de la cadena
    let ultimo: IValidadorMensajeHandler = validarTamano
      .setSiguiente(validarContenido)
      .setSiguiente(validarMenciones);

    if (incluirValidacionPermisos) {
      ultimo = ultimo.setSiguiente(new ValidarPermisosHandler());
    }

    // ValidarAdjuntoHandler se agrega sin modificar los handlers anteriores
    if (incluirValidacionAdjunto) {
      ultimo.setSiguiente(new ValidarAdjuntoHandler(maxTamanoAdjuntoMb));
    }

    return validarTamano;
  }
}
