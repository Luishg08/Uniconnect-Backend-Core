import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ForbiddenException, BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { GroupInvitationsController } from './group-invitations.controller';
import { GroupInvitationsService } from './group-invitations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RespondGroupInvitationDto } from './dto/respond-group-invitation.dto';

/**
 * FIX-14: Group Invitation Accept Bug - Exploratory Test
 * 
 * CRITICAL: Este test documenta el comportamiento esperado.
 * Si falla, confirma que el bug existe y ayuda a identificar la causa raíz.
 * 
 * Bug Condition: Cuando un usuario autenticado intenta aceptar una invitación
 * de grupo válida pendiente, la petición PATCH falla con HTTP 400.
 * 
 * Hipótesis Principal: JWT User ID Extraction Issue
 * - El decorador @GetClaim('sub') extrae userId como undefined o string
 * - Si userId es undefined, la validación invitation.invitee_id !== userId falla
 * - Esto causa un error 400 en lugar del esperado 200
 */
describe('GroupInvitations - Bug Condition Exploration (FIX-14)', () => {
  let app: INestApplication;
  let mockService: Partial<GroupInvitationsService>;

  beforeAll(async () => {
    // Mock del servicio para simular comportamiento
    mockService = {
      respondToInvitation: jest.fn().mockImplementation(
        async (invitationId: number, userId: number, respondDto: RespondGroupInvitationDto) => {
          console.log('[Mock Service] respondToInvitation called with:', {
            invitationId,
            userId,
            userIdType: typeof userId,
            respondDto,
          });

          // Simular validación que falla si userId es undefined
          if (userId === undefined || userId === null) {
            console.log('[Mock Service] ❌ userId is undefined/null - throwing ForbiddenException');
            throw new ForbiddenException('No tienes permiso para responder esta invitación');
          }

          // Simular validación de tipo
          if (typeof userId !== 'number') {
            console.log('[Mock Service] ❌ userId is not a number - throwing BadRequestException');
            throw new BadRequestException('Invalid user ID. Must be a positive integer.');
          }

          // Simular respuesta exitosa
          console.log('[Mock Service] ✅ Validation passed - returning success');
          return {
            message: 'Invitación aceptada. Ahora eres miembro del grupo.',
            invitation: {
              id_invitation: invitationId,
              status: respondDto.status,
              responded_at: new Date(),
            },
          };
        }
      ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GroupInvitationsController],
      providers: [
        {
          provide: GroupInvitationsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          // Simular JWT payload con user ID
          request.user = {
            sub: 1, // ID relacional del usuario (number)
            permissions: [],
            roleName: 'student',
          };
          console.log('[JWT Guard] User authenticated:', request.user);
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Configurar ValidationPipe global (igual que en main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Property 1: Bug Condition - Accept Group Invitation HTTP 400 Error
   * 
   * EXPECTED RESULT: Este test DEBE PASAR si el código está correcto.
   * Si falla, confirma que el bug existe.
   */
  it('should accept group invitation successfully with correct userId type', async () => {
    console.log('\n[Bug Condition Test] ========================================');
    console.log('[Bug Condition Test] Testing accept invitation endpoint');
    console.log('[Bug Condition Test] Expected: HTTP 200 with success message');
    console.log('[Bug Condition Test] ========================================\n');

    const response = await request(app.getHttpServer())
      .patch('/group-invitations/1/respond')
      .send({ status: 'accepted' });

    console.log('\n[Bug Condition Test] Response received:');
    console.log('[Bug Condition Test] Status:', response.status);
    console.log('[Bug Condition Test] Body:', JSON.stringify(response.body, null, 2));

    // Verificar que la respuesta es 200
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('aceptada');
    expect(response.body.invitation).toHaveProperty('status', 'accepted');

    // Verificar que el servicio fue llamado con los parámetros correctos
    expect(mockService.respondToInvitation).toHaveBeenCalledWith(
      1, // invitationId
      1, // userId (debe ser number)
      { status: 'accepted' }, // respondDto
    );

    console.log('[Bug Condition Test] ✅ All assertions passed - endpoint works correctly!\n');
  });

  /**
   * Test adicional: Verificar que el DTO valida correctamente
   */
  it('should validate DTO payload correctly', async () => {
    console.log('\n[DTO Validation Test] ========================================');
    console.log('[DTO Validation Test] Testing DTO validation');
    console.log('[DTO Validation Test] ========================================\n');

    // Test con payload válido
    const validResponse = await request(app.getHttpServer())
      .patch('/group-invitations/1/respond')
      .send({ status: 'accepted' });

    console.log('[DTO Validation Test] Valid payload response:', validResponse.status);
    expect(validResponse.status).toBe(200);

    // Test con payload inválido (campo extra)
    const invalidResponse = await request(app.getHttpServer())
      .patch('/group-invitations/1/respond')
      .send({ status: 'accepted', extraField: 'should be rejected' });

    console.log('[DTO Validation Test] Invalid payload (extra field) response:', invalidResponse.status);
    expect(invalidResponse.status).toBe(400);

    // Test con payload inválido (valor incorrecto)
    const invalidValueResponse = await request(app.getHttpServer())
      .patch('/group-invitations/1/respond')
      .send({ status: 'invalid_status' });

    console.log('[DTO Validation Test] Invalid payload (wrong value) response:', invalidValueResponse.status);
    expect(invalidValueResponse.status).toBe(400);

    console.log('[DTO Validation Test] ✅ DTO validation works correctly\n');
  });

  /**
   * Test adicional: Verificar que el fix maneja userId undefined correctamente
   */
  it('should fail with 400 if userId is undefined (fix validation)', async () => {
    console.log('\n[Fix Validation Test] ========================================');
    console.log('[Fix Validation Test] Testing fix handles userId undefined');
    console.log('[Fix Validation Test] ========================================\n');

    // Crear una nueva app con guard que retorna userId undefined
    const buggyModuleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GroupInvitationsController],
      providers: [
        {
          provide: GroupInvitationsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          // Simular JWT payload con user ID undefined
          request.user = {
            sub: undefined, // userId es undefined
            permissions: [],
            roleName: 'student',
          };
          console.log('[JWT Guard - Undefined] User authenticated with undefined userId:', request.user);
          return true;
        },
      })
      .compile();

    const buggyApp = buggyModuleFixture.createNestApplication();
    buggyApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await buggyApp.init();

    const response = await request(buggyApp.getHttpServer())
      .patch('/group-invitations/1/respond')
      .send({ status: 'accepted' });

    console.log('[Fix Validation Test] Response status:', response.status);
    console.log('[Fix Validation Test] Response body:', JSON.stringify(response.body, null, 2));

    // Con el fix implementado, debería fallar con 400 (Bad Request) con mensaje claro
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid user ID from JWT token');

    console.log('[Fix Validation Test] ✅ Fix validation confirmed - undefined userId causes 400 with clear message\n');

    await buggyApp.close();
  });
});
