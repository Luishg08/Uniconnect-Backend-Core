import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return (this.prisma.user as any).findFirst({
      where: { email },
    });
  }

  async create(data: any) {
    return (this.prisma.user as any).create({ data });
  }

  async findAll(filters: { search?: string; id_program?: number; id_course?: number } = {}) {
  const { search, id_program, id_course } = filters;
  const where: any = { AND: [] };

  if (id_program) {
    where.AND.push({ id_program: Number(id_program) });
  }

  if (id_course) {
    where.AND.push({
      enrollments: { some: { id_course: Number(id_course) } }
    });
  }

  if (search) {
    where.AND.push({
      OR: [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          enrollments: {
            some: {
              course: { name: { contains: search, mode: 'insensitive' } },
            },
          },
        },
      ],
    });
  }

  return (this.prisma.user as any).findMany({
    where: where.AND.length > 0 ? where : {},
    include: {
      program: true,
      enrollments: {
        include: {
          course: true,
        },
      },
    },
  });
}   
}