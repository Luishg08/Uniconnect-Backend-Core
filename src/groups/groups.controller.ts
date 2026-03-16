import { Controller, Get, Post, Body, Param, Delete, Query, ParseIntPipe, Patch, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GroupOwnershipGuard } from './guards/group-ownership.guard';
import { CanCreateGroupGuard } from './guards/can-create-group.guard';

@ApiTags('groups') 
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @UseGuards(JwtAuthGuard, CanCreateGroupGuard)
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

  @Post('direct-message/:userId2')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Crear o encontrar chat privado con otro usuario' })
    @ApiResponse({ status: 200, description: 'Chat privado creado o encontrado.' })
    @ApiResponse({ status: 403, description: 'No hay conexión aceptada entre los usuarios.' })
    @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
    findOrCreateDirectMessage(
      @GetClaim('sub') userId1: number,
      @Param('userId2', ParseIntPipe) userId2: number,
    ) {
      return this.groupsService.findOrCreateDirectMessage(userId1, userId2);
    }

  @Get('direct-messages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar todos los chats privados del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de chats privados con último mensaje.' })
  findUserDirectMessages(@GetClaim('sub') userId: number) {
    return this.groupsService.findUserDirectMessages(userId);
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

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
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

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
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

  // =====================================================
  // SOLICITUDES DE ACCESO A GRUPOS
  // =====================================================

  @UseGuards(JwtAuthGuard)
  @Post(':id/join-request')
  @ApiOperation({
    summary: 'HU: Solicitar acceso a un grupo de comunidad',
    description: 'Usuario solicita acceso a un grupo disponible en comunidad',
  })
  @ApiResponse({ status: 201, description: 'Solicitud de acceso creada' })
  @ApiResponse({ status: 400, description: 'Ya eres miembro o solicitud pendiente' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  requestGroupAccess(
    @Param('id', ParseIntPipe) groupId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.requestGroupAccess(userId, groupId);
  }

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
  @Get(':id/join-requests')
  @ApiOperation({
    summary: 'HU: Listar solicitudes pendientes (Solo owner)',
    description: 'Owner ve todas las solicitudes de acceso al grupo',
  })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes' })
  @ApiResponse({ status: 403, description: 'No eres el owner del grupo' })
  getPendingJoinRequests(
    @Param('id', ParseIntPipe) groupId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.getPendingJoinRequests(groupId, userId);
  }

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
  @Patch(':id/join-requests/:requestId/accept')
  @ApiOperation({
    summary: 'HU: Aceptar solicitud de acceso (Solo owner)',
    description: 'Owner acepta solicitud y agrega usuario como miembro',
  })
  @ApiResponse({ status: 200, description: 'Solicitud aceptada, usuario agregado al grupo' })
  @ApiResponse({ status: 403, description: 'No eres el owner' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  acceptJoinRequest(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('requestId', ParseIntPipe) requestId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.acceptJoinRequest(requestId, groupId, userId);
  }

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
  @Patch(':id/join-requests/:requestId/reject')
  @ApiOperation({
    summary: 'HU: Rechazar solicitud de acceso (Solo owner)',
    description: 'Owner rechaza la solicitud de acceso al grupo',
  })
  @ApiResponse({ status: 200, description: 'Solicitud rechazada' })
  @ApiResponse({ status: 403, description: 'No eres el owner' })
  rejectJoinRequest(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('requestId', ParseIntPipe) requestId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.rejectJoinRequest(requestId, groupId, userId);
  }

  // =====================================================
  // GESTIÓN DE MIEMBROS
  // =====================================================

  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  @ApiOperation({
    summary: 'HU: Listar miembros del grupo',
    description: 'Solo miembros del grupo pueden ver su lista de participantes',
  })
  @ApiResponse({ status: 200, description: 'Lista de miembros' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  getGroupMembers(@Param('id', ParseIntPipe) groupId: number) {
    return this.groupsService.getGroupMembers(groupId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/leave')
  @ApiOperation({
    summary: 'HU: Abandonar grupo',
    description: 'Usuario abandona el grupo (no puede ser el owner)',
  })
  @ApiResponse({ status: 200, description: 'Grupo abandonado exitosamente' })
  @ApiResponse({ status: 400, description: 'El owner no puede abandonar así' })
  @ApiResponse({ status: 404, description: 'No eres miembro del grupo' })
  leaveGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.leaveGroup(groupId, userId);
  }

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
  @Delete(':id/members/:memberId')
  @ApiOperation({
    summary: 'HU: Sacar miembro del grupo (Solo owner)',
    description: 'Owner remueve un miembro del grupo',
  })
  @ApiResponse({ status: 200, description: 'Miembro removido' })
  @ApiResponse({ status: 403, description: 'No eres el owner' })
  @ApiResponse({ status: 404, description: 'Miembro no encontrado' })
  removeMember(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.removeMember(groupId, memberId, userId);
  }

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
  @Patch(':id/members/:memberId/make-admin')
  @ApiOperation({
    summary: 'HU: Dar rol de admin a miembro (Solo owner)',
    description: 'Owner promueve a un miembro como admin del grupo',
  })
  @ApiResponse({ status: 200, description: 'Miembro promovido a admin' })
  @ApiResponse({ status: 403, description: 'No eres el owner' })
  @ApiResponse({ status: 404, description: 'Miembro no encontrado' })
  makeAdmin(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.makeAdmin(groupId, memberId, userId);
  }

  @UseGuards(JwtAuthGuard, GroupOwnershipGuard)
  @Post(':id/invite/:inviteeId')
  @ApiOperation({
    summary: 'HU: Invitar usuario (Solo owner)',
    description: 'Owner invita a un usuario conectado al grupo',
  })
  @ApiResponse({ status: 201, description: 'Invitación enviada' })
  @ApiResponse({ status: 400, description: 'Sin conexión aceptada o ya es miembro' })
  @ApiResponse({ status: 403, description: 'No eres el owner' })
  inviteUser(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('inviteeId', ParseIntPipe) inviteeId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.inviteUser(groupId, inviteeId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/info')
  @ApiOperation({
    summary: 'HU: Información del grupo con permisos del usuario',
    description:
      'Obtiene info del grupo con datos sobre permisos y rol del usuario actual',
  })
  @ApiResponse({ status: 200, description: 'Información del grupo' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  getGroupInfo(
    @Param('id', ParseIntPipe) groupId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.getGroupInfo(groupId, userId);
  }
  @UseGuards(JwtAuthGuard)
  @Patch(':id/invitations/:invitationId/accept')
  acceptInvitation(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.acceptInvitation(invitationId, groupId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/invitations/:invitationId/reject')
  rejectInvitation(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('invitationId', ParseIntPipe) invitationId: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.groupsService.rejectInvitation(invitationId, groupId, userId);
  }
}