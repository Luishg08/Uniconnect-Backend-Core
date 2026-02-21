import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export enum PermissionMode {
  ALL = 'ALL',
  ANY = 'ANY',
}

export interface PermissionMetadata {
  mode: PermissionMode;
  permissions: string[];
}

export const RequireAll = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, {
    mode: PermissionMode.ALL,
    permissions,
  });

export const RequireAny = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, {
    mode: PermissionMode.ANY,
    permissions,
  });