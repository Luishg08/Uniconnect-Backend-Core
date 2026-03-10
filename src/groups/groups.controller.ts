import { Controller, Get, Post, Body, Param, Delete, Query, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('groups') 
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo grupo de estudio y asignar owner como admin' })
  @ApiResponse({ status: 201, description: 'El grupo y la membresía han sido creados.' })
  @ApiResponse({ status: 404, description: 'El curso especificado no existe.' })
  @ApiResponse({ status: 500, description: 'Error interno al procesar la transacción.' })
  create(@Body() createGroupDto: CreateGroupDto) {
    return this.groupsService.create(createGroupDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar grupos donde el usuario es miembro' })
  @ApiResponse({ status: 200, description: 'Lista de grupos con conteo de miembros.' })
  findAll(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupsService.findAllByUser(userId);
  }

  @Get('created-by/:userId')
  @ApiOperation({ summary: 'Listar grupos creados por el usuario (es owner)' })
  @ApiResponse({ status: 200, description: 'Lista de grupos creados por el usuario.' })
  findGroupsCreated(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupsService.findGroupsCreatedByUser(userId);
  }

  @Get('member-of/:userId')
  @ApiOperation({ summary: 'Listar grupos donde el usuario es miembro' })
  @ApiResponse({ status: 200, description: 'Lista de grupos donde el usuario participa.' })
  findGroupsMember(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupsService.findGroupsMemberOf(userId);
  }

  @Get('discover/:userId')
  @ApiOperation({ summary: 'Descubrir grupos disponibles según materias inscritas' })
  @ApiResponse({ status: 200, description: 'Lista de grupos disponibles para unirse.' })
  discoverGroups(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupsService.discoverGroups(userId);
  }

  @Get('by-course/:courseId')
  @ApiOperation({ summary: 'Buscar grupos por materia específica' })
  @ApiResponse({ status: 200, description: 'Lista de grupos de la materia.' })
  findByCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.groupsService.findGroupsByCourse(courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un grupo específico' })
  @ApiResponse({ status: 200, description: 'Datos del grupo encontrados.' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.groupsService.findOne(id); 
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un grupo (Solo permitido al owner)' })
  @ApiQuery({ name: 'userId', description: 'ID del usuario autenticado para verificar propiedad' })
  @ApiResponse({ status: 200, description: 'Grupo eliminado exitosamente.' })
  @ApiResponse({ status: 403, description: 'Prohibido: El usuario no es el dueño del grupo.' })
  remove(
    @Param('id', ParseIntPipe) id: number, 
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.remove(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar información del grupo (Solo owner)' })
  @ApiQuery({ name: 'userId', description: 'ID del usuario para verificar propiedad' })
  @ApiResponse({ status: 200, description: 'Grupo actualizado correctamente.' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para editar este grupo.' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @GetClaim('sub') userId: number,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.groupsService.update(id, userId, updateGroupDto);
  }
}