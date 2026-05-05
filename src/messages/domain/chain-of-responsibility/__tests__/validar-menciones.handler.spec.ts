import { ValidarMencionesHandler, MAX_MENCIONES_POR_MENSAJE } from '../handlers/validar-menciones.handler';
import { MessageDto } from '../../../dto/message.dto';
import { MentionDto } from '../../../dto/mention.dto';

const crearMencion = (userId: number): MentionDto =>
  ({ userId, displayName: `user${userId}`, position: 0 } as MentionDto);

describe('ValidarMencionesHandler', () => {
  let handler: ValidarMencionesHandler;

  beforeEach(() => {
    handler = new ValidarMencionesHandler();
  });

  it('debe aprobar un mensaje sin menciones', () => {
    const mensaje = { text_content: 'Hola', mentions: [] } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe aprobar menciones válidas dentro del límite', () => {
    const mensaje = {
      text_content: 'Hola',
      mentions: [crearMencion(1), crearMencion(2)],
    } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe rechazar si se superan las menciones máximas', () => {
    const menciones = Array.from({ length: MAX_MENCIONES_POR_MENSAJE + 1 }, (_, i) =>
      crearMencion(i + 1),
    );
    const mensaje = { text_content: 'Hola', mentions: menciones } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_MENCIONES_EXCEDIDAS');
  });

  it('debe rechazar una mención con userId inválido (cero)', () => {
    const mensaje = {
      text_content: 'Hola',
      mentions: [crearMencion(0)],
    } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_MENCIONES_INVALIDAS');
  });

  it('debe rechazar una mención con userId negativo', () => {
    const mensaje = {
      text_content: 'Hola',
      mentions: [crearMencion(-5)],
    } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_MENCIONES_INVALIDAS');
  });
});
