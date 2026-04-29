import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RolesService } from 'src/roles/roles.service';
import { PermissionsService } from 'src/permissions/permissions.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { QA_JWT_SECRET, createConfigServiceMock } from '../helpers/jwt-test.helper';


function buildGoogleUserinfo(overrides: Partial<{
  email: string;
  email_verified: boolean;
  name: string;
  sub: string;
}> = {}) {
  return {
    sub: 'google-sub-001',
    email: 'student@ucaldas.edu.co',
    email_verified: true,
    name: 'Estudiante Test',
    picture: 'https://example.com/pic.jpg',
    ...overrides,
  };
}

function mockFetch(userinfo: object) {
  (global.fetch as jest.Mock).mockResolvedValue({
    json: jest.fn().mockResolvedValue(userinfo),
  });
}


async function buildApp(): Promise<{
  app: INestApplication;
  usersServiceMock: any;
  rolesServiceMock: any;
  permissionsServiceMock: any;
}> {
  const usersServiceMock = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findBlacklistedToken: jest.fn().mockResolvedValue(null),
  };

  const rolesServiceMock = {
    getStudentRole: jest.fn().mockResolvedValue({ id_role: 1, name: 'student' }),
  };

  const permissionsServiceMock = {
    getClaimsForRole: jest.fn().mockResolvedValue([]),
  };

  const prismaMock = {
    token_blacklist: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: QA_JWT_SECRET, signOptions: { expiresIn: '2h' } }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: PrismaService, useValue: prismaMock },
      { provide: UsersService, useValue: usersServiceMock },
      { provide: RolesService, useValue: rolesServiceMock },
      { provide: PermissionsService, useValue: permissionsServiceMock },
      { provide: HttpService, useValue: {} },
      { provide: 'CONFIG_OPTIONS', useValue: {} },
      { provide: ConfigService, useValue: createConfigServiceMock() },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  return { app, usersServiceMock, rolesServiceMock, permissionsServiceMock };
}


describe('[QA] POST /auth/google — contrato de API', () => {
  let app: INestApplication;
  let usersServiceMock: any;
  let rolesServiceMock: any;
  let permissionsServiceMock: any;

  const mockUsuario = {
    id_user: 1,
    email: 'student@ucaldas.edu.co',
    full_name: 'Estudiante Test',
    picture: 'https://example.com/pic.jpg',
    id_role: 1,
    google_sub: 'google-sub-001',
    role: { id_role: 1, name: 'student' },
  };

  beforeAll(async () => {
    global.fetch = jest.fn();
    ({ app, usersServiceMock, rolesServiceMock, permissionsServiceMock } =
      await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rolesServiceMock.getStudentRole.mockResolvedValue({ id_role: 1, name: 'student' });
    permissionsServiceMock.getClaimsForRole.mockResolvedValue([]);
  });


  describe('Token válido de @ucaldas.edu.co', () => {
    it('retorna 201 con access_token al registrar un usuario nuevo', async () => {
      mockFetch(buildGoogleUserinfo());
      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.create.mockResolvedValue(mockUsuario);

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ access_token: 'token-google-valido' })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(typeof res.body.access_token).toBe('string');
      expect(res.body.access_token.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('student@ucaldas.edu.co');
      expect(usersServiceMock.create).toHaveBeenCalledTimes(1);
    });

    it('retorna 201 con access_token para usuario existente sin llamar a create()', async () => {
      mockFetch(buildGoogleUserinfo({ email: 'existente@ucaldas.edu.co', sub: 'sub-002' }));
      usersServiceMock.findByEmail.mockResolvedValue({
        ...mockUsuario,
        id_user: 2,
        email: 'existente@ucaldas.edu.co',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ access_token: 'token-google-existente' })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      expect(res.body.user.email).toBe('existente@ucaldas.edu.co');
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('el JWT contiene los claims sub y permissions', async () => {
      mockFetch(buildGoogleUserinfo());
      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.create.mockResolvedValue(mockUsuario);
      permissionsServiceMock.getClaimsForRole.mockResolvedValue([
        { claim: 'GC' },
        { claim: 'GL' },
      ]);

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ access_token: 'token-con-permisos' })
        .expect(201);

      const partes = res.body.access_token.split('.');
      expect(partes).toHaveLength(3);

      const payload = JSON.parse(Buffer.from(partes[1], 'base64').toString());
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('permissions');
      expect(Array.isArray(payload.permissions)).toBe(true);
    });
  });

  // ── Rechazo: dominio externo ──────────────────────────────────────────────────

  describe('Token de dominio externo → 401', () => {
    const correosExternos = [
      'usuario@gmail.com',
      'usuario@hotmail.com',
      'usuario@yahoo.com',
      'usuario@outlook.com',
      'estudiante@udea.edu.co',
    ];

    it.each(correosExternos)(
      'retorna 401 para el correo %s',
      async (email) => {
        mockFetch(buildGoogleUserinfo({ email, sub: `sub-${email}` }));

        const res = await request(app.getHttpServer())
          .post('/auth/google')
          .send({ access_token: 'token-externo' })
          .expect(401);

        expect(res.body.message).toMatch(/ucaldas\.edu\.co/i);
      },
    );
  });

  // ── Rechazo: token inválido o no verificado ───────────────────────────────────

  describe('Token de Google inválido o no verificado → 401', () => {
    it('retorna 401 cuando email_verified es false', async () => {
      mockFetch(buildGoogleUserinfo({ email_verified: false }));

      await request(app.getHttpServer())
        .post('/auth/google')
        .send({ access_token: 'token-no-verificado' })
        .expect(401);
    });

    it('retorna 401 cuando Google no devuelve email', async () => {
      mockFetch({ sub: null, email: null, email_verified: false });

      await request(app.getHttpServer())
        .post('/auth/google')
        .send({ access_token: 'token-basura' })
        .expect(401);
    });
  });

  // ── Validación de cuerpo ──────────────────────────────────────────────────────

  describe('Cuerpo inválido → 400', () => {
    it('retorna 400 cuando falta access_token', async () => {
      await request(app.getHttpServer())
        .post('/auth/google')
        .send({})
        .expect(400);
    });
  });
});
