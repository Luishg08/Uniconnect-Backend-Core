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
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.findOne(id);
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
   * GET /messages/group/:id_group/recent
   * Obtener mensajes recientes de un grupo (para cargar en UI)
   */
  @Get('group/:id_group/recent')
  findRecentByGroup(
    @Param('id_group', ParseIntPipe) id_group: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.messagesService.findRecentByGroup(id_group, limit);
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
   * GET /messages/group/:id_group/count
   * Contar mensajes totales en un grupo
   */
  @Get('group/:id_group/count')
  countByGroup(@Param('id_group', ParseIntPipe) id_group: number) {
    return this.messagesService.countByGroup(id_group);
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
