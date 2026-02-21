import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) {}

    async getUserRole(){
        return this.prisma.role.findFirst({ where: { name: 'user' } });
    }
}
