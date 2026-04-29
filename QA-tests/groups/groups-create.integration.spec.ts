import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { GroupsController } from 'src/groups/groups.controller';
import { GroupsService } from 'src/groups/groups.service';
import { GroupBusinessValidator } from 'src/groups/validators/group-business.validator';
import { GroupOwnershipGuard } from 'src/groups/guards/group-ownership.guard';
import { CanCreateGroupGuard } from 'src/groups/guards/can-create-group.guard';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { StudyGroupSubject } from 'src/groups/domain/observer/study-group-subject';
import { ConfigService } from '@nestjs/config';
import {
  QA_JWT_SECRET,
  createConfigServiceMock,
  signTestJwt,
} from '../helpers/jwt-test.helper';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const OWNER_ID = 10;
const COURSE_ID = 5;

const mockUsuario = {
  id_user: OWNER_ID,
  email: 'owner@ucaldas.edu.co',
  full_name: 'Propietario Grupo',
  id_role: 1,
  role: { id_role: 1, name: 'student' },
};

const mockCurso = { id_course: COURSE_ID, name: 'Cálculo I' };

const mockGrupo = {
  id_group: 1,
  name: 'Grupo Cálculo A',
  description: 'Grupo de estudio',
  id_course: COURSE_ID,
  owner_id: OWNER_ID,
  is_direct_message: false,
  created_at: new Date(),
};

const crearGrupoDto = {
  name: 'Grupo Cálculo A',
  description: 'Grupo de estudio',
  id_course: COURSE_ID,
};

// ─── módulo de prueba ─────────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    course: { findUnique: jest.fn() },
    group: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockResolvedValue(mockGrupo),
    },
    membership: { findUnique: jest.fn(), create: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
}

async function buildApp(prismaMock: ReturnType<typeof createPrismaMock>) {
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
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      { provide: StudyGroupSubject, useValue: { notify: jest.fn(), attach: jest.fn(), detach: jest.fn() } },
      { provide: UsersService, useValue: { findBlacklistedToken: jest.fn().mockResolvedValue(null) } },
      {
        provide: ConfigService,
        useValue: createConfigServiceMock()
      },
    ],
  })
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));
  await app.init();

  return app;
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('[QA] POST /groups — contrato de API', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let tokenOwner: string;

  beforeAll(async () => {
    tokenOwner = signTestJwt(OWNER_ID);
    prisma = createPrismaMock();
    app = await buildApp(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Flujo exitoso ─────────────────────────────────────────────────────────────

  describe('Creación exitosa de grupo', () => {
    it('retorna 201 con el registro del grupo cuando todas las validaciones pasan', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsuario);
      prisma.course.findUnique.mockResolvedValue(mockCurso);
      prisma.enrollment.findFirst.mockResolvedValue({ id_user: OWNER_ID, id_course: COURSE_ID, status: 'active' });
      prisma.group.count.mockResolvedValue(0);
      prisma.$transaction.mockImplementation(async (fn: Function) => {
        prisma.group.create.mockResolvedValue(mockGrupo);
        prisma.membership.create.mockResolvedValue({ id_membership: 1, id_user: OWNER_ID, id_group: 1, is_admin: true });
        return await fn(prisma);
      });

      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(crearGrupoDto)
        .expect(201);

      expect(res.body).toHaveProperty('id_group');
      expect(res.body).toHaveProperty('name', crearGrupoDto.name);
      expect(res.body).toHaveProperty('owner_id', OWNER_ID);
    });

    it('inscribe automáticamente al propietario como miembro admin', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsuario);
      prisma.course.findUnique.mockResolvedValue(mockCurso);
      prisma.enrollment.findFirst.mockResolvedValue({ status: 'active' });
      prisma.group.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation(async (fn: Function) => {
        prisma.group.create.mockResolvedValue({ ...mockGrupo, id_group: 2 });
        prisma.membership.create.mockResolvedValue({});
        return await fn(prisma);
      });

      await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(crearGrupoDto)
        .expect(201);

      expect(prisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id_user: OWNER_ID, is_admin: true }),
        }),
      );
    });
  });

  // ── Rechazo: límite de grupos ─────────────────────────────────────────────────

  describe('La asignatura ya tiene 3 grupos → 400', () => {
    // DISCREPANCIA: los criterios de aceptación solicitan 409, el código lanza 400 (ver QA-test.md §4)
    it('retorna 400 cuando la asignatura ya alcanzó el límite de 3 grupos', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsuario);
      prisma.course.findUnique.mockResolvedValue(mockCurso);
      prisma.enrollment.findFirst.mockResolvedValue({ status: 'active' });
      prisma.group.count.mockResolvedValue(3);

      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(crearGrupoDto)
        .expect(400);

      expect(res.body.message).toMatch(/3 grupos/);
    });

    it('no ejecuta la transacción cuando se alcanzó el límite', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsuario);
      prisma.course.findUnique.mockResolvedValue(mockCurso);
      prisma.enrollment.findFirst.mockResolvedValue({ status: 'active' });
      prisma.group.count.mockResolvedValue(3);

      await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(crearGrupoDto)
        .expect(400);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── Rechazo: no inscrito ──────────────────────────────────────────────────────

  describe('Usuario no inscrito en la asignatura → 403', () => {
    it('retorna 403 cuando el usuario no tiene inscripción activa', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsuario);
      prisma.course.findUnique.mockResolvedValue(mockCurso);
      prisma.enrollment.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(crearGrupoDto)
        .expect(403);

      expect(res.body.message).toMatch(/inscrito/i);
    });
  });

  // ── Rechazo: asignatura inexistente ───────────────────────────────────────────

  describe('Asignatura no existe → 404', () => {
    it('retorna 404 cuando id_course no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsuario);
      prisma.course.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(crearGrupoDto)
        .expect(404);
    });
  });

  // ── Sin autenticación ─────────────────────────────────────────────────────────

  describe('Sin autenticación → 401', () => {
    it('retorna 401 cuando no se envía encabezado Authorization', async () => {
      await request(app.getHttpServer())
        .post('/groups')
        .send(crearGrupoDto)
        .expect(401);
    });

    it('retorna 401 cuando el token está malformado', async () => {
      await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', 'Bearer no.es.valido')
        .send(crearGrupoDto)
        .expect(401);
    });
  });

  // ── Validación de campos ──────────────────────────────────────────────────────

  describe('Campos requeridos faltantes → 400', () => {
    it('retorna 400 cuando falta name', async () => {
      const { name: _n, ...sinNombre } = crearGrupoDto;
      await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(sinNombre)
        .expect(400);
    });

    it('retorna 400 cuando falta id_course', async () => {
      const { id_course: _c, ...sinCurso } = crearGrupoDto as any;
      await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${tokenOwner}`)
        .send(sinCurso)
        .expect(400);
    });
  });
});
