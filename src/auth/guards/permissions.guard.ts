import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PermissionMetadata,
  PermissionMode,
} from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {

    const metadata =
      this.reflector.getAllAndOverride<PermissionMetadata>(
        PERMISSIONS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions: string[] =
      user.permissions || [];

    const { mode, permissions } = metadata;

    if (mode === PermissionMode.ALL) {

      const hasAll = permissions.every(p =>
        userPermissions.includes(p),
      );

      if (!hasAll) {
        throw new ForbiddenException(
          'Missing required permissions',
        );
      }
    }

    if (mode === PermissionMode.ANY) {

      const hasAny = permissions.some(p =>
        userPermissions.includes(p),
      );

      if (!hasAny) {
        throw new ForbiddenException(
          'Missing required permissions',
        );
      }
    }

    return true;
  }
}