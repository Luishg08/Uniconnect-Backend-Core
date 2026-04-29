/**
 * Pruebas de Integración QA — PATCH /groups/:id/transferir-admin (flujo de dos pasos)
 *
 * La API implementa la transferencia de propiedad como DOS endpoints separados (US-W02):
 *
 *   Paso 1 — POST  /groups/:id/request-ownership-transfer/:candidateId
 *             El propietario designa un candidato → se establece pending_owner_id en la BD
 *
 *   Paso 2 — PATCH /groups/:id/accept-ownership-transfer
 *             El candidato acepta → se actualiza owner_id, se limpia pending_owner_id
 *
 * Contrato bajo prueba:
 *   Ruta feliz completa (solicitud → aceptación) → la BD refleja el nuevo propietario
 *   Paso 1: no-propietario intenta solicitar                    → 403
 *   Paso 1: transferencia ya pendiente                      → 400
 *   Paso 1: el candidato no es miembro del grupo               → 400
 *   Paso 2: no-candidato intenta aceptar                 → 403
 *   Paso 2: no hay transferencia pendiente                           → 400
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { GroupsController } from 'src/groups/groups.controller';
import { GroupsService } from 'src/groups/groups.service';
import { GroupBusinessValidator } from 'src/groups/validators/group-business.validator';
import { GroupOwnershipGuard } from 'src/groups/guards/group-ownership.guard';
import { CanCreateGroupGuard } from 'src/groups/guards/can-create-group.guard';
import { StudyGroupSubject } from 'src/groups/domain/observer/study-group-subject';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import {
  QA_JWT_SECRET,
  createConfigServiceMock,
  signTestJwt,
} from '../helpers/jwt-test.helper';

// ─── Datos de prueba ─────────────────────────────────────────────────────────────────

const OWNER_ID = 10;
const CANDIDATE_ID = 20;
const STRANGER_ID = 99;
const GROUP_ID = 1;

const mockOwner = {
  id_user: OWNER_ID,
  full_name: 'Current Owner',
  email: 'owner@ucaldas.edu.co',
};

const mockCandidate = {
  id_user: CANDIDATE_ID,
  full_name: 'New Owner',
  email: 'candidate@ucaldas.edu.co',
};

const mockGroupBase = {
  id_group: GROUP_ID,
  name: 'Grupo Test',
  owner_id: OWNER_ID,
  is_direct_message: false,
  pending_owner_id: null,
};

const mockGroupAfterRequest = {
  ...mockGroupBase,
  pending_owner_id: CANDIDATE_ID,
};

const mockGroupAfterAccept = {
  ...mockGroupBase,
  owner_id: CANDIDATE_ID,
  pending_owner_id: null,
  owner: mockCandidate,
};

// ─── fábrica de módulos de prueba ───────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    user: { findUnique: jest.fn() },
    group: { findUnique: jest.fn(), update: jest.fn() },
    membership: { findUnique: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({ id_notification: 1 }) },
    $transaction: jest.fn(),
  };
}

async function buildApp(prismaMock: ReturnType<typeof createPrismaMock>) {
  const usersServiceMock = {
    findBlacklistedToken: jest.fn().mockResolvedValue(null),
  };

  const eventEmitterMock = { emit: jest.fn() };

  const studyGroupSubjectMock = {
    notify: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: QA_JWT_SECRET, signOptions: { expiresIn: '2h' } }),
    ],
    controllers: [GroupsController],
    providers: [
      GroupsService,
      GroupBusinessValidator,
      GroupOwnershipGuard,
      CanCreateGroupGuard,
      JwtStrategy,
      { provide: PrismaService, useValue: prismaMock },
      { provide: EventEmitter2, useValue: eventEmitterMock },
      { provide: StudyGroupSubject, useValue: studyGroupSubjectMock },
      { provide: UsersService, useValue: usersServiceMock },
      { provide: 'ConfigService', useValue: createConfigServiceMock() },
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

describe('[QA] Flujo de dos pasos para transferencia de admin (US-W02) — contrato', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let ownerToken: string;
  let candidateToken: string;
  let strangerToken: string;

  beforeAll(async () => {
    ownerToken = signTestJwt(OWNER_ID);
    candidateToken = signTestJwt(CANDIDATE_ID);
    strangerToken = signTestJwt(STRANGER_ID);
    prisma = createPrismaMock();
    app = await buildApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notification.create.mockResolvedValue({ id_notification: 1 });
  });

  // ── Paso 1: solicitar transferencia ─────────────────────────────────────────────────

  describe('Paso 1 — POST /groups/:id/request-ownership-transfer/:candidateId', () => {
    describe('Ruta feliz', () => {
      it('debe retornar 201 y establecer pending_owner_id en la BD', async () => {
        // El servicio carga el grupo (no hay guardia en este endpoint)
        prisma.group.findUnique.mockResolvedValue(mockGroupBase);
        // Verificación de membresía del candidato
        prisma.membership.findUnique.mockResolvedValue({
          id_user: CANDIDATE_ID,
          id_group: GROUP_ID,
        });
        // Búsqueda de usuario candidato
        prisma.user.findUnique.mockResolvedValue(mockCandidate);
        // Actualización del grupo: establecer pending_owner_id
        prisma.group.update.mockResolvedValue(mockGroupAfterRequest);

        const res = await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(201);

        // Contrato: la respuesta debe incluir el grupo con pending_owner_id
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('candidate');
        expect(res.body.group).toHaveProperty('pending_owner_id', CANDIDATE_ID);
      });

      it('debe persistir pending_owner_id vía group.update', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupBase);
        prisma.membership.findUnique.mockResolvedValue({ id_user: CANDIDATE_ID });
        prisma.user.findUnique.mockResolvedValue(mockCandidate);
        prisma.group.update.mockResolvedValue(mockGroupAfterRequest);

        await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(201);

        // Contract: group.update must be called with the candidate's id
        expect(prisma.group.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id_group: GROUP_ID },
            data: { pending_owner_id: CANDIDATE_ID },
          }),
        );
      });
    });

    describe('Rejection scenarios', () => {
      it('should return 403 when caller is not the owner', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupBase);

        await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
          .set('Authorization', `Bearer ${strangerToken}`)
          .expect(403);
      });

      it('should return 400 when a transfer is already pending', async () => {
        // pending_owner_id is already set
        prisma.group.findUnique.mockResolvedValue(mockGroupAfterRequest);

        await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(400);
      });

      it('should return 400 when the candidate is not a group member', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupBase);
        prisma.membership.findUnique.mockResolvedValue(null); // not a member

        await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(400);
      });

      it('should return 400 when owner tries to transfer to themselves', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupBase);

        await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${OWNER_ID}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(400);
      });

      it('should return 401 when no token provided', async () => {
        await request(app.getHttpServer())
          .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
          .expect(401);
      });
    });
  });

  // ── Step 2: accept transfer ──────────────────────────────────────────────────

  describe('Step 2 — PATCH /groups/:id/accept-ownership-transfer', () => {
    describe('Happy path', () => {
      it('should return 200 and update owner_id in DB', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupAfterRequest);
        // Transaction: update group + two membership rows
        prisma.$transaction.mockImplementation(async (fn: Function) => {
          prisma.group.update.mockResolvedValue(mockGroupAfterAccept);
          prisma.membership.update.mockResolvedValue({});
          return await fn(prisma);
        });

        const res = await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .expect(200);

        // Contract: response must confirm ownership change
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('new_owner_id', CANDIDATE_ID);
        expect(res.body).toHaveProperty('previous_owner_id', OWNER_ID);
      });

      it('should clear pending_owner_id and set new owner_id in DB', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupAfterRequest);
        prisma.$transaction.mockImplementation(async (fn: Function) => {
          prisma.group.update.mockResolvedValue(mockGroupAfterAccept);
          prisma.membership.update.mockResolvedValue({});
          return await fn(prisma);
        });

        await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .expect(200);

        // Contract: group.update must set new owner and clear pending field
        expect(prisma.group.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id_group: GROUP_ID },
            data: { owner_id: CANDIDATE_ID, pending_owner_id: null },
          }),
        );
      });

      it('should promote both old owner and new owner to admin (is_admin: true)', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupAfterRequest);
        prisma.$transaction.mockImplementation(async (fn: Function) => {
          prisma.group.update.mockResolvedValue(mockGroupAfterAccept);
          prisma.membership.update.mockResolvedValue({});
          return await fn(prisma);
        });

        await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .expect(200);

        // Both membership.update calls must set is_admin: true
        const membershipUpdateCalls = prisma.membership.update.mock.calls;
        expect(membershipUpdateCalls.length).toBeGreaterThanOrEqual(2);

        membershipUpdateCalls.forEach((call: any[]) => {
          expect(call[0].data).toEqual(expect.objectContaining({ is_admin: true }));
        });
      });
    });

    describe('Rejection scenarios', () => {
      it('should return 403 when caller is not the designated candidate', async () => {
        // pending_owner_id = CANDIDATE_ID, but stranger calls
        prisma.group.findUnique.mockResolvedValue(mockGroupAfterRequest);

        await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .set('Authorization', `Bearer ${strangerToken}`)
          .expect(403);
      });

      it('should return 403 when the owner tries to self-accept', async () => {
        // Owner is not the candidate
        prisma.group.findUnique.mockResolvedValue(mockGroupAfterRequest);

        await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(403);
      });

      it('should return 400 when there is no pending transfer', async () => {
        prisma.group.findUnique.mockResolvedValue(mockGroupBase); // pending_owner_id is null

        await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .expect(400);
      });

      it('should return 401 when no token provided', async () => {
        await request(app.getHttpServer())
          .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
          .expect(401);
      });
    });
  });

  // ── Full two-step flow ───────────────────────────────────────────────────────

  describe('Full two-step flow: request → accept', () => {
    it('should transition group from owner=OWNER to owner=CANDIDATE across both steps', async () => {
      // --- Step 1 ---
      prisma.group.findUnique.mockResolvedValueOnce(mockGroupBase);
      prisma.membership.findUnique.mockResolvedValueOnce({ id_user: CANDIDATE_ID });
      prisma.user.findUnique.mockResolvedValueOnce(mockCandidate);
      prisma.group.update.mockResolvedValueOnce(mockGroupAfterRequest);

      const step1 = await request(app.getHttpServer())
        .post(`/groups/${GROUP_ID}/request-ownership-transfer/${CANDIDATE_ID}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(step1.body.group.pending_owner_id).toBe(CANDIDATE_ID);

      // --- Step 2 ---
      prisma.group.findUnique.mockResolvedValueOnce(mockGroupAfterRequest);
      prisma.$transaction.mockImplementation(async (fn: Function) => {
        prisma.group.update.mockResolvedValue(mockGroupAfterAccept);
        prisma.membership.update.mockResolvedValue({});
        return await fn(prisma);
      });

      const step2 = await request(app.getHttpServer())
        .patch(`/groups/${GROUP_ID}/accept-ownership-transfer`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      // Final state: new_owner_id is the candidate
      expect(step2.body.new_owner_id).toBe(CANDIDATE_ID);
      expect(step2.body.previous_owner_id).toBe(OWNER_ID);

      // DB: group.update was called twice (once per step)
      expect(prisma.group.update).toHaveBeenCalledTimes(2);
    });
  });
});
