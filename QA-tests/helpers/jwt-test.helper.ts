import { JwtService } from '@nestjs/jwt';

export const QA_JWT_SECRET = 'uniconnect-test-key';

const _jwtService = new JwtService({ secret: QA_JWT_SECRET });

export function signTestJwt(
  userId: number,
  roleName = 'student',
  permissions: string[] = [],
): string {
  return _jwtService.sign({ sub: userId, permissions, roleName });
}

export function createConfigServiceMock() {
  return {
    get: (key: string) => {
      if (key === 'JWT_SECRET') return QA_JWT_SECRET;
      return undefined;
    },
  };
}
