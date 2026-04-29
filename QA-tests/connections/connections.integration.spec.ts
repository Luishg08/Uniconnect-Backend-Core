import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConnectionsController } from 'src/connections/connections.controller';
import { ConnectionsService } from 'src/connections/connections.service';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import {
  QA_JWT_SECRET,
  createConfigServiceMock,
  signTestJwt,
} from '../helpers/jwt-test.helper';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const SOLICITANTE_ID = 10;
const DESTINATARIO_ID = 20;
const EXTRANO_ID = 99;
const CONEXION_ID = 55;

const mockConexionPendiente = {
  id_connection: CONEXION_ID,
  requester_id: SOLICITANTE_ID,
  adressee_id: DESTINATARIO_ID,
  status: 'pending',
  request_at: new Date(),
};

const mockConexionAceptada = {
  ...mockConexionPendiente,
  status: 'accepted',
  respondend_at: new Date(),
};

const mockConexionRechazada = {
  ...mockConexionPendiente,
  status: 'rejected',
  respondend_at: new Date(),
};

// ─── módulo de prueba ─────────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    connection: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

async function buildApp(prismaMock: ReturnType<typeof createPrismaMock>) {
  const usersServiceMock = {
    findBlacklistedToken: jest.fn().mockResolvedValue(null),
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: QA_JWT_SECRET }),
    ],
    controllers: [ConnectionsController],
    providers: [
      ConnectionsService,
      JwtStrategy,
      { provide: PrismaService, useValue: prismaMock },
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      { provide: UsersService, useValue: usersServiceMock },
      { provide: ConfigService, useValue: createConfigServiceMock() },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  return app;
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('[QA] Flujo de conexiones — contrato de API', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let tokenSolicitante: string;
  let tokenDestinatario: string;
  let tokenExtrano: string;

  beforeAll(async () => {
    tokenSolicitante = signTestJwt(SOLICITANTE_ID);
    tokenDestinatario = signTestJwt(DESTINATARIO_ID);
    tokenExtrano = signTestJwt(EXTRANO_ID);
    prisma = createPrismaMock();
    app = await buildApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /connections/request ──────────────────────────────────────────────────

  describe('POST /connections/request', () => {
    describe('Flujo exitoso', () => {
      it('retorna 201 con id_connection y mensaje', async () => {
        prisma.connection.findFirst.mockResolvedValue(null);
        prisma.connection.create.mockResolvedValue({
          id_connection: CONEXION_ID,
          requester_id: SOLICITANTE_ID,
          adressee_id: DESTINATARIO_ID,
          status: 'pending',
          requester: { id_user: SOLICITANTE_ID, full_name: 'Solicitante' },
        });

        const res = await request(app.getHttpServer())
          .post('/connections/request')
          .set('Authorization', `Bearer ${tokenSolicitante}`)
          .send({ addressee_id: DESTINATARIO_ID })
          .expect(201);

        expect(res.body).toHaveProperty('id_connection');
        expect(res.body).toHaveProperty('message');
      });

      it('persiste la conexión mediante connection.create con los datos correctos', async () => {
        prisma.connection.findFirst.mockResolvedValue(null);
        prisma.connection.create.mockResolvedValue({
          id_connection: CONEXION_ID,
          requester_id: SOLICITANTE_ID,
          adressee_id: DESTINATARIO_ID,
          status: 'pending',
        });

        await request(app.getHttpServer())
          .post('/connections/request')
          .set('Authorization', `Bearer ${tokenSolicitante}`)
          .send({ addressee_id: DESTINATARIO_ID })
          .expect(201);

        expect(prisma.connection.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              requester_id: SOLICITANTE_ID,
              adressee_id: DESTINATARIO_ID,
              status: 'pending',
            }),
          }),
        );
      });
    });

    describe('Auto-solicitud → 400', () => {
      it('retorna 400 cuando el solicitante y el destinatario son el mismo usuario', async () => {
        const res = await request(app.getHttpServer())
          .post('/connections/request')
          .set('Authorization', `Bearer ${tokenSolicitante}`)
          .send({ addressee_id: SOLICITANTE_ID })
          .expect(400);

        expect(res.body.message).toMatch(/ti mismo/i);
        expect(prisma.connection.create).not.toHaveBeenCalled();
      });
    });

    describe('Solicitud duplicada o conexión existente → 400', () => {
      it('retorna 400 cuando ya existe una solicitud pendiente', async () => {
        prisma.connection.findFirst.mockResolvedValue(mockConexionPendiente);

        await request(app.getHttpServer())
          .post('/connections/request')
          .set('Authorization', `Bearer ${tokenSolicitante}`)
          .send({ addressee_id: DESTINATARIO_ID })
          .expect(400);
      });

      it('retorna 400 cuando existe una conexión rechazada (re-solicitud bloqueada)', async () => {
        prisma.connection.findFirst.mockResolvedValue(mockConexionRechazada);

        const res = await request(app.getHttpServer())
          .post('/connections/request')
          .set('Authorization', `Bearer ${tokenSolicitante}`)
          .send({ addressee_id: DESTINATARIO_ID })
          .expect(400);

        expect(res.body.message).toBeDefined();
      });
    });

    describe('Validación → 400', () => {
      it('retorna 400 cuando falta addressee_id', async () => {
        await request(app.getHttpServer())
          .post('/connections/request')
          .set('Authorization', `Bearer ${tokenSolicitante}`)
          .send({})
          .expect(400);
      });
    });

    describe('Sin autenticación → 401', () => {
      it('retorna 401 cuando no se envía token', async () => {
        await request(app.getHttpServer())
          .post('/connections/request')
          .send({ addressee_id: DESTINATARIO_ID })
          .expect(401);
      });
    });
  });

  // ── PATCH /connections/:id/accept ─────────────────────────────────────────────

  describe('PATCH /connections/:id/accept', () => {
    describe('Flujo exitoso', () => {
      it('retorna 200 con mensaje y status=accepted', async () => {
        prisma.connection.findUnique.mockResolvedValue(mockConexionPendiente);
        prisma.connection.update.mockResolvedValue(mockConexionAceptada);

        const res = await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/accept`)
          .set('Authorization', `Bearer ${tokenDestinatario}`)
          .expect(200);

        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('connection');
        expect(res.body.connection).toHaveProperty('status', 'accepted');
      });

      it('actualiza el estado a accepted en la base de datos', async () => {
        prisma.connection.findUnique.mockResolvedValue(mockConexionPendiente);
        prisma.connection.update.mockResolvedValue(mockConexionAceptada);

        await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/accept`)
          .set('Authorization', `Bearer ${tokenDestinatario}`)
          .expect(200);

        expect(prisma.connection.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id_connection: CONEXION_ID },
            data: expect.objectContaining({ status: 'accepted' }),
          }),
        );
      });
    });

    describe('Usuario no es el destinatario → 400', () => {
      it('retorna 400 y no actualiza la conexión', async () => {
        prisma.connection.findUnique.mockResolvedValue(mockConexionPendiente);

        await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/accept`)
          .set('Authorization', `Bearer ${tokenExtrano}`)
          .expect(400);

        expect(prisma.connection.update).not.toHaveBeenCalled();
      });
    });

    describe('Solicitud no encontrada → 404', () => {
      it('retorna 404 cuando la conexión no existe', async () => {
        prisma.connection.findUnique.mockResolvedValue(null);

        await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/accept`)
          .set('Authorization', `Bearer ${tokenDestinatario}`)
          .expect(404);
      });
    });

    describe('Solicitud ya respondida → 400', () => {
      it('retorna 400 cuando la conexión ya fue aceptada', async () => {
        prisma.connection.findUnique.mockResolvedValue(mockConexionAceptada);

        await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/accept`)
          .set('Authorization', `Bearer ${tokenDestinatario}`)
          .expect(400);
      });
    });

    describe('Sin autenticación → 401', () => {
      it('retorna 401 cuando no se envía token', async () => {
        await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/accept`)
          .expect(401);
      });
    });
  });

  // ── PATCH /connections/:id/reject ─────────────────────────────────────────────

  describe('PATCH /connections/:id/reject', () => {
    describe('Flujo exitoso', () => {
      it('retorna 200 con status=rejected', async () => {
        prisma.connection.findUnique.mockResolvedValue(mockConexionPendiente);
        prisma.connection.update.mockResolvedValue(mockConexionRechazada);

        const res = await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/reject`)
          .set('Authorization', `Bearer ${tokenDestinatario}`)
          .expect(200);

        expect(res.body).toHaveProperty('message');
        expect(res.body.connection).toHaveProperty('status', 'rejected');
      });
    });

    describe('Usuario no es el destinatario → 400', () => {
      it('retorna 400 cuando el usuario no es el destinatario', async () => {
        prisma.connection.findUnique.mockResolvedValue(mockConexionPendiente);

        await request(app.getHttpServer())
          .patch(`/connections/${CONEXION_ID}/reject`)
          .set('Authorization', `Bearer ${tokenExtrano}`)
          .expect(400);
      });
    });
  });

  // ── GET /connections/pending ──────────────────────────────────────────────────

  describe('GET /connections/pending', () => {
    it('retorna 200 con arreglo de solicitudes pendientes', async () => {
      prisma.connection.findMany.mockResolvedValue([
        {
          id_connection: CONEXION_ID,
          requester: {
            id_user: SOLICITANTE_ID,
            full_name: 'Solicitante',
            email: 'sol@ucaldas.edu.co',
            picture: null,
          },
          request_at: new Date(),
          status: 'pending',
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/connections/pending')
        .set('Authorization', `Bearer ${tokenDestinatario}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('id_connection');
    });

    it('retorna 200 con arreglo vacío cuando no hay solicitudes', async () => {
      prisma.connection.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/connections/pending')
        .set('Authorization', `Bearer ${tokenDestinatario}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('retorna 401 cuando no se envía token', async () => {
      await request(app.getHttpServer()).get('/connections/pending').expect(401);
    });
  });
});
