import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateEnrollmentDto, userId: number) {
    return (this.prisma as any).enrollment.create({
      data: {
        id_user: userId,
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

  async updateStatus(userId: number, id_course: number, status: string) {
    const enrollment = await this.prisma.enrollment.findMany({
      where: { 
          id_user: userId,
          id_course: Number(id_course),
      },
    });

    if (enrollment.length === 0) {
      throw new BadRequestException('Enrollment not found');
    }
    return this.prisma.enrollment.updateManyAndReturn({
      where: { 
          id_user: userId,
          id_course: Number(id_course),
      },
      data: { status },
    });
  }

  async remove(userId: number, id_course: number) {
  
  const result = await this.prisma.enrollment.deleteMany({
      where: {
        id_user: userId,
        id_course: Number(id_course),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('Enrollment not found');
    }

    return result;
  }
}