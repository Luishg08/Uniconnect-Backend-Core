import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventFilters } from './dto/event-filters.dto';
import { PaginationParams } from './dto/pagination.dto';
import { FENResponse } from './interfaces/fen-response.interface';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    filters: EventFilters,
    pagination: PaginationParams,
    userId?: number, // ⭐ NUEVO: userId para filtrado por carrera
  ): Promise<FENResponse<any[] | null>> {
    try {
      let whereClause = this.buildWhereClause(filters);

      // ⭐ NUEVO: Aplicar filtro de carrera si se proporciona userId
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id_user: userId },
          include: { role: true },
        });

        // Si el usuario no es superadmin, filtrar por su carrera
        if (user && user.role.name !== 'superadmin') {
          // Si el usuario no tiene carrera asignada, retornar array vacío
          if (!user.id_program) {
            return this.formatFENResponse(
              true,
              [],
              null,
              {
                total: 0,
                page: pagination.page,
                pageSize: pagination.pageSize,
                hasNextPage: false,
                hasPreviousPage: false,
                timestamp: new Date().toISOString(),
              },
            );
          }

          // Filtrar eventos por la carrera del usuario
          whereClause = {
            ...whereClause,
            id_program: user.id_program,
          };
        }
        // Si es superadmin, no se aplica filtro de carrera (ve todos)
      }

      const skip = (pagination.page - 1) * pagination.pageSize;

      const [events, total] = await Promise.all([
        (this.prisma as any).event.findMany({
          where: whereClause,
          orderBy: {
            date: 'asc',
          },
          skip,
          take: pagination.pageSize,
          include: {
            creator: {
              select: {
                id_user: true,
                full_name: true,
                picture: true,
              },
            },
            program: {
              select: {
                id_program: true,
                name: true,
              },
            },
          },
        }),
        (this.prisma as any).event.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / pagination.pageSize);

      return this.formatFENResponse(
        true,
        events,
        null,
        {
          total,
          page: pagination.page,
          pageSize: pagination.pageSize,
          hasNextPage: pagination.page < totalPages,
          hasPreviousPage: pagination.page > 1,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      return this.formatFENResponse(
        false,
        null,
        {
          code: 'INTERNAL_ERROR',
          message: 'Error al consultar eventos',
          details: error.message,
        },
        {
          total: 0,
          page: pagination.page,
          pageSize: pagination.pageSize,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  private buildWhereClause(filters: EventFilters): any {
    const where: any = {};

    if (filters.date) {
      const filterDate = new Date(filters.date);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      where.date = {
        gte: filterDate,
        lt: nextDay,
      };
    }

    if (filters.startDate || filters.endDate) {
      where.date = where.date || {};

      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setDate(endDate.getDate() + 1);
        where.date.lt = endDate;
      }
    }

    if (filters.type) {
      where.type = filters.type;
    }

    return where;
  }

  private formatFENResponse<T>(
    success: boolean,
    data: T | null,
    error: { code: string; message: string; details?: any } | null,
    metadata: {
      total: number;
      page: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      timestamp: string;
    },
  ): FENResponse<T> {
    return {
      success,
      data,
      error,
      metadata,
    };
  }

  // =====================================================
  // GESTIÓN DE EVENTOS (Solo administradores)
  // =====================================================

  async create(createEventDto: any, userId: number) {
    try {
      // 1. Obtener información completa del usuario con rol y programa
      const user = await this.prisma.user.findUnique({
        where: { id_user: userId },
        include: { role: true },
      });

      if (!user) {
        return this.formatFENResponse(
          false,
          null,
          {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado',
          },
          {
            total: 0,
            page: 1,
            pageSize: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            timestamp: new Date().toISOString(),
          },
        );
      }

      // 2. Validar que el usuario tenga una carrera asignada (excepto superadmin)
      if (!user.id_program && user.role.name !== 'superadmin') {
        return this.formatFENResponse(
          false,
          null,
          {
            code: 'NO_PROGRAM_ASSIGNED',
            message: 'Debes tener una carrera asignada para crear eventos. Completa tu perfil.',
          },
          {
            total: 0,
            page: 1,
            pageSize: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            timestamp: new Date().toISOString(),
          },
        );
      }

      // 3. Validar permisos según rol
      if (user.role.name === 'student') {
        return this.formatFENResponse(
          false,
          null,
          {
            code: 'FORBIDDEN',
            message: 'Los estudiantes no pueden crear eventos. Contacta a un administrador.',
          },
          {
            total: 0,
            page: 1,
            pageSize: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            timestamp: new Date().toISOString(),
          },
        );
      }

      // 4. Determinar el program_id según el rol
      // Admin: usa su propio id_program
      // Superadmin: usa su id_program (puede ser null para eventos globales)
      const programId = user.id_program;

      // 5. Crear el evento con el program_id asignado automáticamente
      const event = await (this.prisma as any).event.create({
        data: {
          ...createEventDto,
          date: new Date(createEventDto.date),
          created_by: userId,
          id_program: programId, // ⭐ Asignación automática desde el perfil del usuario
        },
        include: {
          creator: {
            select: {
              id_user: true,
              full_name: true,
              email: true,
            },
          },
          program: {
            select: {
              id_program: true,
              name: true,
            },
          },
        },
      });

      return this.formatFENResponse(
        true,
        event,
        null,
        {
          total: 1,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      return this.formatFENResponse(
        false,
        null,
        {
          code: 'CREATE_ERROR',
          message: 'Error al crear el evento',
          details: error.message,
        },
        {
          total: 0,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  async update(id: string, updateEventDto: any, userId: number) {
    try {
      const existingEvent = await (this.prisma as any).event.findUnique({
        where: { id },
      });

      if (!existingEvent) {
        return this.formatFENResponse(
          false,
          null,
          {
            code: 'NOT_FOUND',
            message: 'Evento no encontrado',
          },
          {
            total: 0,
            page: 1,
            pageSize: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            timestamp: new Date().toISOString(),
          },
        );
      }

      const event = await (this.prisma as any).event.update({
        where: { id },
        data: {
          ...updateEventDto,
          ...(updateEventDto.date && { date: new Date(updateEventDto.date) }),
        },
        include: {
          creator: {
            select: {
              id_user: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      return this.formatFENResponse(
        true,
        event,
        null,
        {
          total: 1,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      return this.formatFENResponse(
        false,
        null,
        {
          code: 'UPDATE_ERROR',
          message: 'Error al actualizar el evento',
          details: error.message,
        },
        {
          total: 0,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  async remove(id: string) {
    try {
      const existingEvent = await (this.prisma as any).event.findUnique({
        where: { id },
      });

      if (!existingEvent) {
        return this.formatFENResponse(
          false,
          null,
          {
            code: 'NOT_FOUND',
            message: 'Evento no encontrado',
          },
          {
            total: 0,
            page: 1,
            pageSize: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            timestamp: new Date().toISOString(),
          },
        );
      }

      await (this.prisma as any).event.delete({
        where: { id },
      });

      return this.formatFENResponse(
        true,
        { message: 'Evento eliminado exitosamente' },
        null,
        {
          total: 0,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      return this.formatFENResponse(
        false,
        null,
        {
          code: 'DELETE_ERROR',
          message: 'Error al eliminar el evento',
          details: error.message,
        },
        {
          total: 0,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }

  async findOne(id: string, userId?: number) {
    try {
      const event = await (this.prisma as any).event.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id_user: true,
              full_name: true,
              email: true,
            },
          },
          program: {
            select: {
              id_program: true,
              name: true,
            },
          },
        },
      });

      if (!event) {
        return this.formatFENResponse(
          false,
          null,
          {
            code: 'NOT_FOUND',
            message: 'Evento no encontrado',
          },
          {
            total: 0,
            page: 1,
            pageSize: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            timestamp: new Date().toISOString(),
          },
        );
      }

      // ⭐ NUEVO: Validar acceso por carrera si se proporciona userId
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id_user: userId },
          include: { role: true },
        });

        // Si no es superadmin, validar que el evento sea de su carrera
        if (user && user.role.name !== 'superadmin') {
          if (event.id_program !== user.id_program) {
            return this.formatFENResponse(
              false,
              null,
              {
                code: 'FORBIDDEN',
                message: 'No tienes acceso a este evento',
              },
              {
                total: 0,
                page: 1,
                pageSize: 1,
                hasNextPage: false,
                hasPreviousPage: false,
                timestamp: new Date().toISOString(),
              },
            );
          }
        }
      }

      return this.formatFENResponse(
        true,
        event,
        null,
        {
          total: 1,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error) {
      return this.formatFENResponse(
        false,
        null,
        {
          code: 'QUERY_ERROR',
          message: 'Error al consultar el evento',
          details: error.message,
        },
        {
          total: 0,
          page: 1,
          pageSize: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }
}
