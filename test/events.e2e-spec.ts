import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Events (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/events (GET)', () => {
    it('should reject invalid event type with 400 error', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ type: 'INVALID_TYPE' })
        .expect(400);

      expect(response.body.message).toContain('type must be one of');
    });

    it('should accept valid event type CONFERENCIA', async () => {
      // Mock the database response
      jest.spyOn(prismaService as any, 'event').mockReturnValue({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      });

      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ type: 'CONFERENCIA' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('metadata');
    });

    it('should accept valid event type TALLER', async () => {
      jest.spyOn(prismaService as any, 'event').mockReturnValue({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      });

      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ type: 'TALLER' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should accept combined date and type filters', async () => {
      jest.spyOn(prismaService as any, 'event').mockReturnValue({
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      });

      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ date: '2024-03-15', type: 'CONFERENCIA' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
    });

    it('should reject invalid date format', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .query({ date: '15-03-2024' })
        .expect(400);

      expect(response.body.message).toContain('ISO 8601 format');
    });
  });
});
