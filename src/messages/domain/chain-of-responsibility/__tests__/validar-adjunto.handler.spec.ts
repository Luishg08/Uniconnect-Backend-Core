import { ValidarAdjuntoHandler, MAX_TAMANO_ADJUNTO_MB } from '../handlers/validar-adjunto.handler';
import { MessageDto } from '../../../dto/message.dto';
import { FileAttachmentDto } from '../../../dto/file-attachment.dto';

const MB = 1024 * 1024;

const crearArchivo = (overrides: Partial<FileAttachmentDto> = {}): FileAttachmentDto =>
  ({
    url: 'https://ejemplo.com/archivo.png',
    name: 'archivo.png',
    mimeType: 'image/png',
    size: 1 * MB,
    ...overrides,
  } as FileAttachmentDto);

describe('ValidarAdjuntoHandler', () => {
  let handler: ValidarAdjuntoHandler;

  beforeEach(() => {
    handler = new ValidarAdjuntoHandler();
  });

  it('debe aprobar un mensaje sin adjuntos', () => {
    const mensaje = { text_content: 'Solo texto', files: [] } as MessageDto;
    expect(handler.manejar(mensaje).valido).toBe(true);
  });

  it('debe aprobar un adjunto de tipo e tamaño permitido', () => {
    const mensaje = {
      text_content: 'Con imagen',
      files: [crearArchivo()],
    } as MessageDto;
    expect(handler.manejar(mensaje).valido).toBe(true);
  });

  it('debe rechazar un adjunto que supera el tamaño máximo', () => {
    const mensaje = {
      text_content: 'Archivo grande',
      files: [crearArchivo({ size: (MAX_TAMANO_ADJUNTO_MB + 1) * MB })],
    } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_ADJUNTO_TAMANO_EXCEDIDO');
  });

  it('debe rechazar un tipo MIME no permitido', () => {
    const mensaje = {
      text_content: 'Ejecutable',
      files: [crearArchivo({ mimeType: 'application/x-msdownload', name: 'virus.exe' })],
    } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_ADJUNTO_TIPO_NO_PERMITIDO');
  });

  it('debe rechazar en el primer archivo inválido y cortar la validación', () => {
    const mensaje = {
      text_content: 'Múltiples',
      files: [
        crearArchivo({ mimeType: 'application/x-msdownload' }),
        crearArchivo(),
      ],
    } as MessageDto;
    const resultado = handler.manejar(mensaje);
    expect(resultado.valido).toBe(false);
    expect(resultado.codigoError).toBe('MSG_ADJUNTO_TIPO_NO_PERMITIDO');
  });
});
