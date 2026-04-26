/**
 * Shared EventEmitter2 mock factory for unit tests
 * US-T01/US-T02: Compatible with jest.spyOn(mock, 'emit')
 */

export interface EventEmitterMock {
  emit: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
  once: jest.Mock;
  removeAllListeners: jest.Mock;
}

export function createEventEmitterMock(): EventEmitterMock {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}
