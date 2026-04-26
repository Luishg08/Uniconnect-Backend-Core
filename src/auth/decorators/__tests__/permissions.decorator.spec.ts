import { Reflector } from '@nestjs/core';
import {
  RequireAll,
  RequireAny,
  PERMISSIONS_KEY,
  PermissionMode,
} from '../permissions.decorator';

describe('Permissions Decorators', () => {
  const reflector = new Reflector();

  // DummyController with decorated methods for isolated testing
  class DummyController {
    @RequireAll('read:groups', 'write:groups')
    requireAllMethod() {}

    @RequireAll()
    requireAllEmpty() {}

    @RequireAny('read:groups', 'write:groups')
    requireAnyMethod() {}

    @RequireAll('admin:only')
    singlePermission() {}
  }

  const dummy = new DummyController();

  describe('RequireAll', () => {
    it('should set metadata with mode ALL and permissions array', () => {
      const metadata = reflector.get(PERMISSIONS_KEY, dummy.requireAllMethod);
      expect(metadata).toEqual({
        mode: PermissionMode.ALL,
        permissions: ['read:groups', 'write:groups'],
      });
    });

    it('should work with single permission', () => {
      const metadata = reflector.get(PERMISSIONS_KEY, dummy.singlePermission);
      expect(metadata).toEqual({
        mode: PermissionMode.ALL,
        permissions: ['admin:only'],
      });
    });

    it('should work with empty permissions array', () => {
      const metadata = reflector.get(PERMISSIONS_KEY, dummy.requireAllEmpty);
      expect(metadata).toEqual({
        mode: PermissionMode.ALL,
        permissions: [],
      });
    });
  });

  describe('RequireAny', () => {
    it('should set metadata with mode ANY and permissions array', () => {
      const metadata = reflector.get(PERMISSIONS_KEY, dummy.requireAnyMethod);
      expect(metadata).toEqual({
        mode: PermissionMode.ANY,
        permissions: ['read:groups', 'write:groups'],
      });
    });

    it('should differ from RequireAll in mode field', () => {
      const allMeta = reflector.get(PERMISSIONS_KEY, dummy.requireAllMethod);
      const anyMeta = reflector.get(PERMISSIONS_KEY, dummy.requireAnyMethod);
      expect(allMeta.mode).toBe(PermissionMode.ALL);
      expect(anyMeta.mode).toBe(PermissionMode.ANY);
    });
  });
});
