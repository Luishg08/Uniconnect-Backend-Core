import { ValidarPermisosHandler } from '../handlers/validar-permisos.handler';
import { MessageDto } from '../../../dto/message.dto';

describe('ValidarPermisosHandler', () => {
  let handler: ValidarPermisosHandler;

  beforeEach(() => {
    handler = new ValidarPermisosHandler();
  });

  it('debe aprobar un mensaje de chat privado con sender y recipient válidos', () => {
    const mensaje = { sender_id: 1, recipient_id: 2, text_content: 'Hola' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe aprobar un mensaje de grupo con id_membership válido', () => {
    const mensaje = { sender_id: 1, id_membership: 10, text_content: 'Hola grupo' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(true);
  });

  it('debe rechazar cuando no hay sender_id', () => {
    const mensaje = { recipient_id: 2, text_content: 'Hola' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_PERMISOS_INSUFICIENTES');
  });

  it('debe rechazar cuando sender_id es cero', () => {
    const mensaje = { sender_id: 0, recipient_id: 2, text_content: 'Hola' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_PERMISOS_INSUFICIENTES');
  });

  it('debe rechazar cuando no hay destinatario ni membresía', () => {
    const mensaje = { sender_id: 1, text_content: 'Sin destino' } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_PERMISOS_INSUFICIENTES');
  });
});
