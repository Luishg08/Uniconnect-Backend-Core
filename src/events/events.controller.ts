import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { GetClaim } from '../auth/decorators/get-token-claim.decorator';
import { EventType } from './enums/event-type.enum';
import { EventFilters } from './dto/event-filters.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @UseGuards(JwtAuthGuard) // ⭐ Solo requiere autenticación, no admin
  @ApiOperation({ summary: 'Consultar eventos académicos con filtros opcionales' })
  @ApiQuery({ name: 'date', required: false, description: 'Fecha exacta en formato ISO 8601 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'type', required: false, enum: EventType, description: 'Tipo de evento' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Fecha inicial del rango en formato ISO 8601' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Fecha final del rango en formato ISO 8601' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Tamaño de página (default: 20)' })
  async findAll(
    @Query() queryParams: EventFilters & { page?: string; pageSize?: string },
    @GetClaim('sub') userId: number, // ⭐ FIX: Use 'sub' from JWT payload (standard claim)
  ) {
    const { page = '1', pageSize = '20', ...filters } = queryParams;
    const pageNum = parseInt(page, 10) || 1;
    const pageSizeNum = parseInt(pageSize, 10) || 20;

    return this.eventsService.findAll(
      filters,
      { page: pageNum, pageSize: pageSizeNum },
      userId, // ⭐ NUEVO: Pasar userId para filtrado por carrera
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard) // ⭐ Solo requiere autenticación, no admin
  @ApiOperation({ summary: 'Obtener un evento por ID' })
  async findOne(
    @Param('id') id: string,
    @GetClaim('sub') userId: number, // ⭐ FIX: Use 'sub' from JWT payload (standard claim)
  ) {
    return this.eventsService.findOne(id, userId); // ⭐ NUEVO: Pasar userId para validación de acceso
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard) // ⭐ Requiere autenticación Y ser admin
  @AdminOnly()
  @ApiOperation({ summary: 'Crear un nuevo evento (Solo administradores)' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @GetClaim('sub') userId: number, // ⭐ FIX: Use 'sub' from JWT payload (standard claim)
  ) {

    return this.eventsService.create(createEventDto, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard) // ⭐ Requiere autenticación Y ser admin
  @AdminOnly()
  @ApiOperation({ summary: 'Actualizar un evento existente (Solo administradores)' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @GetClaim('sub') userId: number, // ⭐ FIX: Use 'sub' from JWT payload (standard claim)
    @GetClaim('roleName') userRole: string, // ⭐ Extract role from JWT
  ) {
    return this.eventsService.update(id, updateEventDto, userId, userRole);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard) // ⭐ Solo requiere autenticación (validación de propiedad en service)
  @ApiOperation({ summary: 'Eliminar un evento propio (creador o superadmin)' })
  async deleteOwn(
    @Param('id') id: string,
    @GetClaim('sub') userId: number,
    @GetClaim('roleName') userRole: string,
  ) {
    return this.eventsService.deleteOwn(id, userId, userRole);
  }
}
