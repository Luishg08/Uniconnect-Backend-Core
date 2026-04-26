import { ExecutionContext } from '@nestjs/common';

// Test the factory logic directly, independent of NestJS decorator infrastructure
function getClaimLogic(
  claimName: string,
  user: Record<string, unknown> | undefined,
): unknown {
  return claimName ? user?.[claimName] : user;
}

function buildContext(user: Record<string, unknown> | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('GetClaim Decorator Logic', () => {
  it('should extract sub claim from request.user', () => {
    const ctx = buildContext({ sub: 42, roleName: 'student' });
    const user = ctx.switchToHttp().getRequest().user;
    expect(getClaimLogic('sub', user)).toBe(42);
  });

  it('should extract roleName claim from request.user', () => {
    const ctx = buildContext({ sub: 1, roleName: 'admin' });
    const user = ctx.switchToHttp().getRequest().user;
    expect(getClaimLogic('roleName', user)).toBe('admin');
  });

  it('should return undefined for missing claim', () => {
    const ctx = buildContext({ sub: 1 });
    const user = ctx.switchToHttp().getRequest().user;
    expect(getClaimLogic('nonExistentClaim', user)).toBeUndefined();
  });

  it('should return undefined when user is not set', () => {
    const ctx = buildContext(undefined);
    const user = ctx.switchToHttp().getRequest().user;
    expect(getClaimLogic('sub', user)).toBeUndefined();
  });

  it('should return full user object when no claimName provided', () => {
    const user = { sub: 5, roleName: 'student' };
    const ctx = buildContext(user);
    const reqUser = ctx.switchToHttp().getRequest().user;
    expect(getClaimLogic('', reqUser)).toEqual(user);
  });
});
