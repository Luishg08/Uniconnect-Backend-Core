import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { RolesService } from 'src/roles/roles.service';
import { PermissionsService } from 'src/permissions/permissions.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  QA_JWT_SECRET,
  createConfigServiceMock,
  signTestJwt,
} from '../helpers/jwt-test.helper';

// ─── módulo de prueba ─────────────────────────────────────────────────────────

const USER_ID = 7;

async function buildApp() {
  const usersServiceMock = {
    findBlacklistedToken: jest.fn().mockResolvedValue(null),
    addTokenToBlacklist: jest.fn().mockResolvedValue(undefined),
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const prismaMock = {
    token_blacklist: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
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
      { provide: RolesService, useValue: {} },
      { provide: PermissionsService, useValue: {} },
      { provide: HttpService, useValue: {} },
      { provide: ConfigService, useValue: createConfigServiceMock() },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  return { app, usersServiceMock };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('[QA] POST /auth/logout — contrato de seguridad', () => {
  let app: INestApplication;
  let usersServiceMock: any;
  let tokenValido: string;

  beforeAll(async () => {
    tokenValido = signTestJwt(USER_ID);
    ({ app, usersServiceMock } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usersServiceMock.findBlacklistedToken.mockResolvedValue(null);
    usersServiceMock.addTokenToBlacklist.mockResolvedValue(undefined);
  });

  // ── Flujo exitoso ─────────────────────────────────────────────────────────────

  describe('Cierre de sesión exitoso', () => {
    it('retorna 201 con payload de éxito', async () => {
      // POST sin @HttpCode() devuelve 201 en NestJS — comportamiento real del runtime
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ access_token: tokenValido })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        data: { message: expect.stringMatching(/logout/i) },
      });
    });

    it('agrega el token a la lista negra', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ access_token: tokenValido })
        .expect(201);

      expect(usersServiceMock.addTokenToBlacklist).toHaveBeenCalledTimes(1);
      expect(usersServiceMock.addTokenToBlacklist).toHaveBeenCalledWith(
        tokenValido,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ── Token ya en lista negra ───────────────────────────────────────────────────

  describe('Token ya en lista negra → 401', () => {
    // El JwtAuthGuard rechaza el Bearer token con 401 ANTES de llegar al controlador.
    // Un token revocado no puede usarse para ninguna petición autenticada, incluyendo logout.
    it('retorna 401 cuando el Bearer token ya está revocado', async () => {
      usersServiceMock.findBlacklistedToken.mockResolvedValue({
        token: tokenValido,
        user_id: USER_ID,
      });

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ access_token: tokenValido })
        .expect(401);

      expect(usersServiceMock.addTokenToBlacklist).not.toHaveBeenCalled();
    });
  });

  // ── Rechazo: token de otro usuario ────────────────────────────────────────────

  describe('El token del cuerpo pertenece a otro usuario → 401', () => {
    it('retorna 401 y no actualiza la lista negra', async () => {
      const tokenOtroUsuario = signTestJwt(999);

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ access_token: tokenOtroUsuario })
        .expect(401);

      expect(res.body).toHaveProperty('message');
      expect(usersServiceMock.addTokenToBlacklist).not.toHaveBeenCalled();
    });
  });

  // ── Rechazo: token malformado ─────────────────────────────────────────────────

  describe('Token del cuerpo inválido → 401', () => {
    it('retorna 401 cuando access_token no es un JWT válido', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({ access_token: 'esto.no.es.jwt' })
        .expect(401);

      expect(usersServiceMock.addTokenToBlacklist).not.toHaveBeenCalled();
    });
  });

  // ── Rechazo: sin encabezado Authorization ────────────────────────────────────

  describe('Sin encabezado Authorization → 401', () => {
    it('retorna 401 cuando no se envía Bearer token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ access_token: tokenValido })
        .expect(401);
    });
  });

  // ── Validación de cuerpo ──────────────────────────────────────────────────────

  describe('Falta access_token en el cuerpo → 400', () => {
    it('retorna 400 cuando el cuerpo está vacío', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokenValido}`)
        .send({})
        .expect(400);
    });
  });
});
