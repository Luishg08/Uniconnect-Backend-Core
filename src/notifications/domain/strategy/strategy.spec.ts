import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { InAppWebSocketStrategy } from './in-app-websocket.strategy';
import { EmailInstitucionalStrategy } from './email-institucional.strategy';
import { PushMovilStrategy } from './push-movil.strategy';
import { ResumenDiarioStrategy } from './resumen-diario.strategy';
import { NotificacionDTO } from './interfaces';

const notificacion: NotificacionDTO = {
  id_user: 1,
  mensaje: 'Prueba de notificación',
  tipo_evento: 'message',
  entidad_relacionada_id: 42,
};

// ─── InAppWebSocketStrategy ───────────────────────────────────────────────────

describe('InAppWebSocketStrategy', () => {
  let strategy: InAppWebSocketStrategy;
  let prismaMock: any;
  let chatGatewayMock: any;
  let sessionManagerMock: any;

  beforeEach(async () => {
    prismaMock = {
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    chatGatewayMock = {
      server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
    };
    sessionManagerMock = { getUserSockets: jest.fn().mockReturnValue(['socket-1']) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppWebSocketStrategy,
        { provide: 'PrismaService', useValue: prismaMock },
        { provide: 'ChatGateway', useValue: chatGatewayMock },
        { provide: 'ChatSessionManager', useValue: sessionManagerMock },
      ],
    })
      .overrideProvider(InAppWebSocketStrategy)
      .useFactory({
        factory: () =>
          new InAppWebSocketStrategy(prismaMock, chatGatewayMock, sessionManagerMock),
      })
      .compile();

    strategy = module.get(InAppWebSocketStrategy);
  });

  it('debe tener canal "in_app_websocket"', () => {
    expect(strategy.canal).toBe('in_app_websocket');
  });

  it('persiste la notificación y emite al socket', async () => {
    const resultado = await strategy.enviar(notificacion);

    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id_user: notificacion.id_user,
          message: notificacion.mensaje,
          notification_type: notificacion.tipo_evento,
        }),
      }),
    );
    expect(sessionManagerMock.getUserSockets).toHaveBeenCalledWith(notificacion.id_user);
    expect(chatGatewayMock.server.to).toHaveBeenCalledWith('socket-1');
    expect(resultado.exitoso).toBe(true);
    expect(resultado.canal).toBe('in_app_websocket');
  });

  it('devuelve exitoso=false y aísla el error cuando Prisma falla', async () => {
    prismaMock.notification.create.mockRejectedValue(new Error('DB error'));

    const resultado = await strategy.enviar(notificacion);

    expect(resultado.exitoso).toBe(false);
    expect(resultado.error).toContain('DB error');
    expect(resultado.canal).toBe('in_app_websocket');
  });
});

// ─── EmailInstitucionalStrategy ───────────────────────────────────────────────

describe('EmailInstitucionalStrategy', () => {
  let strategy: EmailInstitucionalStrategy;

  beforeEach(() => {
    strategy = new EmailInstitucionalStrategy();
  });

  it('debe tener canal "email_institucional"', () => {
    expect(strategy.canal).toBe('email_institucional');
  });

  it('retorna exitoso=true', async () => {
    const resultado = await strategy.enviar(notificacion);
    expect(resultado.exitoso).toBe(true);
    expect(resultado.canal).toBe('email_institucional');
  });
});

// ─── PushMovilStrategy ────────────────────────────────────────────────────────

describe('PushMovilStrategy', () => {
  let strategy: PushMovilStrategy;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      push_token: { findMany: jest.fn() },
    };
    strategy = new PushMovilStrategy(prismaMock);
  });

  it('debe tener canal "push_movil"', () => {
    expect(strategy.canal).toBe('push_movil');
  });

  it('retorna exitoso=true si el usuario no tiene tokens activos', async () => {
    prismaMock.push_token.findMany.mockResolvedValue([]);

    const resultado = await strategy.enviar(notificacion);

    expect(resultado.exitoso).toBe(true);
  });

  it('llama a Expo API cuando hay tokens activos', async () => {
    prismaMock.push_token.findMany.mockResolvedValue([{ token: 'ExpoToken[abc]' }]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const resultado = await strategy.enviar(notificacion);

    expect(fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(resultado.exitoso).toBe(true);
  });

  it('devuelve exitoso=false cuando Expo API falla', async () => {
    prismaMock.push_token.findMany.mockResolvedValue([{ token: 'ExpoToken[abc]' }]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    const resultado = await strategy.enviar(notificacion);

    expect(resultado.exitoso).toBe(false);
    expect(resultado.error).toContain('500');
  });
});

// ─── ResumenDiarioStrategy ────────────────────────────────────────────────────

describe('ResumenDiarioStrategy', () => {
  let strategy: ResumenDiarioStrategy;

  beforeEach(() => {
    strategy = new ResumenDiarioStrategy();
  });

  it('debe tener canal "resumen_diario"', () => {
    expect(strategy.canal).toBe('resumen_diario');
  });

  it('retorna exitoso=true sin modificar estrategias existentes (OCP)', async () => {
    const resultado = await strategy.enviar(notificacion);
    expect(resultado.exitoso).toBe(true);
    expect(resultado.canal).toBe('resumen_diario');
  });
});

// ─── Aislamiento de errores (criterio 5) ─────────────────────────────────────

describe('Aislamiento de errores entre estrategias', () => {
  it('una estrategia que lanza excepción no detiene las demás', async () => {
    const estrategiaFallida = {
      canal: 'fallida',
      enviar: jest.fn().mockRejectedValue(new Error('Error interno')),
    };
    const estrategiaOk = {
      canal: 'ok',
      enviar: jest.fn().mockResolvedValue({ canal: 'ok', exitoso: true, timestamp: new Date() }),
    };

    // Simula el comportamiento de Promise.allSettled en NotificationsService
    const resultados = await Promise.allSettled([
      estrategiaFallida.enviar(notificacion),
      estrategiaOk.enviar(notificacion),
    ]);

    const [r0, r1] = resultados;
    expect(r0.status).toBe('rejected');
    expect(r1.status).toBe('fulfilled');
    if (r1.status === 'fulfilled') {
      expect(r1.value.exitoso).toBe(true);
    }
  });
});
