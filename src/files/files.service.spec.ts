import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test/mocks/prisma.mock';

describe('FilesService', () => {
  let service: FilesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_BUCKET_NAME') return 'test-bucket';
        if (key === 'AWS_REGION') return 'us-east-1';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Client, useValue: mockS3Client },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
