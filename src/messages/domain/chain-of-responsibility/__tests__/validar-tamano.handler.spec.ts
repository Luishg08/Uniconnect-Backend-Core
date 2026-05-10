import { ValidarTamanoHandler, MAX_TAMANO_MENSAJE } from '../handlers/validar-tamano.handler';
import { MessageDto } from '../../../dto/message.dto';

describe('ValidarTamanoHandler', () => {
  let handler: ValidarTamanoHandler;

  beforeEach(() => {
    handler = new ValidarTamanoHandler();
  });

  it('debe aprobar un mensaje dentro del límite', () => {
    const mensaje = { text_content: 'Hola' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe rechazar un mensaje que excede el límite por defecto', () => {
    const mensaje = { text_content: 'a'.repeat(MAX_TAMANO_MENSAJE + 1) } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_TAMANO_EXCEDIDO');
  });

  it('debe rechazar cuando el mensaje supera el límite personalizado', () => {
    handler = new ValidarTamanoHandler(10);
    const mensaje = { text_content: '12345678901' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.mensaje).toContain('10 caracteres');
  });

  it('debe aprobar mensaje vacío (la validación de vacío pertenece a otro handler)', () => {
    const mensaje = { text_content: '' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe pasar al siguiente handler si el tamaño es válido', () => {
    const siguiente = {
      setSiguiente: jest.fn(),
      manejar: jest.fn().mockReturnValue({ valido: false, codigoError: 'SIGUIENTE' }),
    };
    handler.setSiguiente(siguiente);
    const mensaje = { text_content: 'Hola' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(siguiente.manejar).toHaveBeenCalledWith(mensaje);
    expect(resultado.codigoError).toBe('SIGUIENTE');
  });
});
