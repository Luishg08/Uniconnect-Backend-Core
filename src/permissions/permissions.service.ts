import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
    constructor(private prisma: PrismaService) { }

    async getClaimsForRole(roleId: number) {
        const roleAccess = await this.prisma.access.findMany({
            where: {
                id_role: roleId,
            },
        });

        const permissionIds = roleAccess.map(a => a.id_permission);

        return this.prisma.permission.findMany({
            where: {
                id_permission: {
                    in: permissionIds,
                },
            },
            select: {
                claim: true,
            },
        });
    }
}
