import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetClaim } from '../auth/decorators/get-token-claim.decorator';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * POST /messages
   * Crear un nuevo mensaje
   */
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo mensaje' })
  @ApiResponse({ status: 201, description: 'Mensaje creado exitosamente.' })
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  /**
   * GET /messages
   * Obtener todos los mensajes
   */
  @Get()
  @ApiOperation({ summary: 'Obtener todos los mensajes' })
  @ApiResponse({ status: 200, description: 'Lista de todos los mensajes.' })
  findAll() {
    return this.messagesService.findAll();
  }

  /**
   * GET /messages/group/:id_group/recent
   * Obtener mensajes recientes de un grupo (para cargar en UI)
   */
  @Get('group/:id_group/recent')
  @ApiOperation({ summary: 'Obtener mensajes recientes de un grupo' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Número de mensajes a cargar' })
  @ApiResponse({ status: 200, description: 'Lista de mensajes recientes.' })
  findRecentByGroup(
    @Param('id_group', ParseIntPipe) id_group: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.messagesService.findRecentByGroup(id_group, limit || 50);
  }

  /**
   * GET /messages/group/:id_group/count
   * Contar mensajes totales en un grupo
   */
  @Get('group/:id_group/count')
  @ApiOperation({ summary: 'Contar mensajes de un grupo' })
  @ApiResponse({ status: 200, description: 'Número total de mensajes.' })
  async countByGroup(@Param('id_group', ParseIntPipe) id_group: number) {
    const count = await this.messagesService.countByGroup(id_group);
    return { count };
  }

  /**
   * GET /messages/group/:id_group/last
   * Obtener último mensaje de un grupo
   */
  @Get('group/:id_group/last')
  @ApiOperation({ summary: 'Obtener último mensaje de un grupo' })
  @ApiResponse({ status: 200, description: 'Último mensaje del grupo.' })
  getLastMessage(@Param('id_group', ParseIntPipe) id_group: number) {
    return this.messagesService.getLastMessage(id_group);
  }

  /**
   * GET /messages/group/:id_group/search
   * Buscar mensajes en un grupo
   */
  @Get('group/:id_group/search')
  @ApiOperation({ summary: 'Buscar mensajes en un grupo' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Término de búsqueda' })
  @ApiResponse({ status: 200, description: 'Mensajes encontrados.' })
  searchInGroup(
    @Param('id_group', ParseIntPipe) id_group: number,
    @Query('q') searchTerm: string,
  ) {
    return this.messagesService.searchInGroup(id_group, searchTerm);
  }

  /**
   * GET /messages/group/:id_group
   * Obtener todos los mensajes de un grupo
   */
  @Get('group/:id_group')
  @ApiOperation({ summary: 'Obtener todos los mensajes de un grupo' })
  @ApiResponse({ status: 200, description: 'Lista de mensajes del grupo.' })
  findByGroup(@Param('id_group', ParseIntPipe) id_group: number) {
    return this.messagesService.findByGroup(id_group);
  }

  /**
   * GET /messages/membership/:id_membership
   * Obtener todos los mensajes de una membresía (usuario en grupo)
   */
  @Get('membership/:id_membership')
  @ApiOperation({ summary: 'Obtener mensajes de una membresía' })
  @ApiResponse({ status: 200, description: 'Lista de mensajes de la membresía.' })
  findByMembership(@Param('id_membership', ParseIntPipe) id_membership: number) {
    return this.messagesService.findByMembership(id_membership);
  }

  /**
   * GET /messages/:id
   * Obtener un mensaje por su ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un mensaje por ID' })
  @ApiResponse({ status: 200, description: 'Mensaje encontrado.' })
  @ApiResponse({ status: 404, description: 'Mensaje no encontrado.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.findOne(id);
  }

  /**
   * PATCH /messages/:id/edit
   * Editar un mensaje (con validación de autor)
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/edit')
  @ApiOperation({ summary: 'Editar un mensaje' })
  @ApiResponse({ status: 200, description: 'Mensaje editado.' })
  @ApiResponse({ status: 403, description: 'Sin permiso para editar.' })
  editMessage(
    @Param('id', ParseIntPipe) id: number,
    @GetClaim('sub') userId: number,
    @Body() body: { text_content: string },
  ) {
    return this.messagesService.editMessage(id, userId, body.text_content);
  }

  /**
   * PATCH /messages/:id
   * Actualizar un mensaje (editar contenido) - deprecated, usar /edit
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un mensaje (deprecated)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    // Este endpoint no debería usarse directamente, usar /edit con autenticación
    return { message: 'Use el endpoint /messages/:id/edit con autenticación' };
  }

  /**
   * DELETE /messages/:id
   * Eliminar un mensaje
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un mensaje' })
  @ApiResponse({ status: 200, description: 'Mensaje eliminado.' })
  @ApiResponse({ status: 403, description: 'Sin permiso para eliminar.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @GetClaim('sub') userId: number,
  ) {
    return this.messagesService.remove(id, userId);
  }
}
