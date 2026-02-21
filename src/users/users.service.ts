import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}
    async findByEmail(email: string) {
        return this.prisma.user.findFirst({ where: { email } });
    }

    async create(data) {
        return this.prisma.user.create({ data });
    }

}
