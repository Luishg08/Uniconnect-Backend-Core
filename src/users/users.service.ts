import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ProfileUpdateDto } from './dto/google-user-info.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findByEmail(email: string) {
    return (this.prisma.user as any).findFirst({
      where: { email },
    });
  }

  async findById(id: number) {
    return (this.prisma.user as any).findUnique({
      where: { id_user: id },
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

  async findAll(filters: { search?: string; id_program?: number; id_course?: number, userId?: number } = {}) {
    const { search, id_program, id_course, userId } = filters;

    // Obtener las materias inscritas del usuario autenticado
    const parsedUserId = userId ? Number(userId) : null;
    let userCourseIds: number[] = [];
    if (parsedUserId) {
      const userEnrollments = await (this.prisma.enrollment as any).findMany({
        where: { id_user: parsedUserId },
        select: { id_course: true },
      });
      userCourseIds = userEnrollments
        .map((e: any) => e.id_course)
        .filter((id: any) => id !== null && id !== undefined)
        .map((id: any) => Number(id));
    }

    // Si el usuario no tiene materias inscritas no puede tener companeros en comun
    if (userCourseIds.length === 0 && !id_course) {
      return [];
    }

    const where: any = { AND: [] };

    // Excluir al usuario autenticado
    if (parsedUserId) {
      where.AND.push({ id_user: { not: parsedUserId } });
    }

    // Solo mostrar usuarios que compartan materias con el usuario autenticado
    const courseFilter = id_course ? [Number(id_course)] : userCourseIds;
    where.AND.push({
      enrollments: { some: { id_course: { in: courseFilter } } },
    });

    if (id_program) {
      where.AND.push({ id_program: Number(id_program) });
    }

    if (search) {
      where.AND.push({
        full_name: { contains: search, mode: 'insensitive' },
      });
    }

    const users = await (this.prisma.user as any).findMany({
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

    // Agregar common_courses a cada resultado (solo materias que comparte con el autenticado)
    return users.map((user: any) => {
      const common_courses = user.enrollments
        .filter((e: any) => e.id_course !== null && userCourseIds.includes(Number(e.id_course)))
        .map((e: any) => ({
          id_course: e.course?.id_course,
          name: e.course?.name,
        }));
      return {
        ...user,
        common_courses,
      };
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

  async updateProfile(userId: number, data: ProfileUpdateDto) {
    return (this.prisma.user as any).update({
      where: { id_user: userId },
      data: {
        current_semester: parseInt(data.current_semester || '0') || 0,
        picture: data.image,
        cell_phone: data.phone,
      },
    });
  }

  async getOtherProfile(requestingUserId: number, profileId: number) {

    const requestingUser = await this.prisma.user.findUnique({
      where: { id_user: requestingUserId },
      select: {
        enrollments: {
          where: {
            status: 'active'
          },
          select: {
            id_course: true,
          }
        },
        id_program: true,
      }
    });

    const activeCourseIds = requestingUser?.enrollments.map(e => e.id_course) || [];

    const otherUser = await this.prisma.user.findUnique({
      where: { id_user: profileId },
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
            id_program: true,
          },
        },
        enrollments: {
          select: {
            course: {
              select: {
                id_course: true,
                name: true,
              },
            },
            status: true,
          }
        }
      }
    });

    const connectionExists = await this.prisma.connection.findFirst({
      where: {
        OR: [
          { adressee_id: requestingUserId, requester_id: profileId },
          { adressee_id: profileId, requester_id: requestingUserId },
        ],
      },
    });


    if (!otherUser) return null;

    if (requestingUser?.id_program != otherUser.program?.id_program) {
      return new ForbiddenException('No tienes permiso para ver este perfil').getResponse();
    }

    const commonCourses = otherUser.enrollments
      .filter(e => e.course && activeCourseIds.includes(e.course.id_course))
      .map(e => ({
        id_course: e.course!.id_course,
        name: e.course!.name,
        state: e.status,
      }));

    return {
      id: otherUser.id_user,
      full_name: otherUser.full_name,
      email: otherUser.email,
      picture: otherUser.picture,
      phone: otherUser.cell_phone,
      program: otherUser.program?.name,
      current_semester: otherUser.current_semester?.toString(),
      roleName: otherUser.role.name,
      connection_id: connectionExists?.id_connection,
      common_courses: commonCourses,
      connection_status: connectionExists && connectionExists.status !== 'rejected'
        ? (connectionExists.status === 'accepted'
          ? 'accepted'
          : connectionExists.requester_id === requestingUserId
            ? 'pending_sent'
            : 'pending_received')
        : 'none',
    };
  }

}