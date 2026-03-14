import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) {}

    /**
     * Obtiene el rol "student" (rol por defecto para usuarios nuevos)
     */
    async getStudentRole() {
        return this.prisma.role.findUnique({ where: { name: 'student' } });
    }

    /**
     * Obtiene el rol "admin" (puede crear grupos)
     */
    async getAdminRole() {
        return this.prisma.role.findUnique({ where: { name: 'admin' } });
    }

    /**
     * Obtiene el rol "superadmin" (acceso total)
     */
    async getSuperAdminRole() {
        return this.prisma.role.findUnique({ where: { name: 'superadmin' } });
    }

    /**
     * @deprecated Use getStudentRole() instead
     */
    async getUserRole() {
        return this.getStudentRole();
    }
}
