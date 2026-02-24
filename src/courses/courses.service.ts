import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateCourseDto) {
    return (this.prisma as any).course.create({
      data: {
        name: data.name,
        id_program: data.id_program ? Number(data.id_program) : null,
      },
    });
  }

  async findAll() {
    return (this.prisma as any).course.findMany({
      include: {
        program: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}