import { ValidacionChainFactory } from '../validacion-chain.factory';
import { MessageDto } from '../../../dto/message.dto';
import { FileAttachmentDto } from '../../../dto/file-attachment.dto';
import { MentionDto } from '../../../dto/mention.dto';

const mensajeValido = (): MessageDto =>
  ({
    sender_id: 1,
    recipient_id: 2,
    text_content: 'Hola, ¿cómo estás?',
    files: [],
    mentions: [],
  } as MessageDto);

describe('ValidacionChainFactory', () => {
  describe('Caso exitoso: el mensaje pasa todas las validaciones', () => {
    it('debe retornar valido: true cuando el mensaje cumple todas las reglas', () => {
      const cadena = ValidacionChainFactory.crearCadena();
      const resultado = cadena.manejar(mensajeValido());
      expect(resultado.valido).toBe(true);
    });
  });

  describe('Cortocircuito por tamaño', () => {
    it('debe cortar en ValidarTamanoHandler y devolver código específico', () => {
      const cadena = ValidacionChainFactory.crearCadena({ maxLongitud: 10 });
      const mensaje = { ...mensajeValido(), text_content: 'Mensaje que es demasiado largo' };
      const resultado = cadena.manejar(mensaje);
      expect(resultado.valido).toBe(false);
      expect(resultado.codigoError).toBe('MSG_TAMANO_EXCEDIDO');
    });
  });

  describe('Cortocircuito por contenido inapropiado', () => {
    it('debe cortar en ValidarContenidoHandler y devolver código específico', () => {
      const cadena = ValidacionChainFactory.crearCadena();
      const mensaje = { ...mensajeValido(), text_content: 'Eres un idiota' };
      const resultado = cadena.manejar(mensaje);
      expect(resultado.valido).toBe(false);
      expect(resultado.codigoError).toBe('MSG_CONTENIDO_INAPROPIADO');
    });
  });

  describe('Cortocircuito por menciones inválidas', () => {
    it('debe cortar en ValidarMencionesHandler con userId inválido', () => {
      const cadena = ValidacionChainFactory.crearCadena();
      const mensaje = {
        ...mensajeValido(),
        mentions: [{ userId: 0, displayName: 'x', position: 0 } as MentionDto],
      };
      const resultado = cadena.manejar(mensaje);
      expect(resultado.valido).toBe(false);
      expect(resultado.codigoError).toBe('MSG_MENCIONES_INVALIDAS');
    });
  });

  describe('Cortocircuito por permisos insuficientes', () => {
    it('debe cortar en ValidarPermisosHandler cuando no hay sender_id', () => {
      const cadena = ValidacionChainFactory.crearCadena();
      const mensaje = { text_content: 'Hola', recipient_id: 2 } as MessageDto;
      const resultado = cadena.manejar(mensaje);
      expect(resultado.valido).toBe(false);
      expect(resultado.codigoError).toBe('MSG_PERMISOS_INSUFICIENTES');
    });
  });

  describe('Cortocircuito por adjunto inválido', () => {
    it('debe cortar en ValidarAdjuntoHandler con tipo MIME no permitido', () => {
      const cadena = ValidacionChainFactory.crearCadena();
      const mensaje = {
        ...mensajeValido(),
        files: [
          {
            url: 'http://x.com/f.exe',
            name: 'f.exe',
            mimeType: 'application/x-msdownload',
            size: 1024,
          } as FileAttachmentDto,
        ],
      };
      const resultado = cadena.manejar(mensaje);
      expect(resultado.valido).toBe(false);
      expect(resultado.codigoError).toBe('MSG_ADJUNTO_TIPO_NO_PERMITIDO');
    });
  });

  describe('Extensibilidad: ValidarAdjuntoHandler es opcional', () => {
    it('debe omitir validación de adjuntos cuando incluirValidacionAdjunto es false', () => {
      const cadena = ValidacionChainFactory.crearCadena({ incluirValidacionAdjunto: false });
      const mensaje = {
        ...mensajeValido(),
        files: [
          {
            url: 'http://x.com/f.exe',
            name: 'f.exe',
            mimeType: 'application/x-msdownload',
            size: 1024,
          } as FileAttachmentDto,
        ],
      };
      // Sin el handler de adjunto la cadena no rechaza el tipo MIME
      const resultado = cadena.manejar(mensaje);
      expect(resultado.valido).toBe(true);
    });
  });
});
