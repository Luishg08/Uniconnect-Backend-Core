import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { MessageRepository } from '../messages/message.repository';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: mockFilesService },
        { provide: MessagesGateway, useValue: mockMessagesGateway },
        { provide: MessageRepository, useValue: mockMessageRepository },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
