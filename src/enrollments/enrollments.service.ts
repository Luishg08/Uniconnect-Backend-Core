import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateEnrollmentDto) {
    return (this.prisma as any).enrollment.create({
      data: {
        id_user: Number(data.id_user),
        id_course: Number(data.id_course),
        status: data.status || 'active',
      },
    });
  }

  async findAll() {
    return (this.prisma as any).enrollment.findMany({
      include: {
        user: true,
        course: true,
      },
    });
  }
}