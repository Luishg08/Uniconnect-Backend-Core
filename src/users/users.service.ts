import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ProfileUpdateDto } from './dto/google-user-info.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findByEmail(email: string) {
    return (this.prisma.user as any).findFirst({
      where: { email },
      include: { role: true }, // ⭐ INCLUIR RELACIÓN DE ROL
    });
  }

  async findById(id: number) {
    return (this.prisma.user as any).findUnique({
      where: { id_user: id },
      include: { role: true }, // ⭐ INCLUIR RELACIÓN DE ROL
    });
  }

  async findByGoogleSub(googleSub: string) {
    return (this.prisma.user as any).findFirst({
      where: { google_sub: googleSub },
      include: { role: true }, // ⭐ INCLUIR RELACIÓN DE ROL
    });
  }

  async create(data: any) {
    return (this.prisma.user as any).create({ 
      data,
      include: { role: true }, // ⭐ INCLUIR RELACIÓN DE ROL
    });
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

  async getConnectedCommunityUsers(userId: number) {
    const parsedUserId = Number(userId);

    // Obtener materias inscritas activas del usuario autenticado
    const userEnrollments = await (this.prisma.enrollment as any).findMany({
      where: { id_user: parsedUserId },
      select: { id_course: true },
    });
    const userCourseIds = userEnrollments
      .map((e: any) => e.id_course)
      .filter((id: any) => id !== null && id !== undefined)
      .map((id: any) => Number(id));

    const acceptedConnections = await this.prisma.connection.findMany({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: parsedUserId },
          { adressee_id: parsedUserId },
        ],
      },
      select: {
        id_connection: true,
        requester_id: true,
        adressee_id: true,
        status: true,
      },
    });

    if (acceptedConnections.length === 0) {
      return [];
    }

    const connectedUserIds = acceptedConnections.map((conn) => (
      conn.requester_id === parsedUserId ? conn.adressee_id : conn.requester_id
    ));

    const connectedUsers = await this.prisma.user.findMany({
      where: {
        id_user: { in: connectedUserIds },
      },
      include: {
        program: true,
        enrollments: {
          include: {
            course: true,
          },
        },
      },
    });

    const connectionMap = new Map<number, number>();
    acceptedConnections.forEach((conn) => {
      const otherUserId = conn.requester_id === parsedUserId ? conn.adressee_id : conn.requester_id;
      connectionMap.set(otherUserId, conn.id_connection);
    });

    return connectedUsers.map((user: any) => {
      const common_courses = user.enrollments
        .filter((e: any) => e.id_course !== null && userCourseIds.includes(Number(e.id_course)))
        .map((e: any) => ({
          id_course: e.course?.id_course,
          name: e.course?.name,
        }));
      return {
        ...user,
        connection_status: 'connected',
        id_connection: connectionMap.get(user.id_user) || null,
        common_courses,
      };
    });
  }

  async getNotConnectedCommunityUsers(userId: number) {
    const parsedUserId = Number(userId);

    // Obtener materias inscritas activas del usuario autenticado
    const userEnrollments = await (this.prisma.enrollment as any).findMany({
      where: { id_user: parsedUserId },
      select: { id_course: true },
    });
    const userCourseIds = userEnrollments
      .map((e: any) => e.id_course)
      .filter((id: any) => id !== null && id !== undefined)
      .map((id: any) => Number(id));

    const acceptedConnections = await this.prisma.connection.findMany({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: parsedUserId },
          { adressee_id: parsedUserId },
        ],
      },
      select: {
        requester_id: true,
        adressee_id: true,
      },
    });

    const connectedUserIds = acceptedConnections.map((conn) => (
      conn.requester_id === parsedUserId ? conn.adressee_id : conn.requester_id
    ));

    const users = await this.prisma.user.findMany({
      where: {
        id_user: {
          not: parsedUserId,
          notIn: connectedUserIds,
        },
      },
      include: {
        program: true,
        enrollments: {
          include: {
            course: true,
          },
        },
      },
    });

    const userIds = users.map((u) => u.id_user);
    const existingConnections = userIds.length > 0
      ? await this.prisma.connection.findMany({
        where: {
          OR: [
            {
              requester_id: parsedUserId,
              adressee_id: { in: userIds },
            },
            {
              requester_id: { in: userIds },
              adressee_id: parsedUserId,
            },
          ],
        },
        select: {
          requester_id: true,
          adressee_id: true,
          status: true,
        },
      })
      : [];

    const connectionByUser = new Map<number, { status: string | null; requester_id: number }>();
    existingConnections.forEach((conn) => {
      const otherUserId = conn.requester_id === parsedUserId ? conn.adressee_id : conn.requester_id;
      connectionByUser.set(otherUserId, {
        status: conn.status,
        requester_id: conn.requester_id,
      });
    });

    return users.map((user: any) => {
      const connection = connectionByUser.get(user.id_user);
      const connection_status = connection
        ? connection.status === 'accepted'
          ? 'connected'
          : connection.requester_id === parsedUserId
            ? 'pending_sent'
            : 'pending_received'
        : 'none';

      const common_courses = user.enrollments
        .filter((e: any) => e.id_course !== null && userCourseIds.includes(Number(e.id_course)))
        .map((e: any) => ({
          id_course: e.course?.id_course,
          name: e.course?.name,
        }));

      return {
        ...user,
        connection_status,
        common_courses,
      };
    });
  }

  async getConnectionsWithCourses(userId: number) {
    const parsedUserId = Number(userId);

    // Obtener materias inscritas activas del usuario autenticado
    const userEnrollments = await (this.prisma.enrollment as any).findMany({
      where: { id_user: parsedUserId },
      select: { id_course: true },
    });
    const userCourseIds = userEnrollments
      .map((e: any) => e.id_course)
      .filter((id: any) => id !== null && id !== undefined)
      .map((id: any) => Number(id));

    // Obtener conexiones aceptadas
    const acceptedConnections = await this.prisma.connection.findMany({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: parsedUserId },
          { adressee_id: parsedUserId },
        ],
      },
      select: {
        requester_id: true,
        adressee_id: true,
      },
    });

    if (acceptedConnections.length === 0) {
      return [];
    }

    // Extraer IDs de usuarios conectados
    const connectedUserIds = acceptedConnections.map((conn) =>
      conn.requester_id === parsedUserId ? conn.adressee_id : conn.requester_id,
    );

    // Obtener datos de los usuarios conectados con sus materias
    const connectedUsers = await this.prisma.user.findMany({
      where: {
        id_user: { in: connectedUserIds },
      },
      include: {
        program: {
          select: { name: true },
        },
        enrollments: {
          select: {
            id_course: true,
            course: {
              select: {
                id_course: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Mapear resultado con cursos en común
    return connectedUsers
      .map((user: any) => {
        const common_courses = user.enrollments
          .filter(
            (e: any) =>
              e.id_course !== null && userCourseIds.includes(Number(e.id_course)),
          )
          .map((e: any) => ({
            id_course: e.course?.id_course,
            name: e.course?.name,
          }));

        return {
          id_user: user.id_user,
          full_name: user.full_name,
          picture: user.picture,
          email: user.email,
          program: user.program,
          common_courses,
        };
      })
      .filter((user: any) => user.common_courses.length > 0); // Solo retornar conexiones con cursos en común
  }

  async getConnectionsForGroupInvite(userId: number, groupId: number) {
    const parsedUserId = Number(userId);
    const parsedGroupId = Number(groupId);

    // LOG: userId y groupId recibidos
    console.log('[INVITE-DEBUG] userId:', parsedUserId, 'groupId:', parsedGroupId);

    // Obtener el grupo y su curso asociado
    const group = await this.prisma.group.findUnique({
      where: { id_group: parsedGroupId },
      select: { id_course: true, owner_id: true },
    });

    if (!group) {
      console.log('[INVITE-DEBUG] Grupo no encontrado:', groupId);
      throw new NotFoundException(`Grupo con ID ${groupId} no encontrado`);
    }

    if (!group.id_course) {
      console.log('[INVITE-DEBUG] Grupo sin materia asociada:', groupId);
      throw new NotFoundException(`El grupo no tiene una materia asociada`);
    }

    if (group.owner_id !== parsedUserId) {
      console.log('[INVITE-DEBUG] Usuario no es owner del grupo:', parsedUserId, groupId);
      throw new ForbiddenException(`Solo el owner del grupo puede invitar usuarios`);
    }

    const groupCourseId = Number(group.id_course);

    // Obtener conexiones aceptadas
    const acceptedConnections = await this.prisma.connection.findMany({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: parsedUserId },
          { adressee_id: parsedUserId },
        ],
      },
      select: {
        requester_id: true,
        adressee_id: true,
      },
    });

    console.log('[INVITE-DEBUG] Conexiones aceptadas:', acceptedConnections.length);

    if (acceptedConnections.length === 0) {
      console.log('[INVITE-DEBUG] No hay conexiones aceptadas para el usuario');
      return [];
    }

    // Extraer IDs de usuarios conectados
    const connectedUserIds = acceptedConnections.map((conn) =>
      conn.requester_id === parsedUserId ? conn.adressee_id : conn.requester_id,
    );

    // Obtener datos de los usuarios conectados que tengan la materia del grupo
    const connectedUsers = await this.prisma.user.findMany({
      where: {
        id_user: { in: connectedUserIds },
      },
      include: {
        program: {
          select: { name: true },
        },
        enrollments: {
          where: { id_course: groupCourseId },
          select: {
            id_course: true,
            course: {
              select: {
                id_course: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const invitables = connectedUsers
      .filter((user: any) => user.enrollments.length > 0)
      .map((user: any) => ({
        id_user: user.id_user,
        full_name: user.full_name,
        picture: user.picture,
        email: user.email,
        program: user.program,
        course: {
          id_course: user.enrollments[0].course?.id_course,
          name: user.enrollments[0].course?.name,
        },
      }));

    console.log('[INVITE-DEBUG] Conexiones con la materia del grupo:', invitables.length);
    console.log('[INVITE-DEBUG] Respuesta enviada:', JSON.stringify(invitables));
    return invitables;
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
        id_program: true,
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
        id_program: user.id_program ?? null,
        needsOnboarding: user.id_program === null || user.id_program === undefined,
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

  async completeOnboarding(userId: number, dto: CompleteOnboardingDto) {
    const user = await (this.prisma.user as any).findUnique({
      where: { id_user: userId },
      select: { id_program: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.id_program !== null) throw new ConflictException('Onboarding already completed');

    const programExists = await (this.prisma.program as any).findUnique({
      where: { id_program: dto.id_program },
    });
    if (!programExists) throw new NotFoundException('Program not found');

    return (this.prisma.user as any).update({
      where: { id_user: userId },
      data: {
        id_program: dto.id_program,
        current_semester: dto.current_semester,
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
      common_courses: commonCourses,
      connection_status: connectionExists ? (connectionExists.status == 'accepted' ? 'connected' : connectionExists.requester_id === requestingUserId ? 'pending_sent' : 'pending_received') : 'none',
    };
  }

  // =====================================================
  // TOKEN BLACKLIST MANAGEMENT
  // =====================================================

  async addTokenToBlacklist(token: string, userId: number, expiresAt: Date) {
    return await this.prisma.token_blacklist.create({
      data: {
        token,
        user_id: userId,
        expires_at: expiresAt,
      },
    });
  }

  async findBlacklistedToken(token: string) {
    return await this.prisma.token_blacklist.findUnique({
      where: { token },
    });
  }

  async cleanExpiredTokens() {
    // Método para limpiar tokens expirados de la blacklist (puede ejecutarse con un cron job)
    const now = new Date();
    return await this.prisma.token_blacklist.deleteMany({
      where: {
        expires_at: {
          lt: now,
        },
      },
    });
  }

}