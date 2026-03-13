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
  ): Promise<FENResponse<any[] | null>> {
    try {
      const whereClause = this.buildWhereClause(filters);
      const skip = (pagination.page - 1) * pagination.pageSize;

      const [events, total] = await Promise.all([
        (this.prisma as any).event.findMany({
          where: whereClause,
          orderBy: {
            date: 'asc',
          },
          skip,
          take: pagination.pageSize,
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
      const event = await (this.prisma as any).event.create({
        data: {
          ...createEventDto,
          date: new Date(createEventDto.date),
          created_by: userId,
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

  async findOne(id: string) {
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
