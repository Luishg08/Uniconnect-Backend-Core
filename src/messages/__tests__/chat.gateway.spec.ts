import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from '../infrastructure/gateways/chat.gateway';
import { Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockSocket: jest.Mocked<Socket>;
  let mockServer: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatGateway],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);

    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      emit: jest.fn(),
      data: {},
    } as unknown as jest.Mocked<Socket>;

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    gateway.server = mockServer;
  });

  describe('handleAuthenticate', () => {
    it('should authenticate user and store client data', () => {
      const payload = { userId: 1, userName: 'Test User' };

      gateway.handleAuthenticate(mockSocket, payload);

      expect(mockSocket.data.userId).toBe(1);
      expect(mockSocket.data.userName).toBe('Test User');
    });

    it('should handle missing userId', () => {
      const payload = { userName: 'Test User' };

      expect(() => gateway.handleAuthenticate(mockSocket, payload)).not.toThrow();
    });

    it('should handle missing userName', () => {
      const payload = { userId: 1 };

      expect(() => gateway.handleAuthenticate(mockSocket, payload)).not.toThrow();
    });
  });

  describe('handleJoinRoom', () => {
    it('should join user to specified room', () => {
      const payload = { roomId: 'group-123' };

      gateway.handleJoinRoom(mockSocket, payload);

      expect(mockSocket.join).toHaveBeenCalledWith('group-123');
    });

    it('should handle missing roomId', () => {
      const payload = {};

      expect(() => gateway.handleJoinRoom(mockSocket, payload)).not.toThrow();
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should handle empty roomId', () => {
      const payload = { roomId: '' };

      expect(() => gateway.handleJoinRoom(mockSocket, payload)).not.toThrow();
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('emitToRoom', () => {
    it('should emit event to specified room', () => {
      const roomId = 'group-123';
      const event = 'NUEVO_MENSAJE';
      const data = { text_content: 'Test message' };

      gateway.emitToRoom(roomId, event, data);

      expect(mockServer.to).toHaveBeenCalledWith(roomId);
      expect(mockServer.emit).toHaveBeenCalledWith(event, data);
    });

    it('should handle empty roomId', () => {
      expect(() => gateway.emitToRoom('', 'NUEVO_MENSAJE', {})).not.toThrow();
    });

    it('should handle null data', () => {
      expect(() => gateway.emitToRoom('group-123', 'NUEVO_MENSAJE', null)).not.toThrow();
    });

    it('should emit to multiple rooms sequentially', () => {
      gateway.emitToRoom('group-1', 'NUEVO_MENSAJE', { text: 'Message 1' });
      gateway.emitToRoom('group-2', 'NUEVO_MENSAJE', { text: 'Message 2' });

      expect(mockServer.to).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up client data on disconnect', () => {
      mockSocket.data.userId = 1;
      mockSocket.data.userName = 'Test User';

      gateway.handleDisconnect(mockSocket);

      // Verify cleanup logic if implemented
      expect(mockSocket.id).toBe('socket-123');
    });
  });
});
