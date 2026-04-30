import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { MessageRepository } from '../messages/message.repository';
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

describe('FilesController', () => {
  let controller: FilesController;

  const mockFilesService = {
    uploadGroupFiles: jest.fn(),
    getGroupFiles: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockMessagesGateway = {
    emitMessageWithFiles: jest.fn(),
    sendMessageToGroup: jest.fn(),
  };

  const mockMessageRepository = {
    createWithFiles: jest.fn(),
    findById: jest.fn(),
  };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: mockFilesService },
        { provide: MessagesGateway, useValue: mockMessagesGateway },
        { provide: MessageRepository, useValue: mockMessageRepository },
        { provide: S3Client, useValue: mockS3Client },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
