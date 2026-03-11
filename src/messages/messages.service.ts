import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageRepository } from './message.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MESSAGE_EVENTS, MessageSentPayload } from './events/message.events';

@Injectable()
export class MessagesService {
  constructor(
    private messageRepository: MessageRepository,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Crear un nuevo mensaje y emitir evento
   */
  async create(createMessageDto: CreateMessageDto) {
    const message = await this.messageRepository.create(createMessageDto);

    // Emitir evento de mensaje enviado
    if (message.membership?.user && message.membership?.group) {
      const payload: MessageSentPayload = {
        id_message: message.id_message,
        id_group: message.membership.group.id_group,
        id_user: message.membership.user.id_user,
        text_content: message.text_content || '',
        send_at: message.send_at,
      };
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_SENT, payload);
    }

    return message;
  }

  /**
   * Obtener todos los mensajes
   */
  async findAll() {
    return this.messageRepository.findAll();
  }

  /**
   * Obtener un mensaje por su ID
   */
  async findOne(id: number) {
    return this.messageRepository.findById(id);
  }

  /**
   * Obtener todos los mensajes de un grupo
   */
  async findByGroup(id_group: number) {
    return this.messageRepository.findByGroup(id_group);
  }

  /**
   * Obtener todos los mensajes de una membresía (usuario en grupo)
   */
  async findByMembership(id_membership: number) {
    return this.messageRepository.findByMembership(id_membership);
  }

  /**
   * Actualizar un mensaje (editar contenido)
   */
  async update(id: number, userId: number, updateMessageDto: UpdateMessageDto) {
    return this.messageRepository.updateIfOwner(id, userId, updateMessageDto);
  }

  /**
   * Marcar mensaje como editado
   */
  async editMessage(id: number, userId: number, newContent: string) {
    const message = await this.messageRepository.markAsEdited(id, newContent, userId);

    // Emitir evento de mensaje editado
    if (message && message.membership?.user && message.membership?.group) {
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_EDITED, {
        id_message: message.id_message,
        id_group: message.membership.group.id_group,
        id_user: message.membership.user.id_user,
        text_content: message.text_content || '',
        edited_at: message.edited_at || new Date(),
      });
    }

    return message;
  }

  /**
   * Eliminar un mensaje
   */
  async remove(id: number, userId: number) {
    // Obtener información del mensaje antes de eliminarlo
    const message = await this.messageRepository.findById(id);

    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    const removed = await this.messageRepository.removeIfOwnerOrAdmin(id, userId);
    
    if (!removed) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar este mensaje',
      );
    }

    // Emitir evento de mensaje eliminado
    if (message.membership?.user && message.membership?.group) {
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_DELETED, {
        id_message: message.id_message,
        id_group: message.membership.group.id_group,
        id_user: userId,
        deleted_at: new Date(),
      });
    }

    return { message: 'Mensaje eliminado exitosamente' };
  }

  /**
   * Obtener mensajes recientes de un grupo (últimos N mensajes)
   */
  async findRecentByGroup(id_group: number, limit: number = 50) {
    return this.messageRepository.findRecentByGroup(id_group, limit);
  }

  /**
   * Buscar mensajes en un grupo por texto
   */
  async searchInGroup(id_group: number, searchTerm: string) {
    return this.messageRepository.searchInGroup(id_group, searchTerm);
  }

  /**
   * Contar mensajes de un grupo
   */
  async countByGroup(id_group: number): Promise<number> {
    return this.messageRepository.countByGroup(id_group);
  }

  /**
   * Obtener último mensaje de un grupo
   */
  async getLastMessage(id_group: number) {
    return this.messageRepository.getLastMessageByGroup(id_group);
  }
}

