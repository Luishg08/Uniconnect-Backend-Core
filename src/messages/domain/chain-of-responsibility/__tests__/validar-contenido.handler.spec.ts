import { ValidarContenidoHandler } from '../handlers/validar-contenido.handler';
import { MessageDto } from '../../../dto/message.dto';

describe('ValidarContenidoHandler', () => {
  let handler: ValidarContenidoHandler;

  beforeEach(() => {
    handler = new ValidarContenidoHandler();
  });

  it('debe aprobar un mensaje con contenido apropiado', () => {
    const mensaje = { text_content: 'Hola compañero, ¿cómo estás?' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe rechazar un mensaje vacío', () => {
    const mensaje = { text_content: '' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_CONTENIDO_VACIO');
  });

  it('debe rechazar un mensaje con solo espacios', () => {
    const mensaje = { text_content: '   ' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_CONTENIDO_VACIO');
  });

  it('debe rechazar un mensaje con palabra prohibida', () => {
    const mensaje = { text_content: 'Eres un idiota' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_CONTENIDO_INAPROPIADO');
  });

  it('debe rechazar palabra prohibida con acentos', () => {
    const mensaje = { text_content: 'Qué estúpido' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_CONTENIDO_INAPROPIADO');
  });

  it('debe pasar al siguiente cuando el contenido es válido', () => {
    const siguiente = {
      setSiguiente: jest.fn(),
      manejar: jest.fn().mockReturnValue({ valido: true }),
    };
    handler.setSiguiente(siguiente);
    const mensaje = { text_content: 'Mensaje válido' } as MessageDto;
    handler.manejar(mensaje);
    expect(siguiente.manejar).toHaveBeenCalledWith(mensaje);
  });
});
