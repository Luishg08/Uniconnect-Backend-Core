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
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * POST /messages
   * Crear un nuevo mensaje
   */
  @Post()
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  /**
   * POST /messages/direct/:userId/with/:otherUserId
   * Iniciar o obtener un chat 1:1 con otro usuario
   * IMPORTANTE: Esta ruta DEBE ir AQUÍ, antes de @Get() dinámicos
   */
  @Post('direct/:userId/with/:otherUserId')
  getOrCreateDirectChat(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('otherUserId', ParseIntPipe) otherUserId: number,
  ) {
    return this.messagesService.getOrCreateDirectChat(userId, otherUserId);
  }

  /**
   * GET /messages/direct/:userId
   * Obtener todos los chats 1:1 de un usuario
   * IMPORTANTE: Esta ruta más específica va ANTES de @Get(':id')
   */
  @Get('direct/:userId')
  getUserDirectChats(@Param('userId', ParseIntPipe) userId: number) {
    return this.messagesService.getUserDirectChats(userId);
  }

  /**
   * GET /messages/group/:id_group/recent
   * Obtener mensajes recientes de un grupo (para cargar en UI)
   * IMPORTANTE: Esta ruta más específica va ANTES de @Get('group/:id_group')
   */
  @Get('group/:id_group/recent')
  findRecentByGroup(
    @Param('id_group', ParseIntPipe) id_group: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.messagesService.findRecentByGroup(id_group, limit);
  }

  /**
   * GET /messages/group/:id_group/count
   * Contar mensajes totales en un grupo
   * IMPORTANTE: Esta ruta más específica va ANTES de @Get('group/:id_group')
   */
  @Get('group/:id_group/count')
  countByGroup(@Param('id_group', ParseIntPipe) id_group: number) {
    return this.messagesService.countByGroup(id_group);
  }

  /**
   * GET /messages/group/:id_group
   * Obtener todos los mensajes de un grupo
   */
  @Get('group/:id_group')
  findByGroup(@Param('id_group', ParseIntPipe) id_group: number) {
    return this.messagesService.findByGroup(id_group);
  }

  /**
   * GET /messages/membership/:id_membership
   * Obtener todos los mensajes de una membresía (usuario en grupo)
   */
  @Get('membership/:id_membership')
  findByMembership(@Param('id_membership', ParseIntPipe) id_membership: number) {
    return this.messagesService.findByMembership(id_membership);
  }

  /**
   * GET /messages
   * Obtener todos los mensajes
   */
  @Get()
  findAll() {
    return this.messagesService.findAll();
  }

  /**
   * GET /messages/:id
   * Obtener un mensaje por su ID
   * IMPORTANTE: Esta ruta GENÉRICA va al FINAL
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.findOne(id);
  }

  /**
   * PATCH /messages/:id
   * Actualizar un mensaje (editar contenido)
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.messagesService.update(id, updateMessageDto);
  }

  /**
   * DELETE /messages/:id
   * Eliminar un mensaje
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.remove(id);
  }
}
