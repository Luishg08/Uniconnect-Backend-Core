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

  async getCoursesByStudent(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id_user: userId },
      select: { 
        id_program: true,
        enrollments: {
          select: {
            id_course: true,
          },
        },
      },          
    });

    const enrolledCourseIds = user?.enrollments
      .map(e => e.id_course)
      .filter((id): id is number => id !== null) ?? [];

    return this.prisma.course.findMany({
      where: {
        id_program: user?.id_program ?? null,
        id_course: {
          notIn: enrolledCourseIds, 
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getOwnCourses(userId: number) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
      id_user: userId,
      status: 'active',
      },
      include: {
      course: true, 
      }   ,
      orderBy: {
        course: {
          name: 'asc',
        },
      },
    });
    
    return enrollments.map(enrollment => enrollment.course);
  }

}