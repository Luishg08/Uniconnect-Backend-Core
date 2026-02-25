import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findByEmail(email: string) {
    return (this.prisma.user as any).findFirst({
      where: { email },
    });
  }

  async findByGoogleSub(googleSub: string) {
    return (this.prisma.user as any).findFirst({
      where: { google_sub: googleSub },
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

  async getProfile(userId: number) {
    return await this.prisma.user.findUnique({
      where: { id_user: userId },
      select: {
        id_user: true,
        full_name: true,
        email: true,
        picture: true,
        cell_phone: true,
        current_semester: true,
        role: {
          select: {
            name: true,
          },
        },
        program: {
        select: {
          name: true,
          courses: {
            select: {
              id_course: true,
            },
          },
        },
      },
        enrollments: {
          select: {
            status: true,
            course: {
              select: {
                id_course: true,
                name: true,
              },
            },
          },
        },
      },
    }).then(user => {
      if (!user) return null;

      const totalCoursesInProgram = user.program?.courses.length || 0;
      const completedCourses = user.enrollments.filter(
        e => e.status?.toLowerCase() === 'finished'
      ).length;

      const progress = totalCoursesInProgram > 0
        ? Math.round((completedCourses / totalCoursesInProgram) * 100)
        : 0;
      return {
        id: user.id_user,
        full_name: user.full_name,
        email: user.email,
        picture: user.picture,
        phone: user.cell_phone,
        program: user.program?.name,
        progress,
        current_semester: user.current_semester?.toString(),
        roleName: user.role.name,
        courses: user.enrollments?.map(e => ({
          id_course: e.course!.id_course,
          name: e.course!.name,
          state: e.status,
        })),
      };
    });
  }

}