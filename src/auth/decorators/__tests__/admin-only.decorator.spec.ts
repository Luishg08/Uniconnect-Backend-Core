import { Reflector } from '@nestjs/core';
import { AdminOnly, ADMIN_ONLY_KEY } from '../admin-only.decorator';

describe('AdminOnly Decorator', () => {
  const reflector = new Reflector();

  class DummyController {
    @AdminOnly()
    adminMethod() {}

    regularMethod() {}
  }

  const dummy = new DummyController();

  it('should set adminOnly metadata to true', () => {
    const metadata = reflector.get(ADMIN_ONLY_KEY, dummy.adminMethod);
    expect(metadata).toBe(true);
  });

  it('should not affect methods without the decorator', () => {
    const metadata = reflector.get(ADMIN_ONLY_KEY, dummy.regularMethod);
    expect(metadata).toBeUndefined();
  });
});
