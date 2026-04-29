/**
 * Pruebas de Integración QA — Notificaciones
 *
 * Por qué es crítico:
 *   Las notificaciones son el mecanismo de entrega para cada evento de grupo (solicitudes de unión,
 *   invitaciones, transferencias de administrador). Si los endpoints de lectura/lista se rompen, los usuarios acumulan
 *   un conteo de no leídos que nunca pueden descartar, degradando la UX y la confianza.
 *   El conteo de no leídos impulsa específicamente la renderización de insignias en la interfaz de usuario en cada carga de página.
 *
 * Endpoints bajo prueba:
 *   GET   /notifications               — listar todas las notificaciones para el usuario
 *   GET   /notifications/unread-count  — conteo de insignias no leídas
 *   PATCH /notifications/:id/read      — marcar una sola notificación como leída
 *   PATCH /notifications/read-all      — marcar todas las notificaciones como leídas
 *
 * Afirmaciones del contrato:
 *   GET list      → 200 + array (puede estar vacío)
 *   GET count     → 200 + { count: number }
 *   PATCH :id     → 200 + { success: true }
 *   PATCH read-all → 200 + { success: true, updated: number }
 *   Notificación perteneciente a otro usuario → 404 en PATCH :id
 *   Sin autenticación                              → 401 en todos los endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsController } from 'src/notifications/notifications.controller';
import { NotificationsService } from 'src/notifications/notifications.service';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import {
  QA_JWT_SECRET,
  createConfigServiceMock,
  signTestJwt,
} from '../helpers/jwt-test.helper';

// ─── Datos de prueba ─────────────────────────────────────────────────────────────────

const USER_ID = 15;
const NOTIFICATION_ID = 42;

const mockNotification = {
  id_notification: NOTIFICATION_ID,
  id_user: USER_ID,
  message: 'Test notification',
  is_read: false,
  created_at: new Date().toISOString(),
  notification_type: 'join_request',
  related_entity_id: 1,
};

// ─── fábrica de módulos de prueba ───────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
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
    controllers: [NotificationsController],
    providers: [
      NotificationsService,
      JwtStrategy,
      { provide: PrismaService, useValue: prismaMock },
      { provide: UsersService, useValue: usersServiceMock },
    ],
  })
    .overrideProvider('ConfigService')
    .useValue(createConfigServiceMock())
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  return app;
}

// ─── pruebas ─────────────────────────────────────────────────────────────────────

describe('[QA] Notificaciones — contrato', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let userToken: string;

  beforeAll(async () => {
    userToken = signTestJwt(USER_ID);
    prisma = createPrismaMock();
    app = await buildApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /notifications ───────────────────────────────────────────────────────

  describe('GET /notifications', () => {
    it('debe retornar 200 + array de notificaciones', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Contrato: debe retornar un array
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('debe consultar solo las notificaciones del usuario autenticado', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id_user: USER_ID }),
        }),
      );
    });

    it('debe retornar 200 con un array vacío cuando el usuario no tiene notificaciones', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return notifications sorted by created_at desc', async () => {
      const older = { ...mockNotification, id_notification: 1, created_at: '2026-01-01T00:00:00Z' };
      const newer = { ...mockNotification, id_notification: 2, created_at: '2026-04-01T00:00:00Z' };
      prisma.notification.findMany.mockResolvedValue([newer, older]);

      await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.objectContaining({ created_at: 'desc' }),
        }),
      );
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(401);
    });
  });

  // ── GET /notifications/unread-count ─────────────────────────────────────────

  describe('GET /notifications/unread-count', () => {
    it('should return 200 + { count: number }', async () => {
      prisma.notification.count.mockResolvedValue(5);

      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Contract: must have a numeric count field
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBe(5);
    });

    it('should return { count: 0 } when all notifications are read', async () => {
      prisma.notification.count.mockResolvedValue(0);

      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.count).toBe(0);
    });

    it('should count only unread notifications for the authenticated user', async () => {
      prisma.notification.count.mockResolvedValue(3);

      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(prisma.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id_user: USER_ID,
            is_read: false,
          }),
        }),
      );
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(401);
    });
  });

  // ── PATCH /notifications/:id/read ────────────────────────────────────────────

  describe('PATCH /notifications/:id/read', () => {
    it('should return 200 + { success: true } when notification exists', async () => {
      // updateMany returns count > 0 → notification found and updated
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app.getHttpServer())
        .patch(`/notifications/${NOTIFICATION_ID}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Contract: must confirm success
      expect(res.body).toHaveProperty('success', true);
    });

    it('should update only is_read for the given notification', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await request(app.getHttpServer())
        .patch(`/notifications/${NOTIFICATION_ID}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id_notification: NOTIFICATION_ID,
            id_user: USER_ID,
          }),
          data: { is_read: true },
        }),
      );
    });

    it('should return 404 when notification does not belong to the user', async () => {
      // updateMany affects 0 rows → service throws NotFoundException
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      await request(app.getHttpServer())
        .patch(`/notifications/${NOTIFICATION_ID}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch(`/notifications/${NOTIFICATION_ID}/read`)
        .expect(401);
    });
  });

  // ── PATCH /notifications/read-all ────────────────────────────────────────────

  describe('PATCH /notifications/read-all', () => {
    it('should return 200 + { success: true, updated: number }', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const res = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Contract: must include both success flag and updated count
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('updated', 3);
    });

    it('should mark ALL notifications for the user as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 7 });

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id_user: USER_ID }),
          data: { is_read: true },
        }),
      );
    });

    it('should return 200 + { updated: 0 } when there is nothing to mark', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.updated).toBe(0);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .expect(401);
    });
  });
});
