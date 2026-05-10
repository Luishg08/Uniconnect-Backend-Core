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
import { ContentModeration } from './decorators/content-moderation.decorator';
import { PrismaService } from '../prisma/prisma.service';

/** Regex para capturar @nombre (letras, números, guiones, puntos) */
const MENTION_REGEX = /@([\w.\-]+)/g;

@Injectable()
export class MessagesService {
  constructor(
    private messageRepository: MessageRepository,
    private eventEmitter: EventEmitter2,
    private prisma: PrismaService,
  ) {}

  /**
   * Crear un nuevo mensaje y emitir evento.
   * @ContentModeration intercepta el DTO antes del procesamiento para
   * filtrar palabras prohibidas y validar longitud.
   */
  @ContentModeration({ filterProfanity: true, maxLength: 500, logActivity: true })
  async create(createMessageDto: CreateMessageDto) {
    const message = await this.messageRepository.createWithFiles(
      createMessageDto,
      createMessageDto.files,
    );

    // Emitir evento de mensaje enviado
    if (message && message.membership?.user && message.membership?.group) {
      const payload: MessageSentPayload = {
        id_message: message.id_message,
        id_group: message.membership.group.id_group,
        id_user: message.membership.user.id_user,
        text_content: message.text_content || '',
        send_at: message.send_at,
        sender_name: message.membership.user.full_name,
        sender_picture: message.membership.user.picture || null,
      };
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_SENT, payload);

      // Procesar menciones en background (no bloquea la respuesta)
      if (message.text_content) {
        this.processMentions(
          message.text_content,
          message.membership.group.id_group,
          message.membership.user.id_user,
          message.membership.user.full_name,
          message.id_message,
        ).catch((err) =>
          console.error('[MessagesService] Error procesando menciones:', err),
        );
      }
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
        sender_name: message.membership.user.full_name,
        sender_picture: message.membership.user.picture || null,
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
   * Soporta paginación por cursor: beforeId = id_message del más antiguo ya cargado
   */
  async findRecentByGroup(id_group: number, limit: number = 50, beforeId?: number) {
    return this.messageRepository.findRecentByGroup(id_group, limit, beforeId);
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

  // ── Menciones ─────────────────────────────────────────────────────────────

  /**
   * Escanea el texto, valida que los mencionados sean miembros del grupo,
   * crea la notificación en BD y dispara push si tienen token activo.
   * Se ejecuta en background — no bloquea la respuesta al cliente.
   */
  private async processMentions(
    text: string,
    groupId: number,
    senderId: number,
    senderName: string,
    messageId: number,
  ): Promise<void> {
    // Extraer nombres únicos mencionados
    const names = [...new Set([...text.matchAll(MENTION_REGEX)].map((m) => m[1]))];
    if (names.length === 0) return;

    // Obtener todos los miembros del grupo con su nombre y tokens
    const memberships = await this.prisma.membership.findMany({
      where: { id_group: groupId },
      include: {
        user: {
          select: {
            id_user: true,
            full_name: true,
            push_token: {
              where: { is_active: true },
              select: { token: true, device_type: true },
            },
          },
        },
      },
    });

    for (const name of names) {
      // Buscar miembro cuyo nombre empiece con la mención (case-insensitive)
      const match = memberships.find((m) => {
        if (!m.user) return false;
        const firstName = m.user.full_name.split(' ')[0];
        const noSpaces = m.user.full_name.replace(/\s+/g, '');
        return (
          firstName.toLowerCase() === name.toLowerCase() ||
          noSpaces.toLowerCase() === name.toLowerCase()
        );
      });

      // No notificar si no existe, no es miembro, o es el propio remitente
      if (!match?.user || match.user.id_user === senderId) continue;

      const mentionedUser = match.user;
      const notifMessage = `${senderName} te mencionó en un mensaje`;

      // 1. Guardar notificación en BD — related_entity_id apunta al grupo para navegar directo
      await this.prisma.notification.create({
        data: {
          id_user: mentionedUser.id_user,
          message: notifMessage,
          is_read: false,
          created_at: new Date(),
          notification_type: 'mention',
          related_entity_id: groupId,   // id_group para navegar al chat
          push_sent: false,
        },
      });

      // 2. Emitir evento interno (WebSocket puede escucharlo para badge en tiempo real)
      this.eventEmitter.emit(MESSAGE_EVENTS.MESSAGE_MENTIONED, {
        id_message: messageId,
        id_group: groupId,
        mentioned_user_id: mentionedUser.id_user,
        sender_name: senderName,
        text_content: text,
      });

      // 3. Enviar push notification si tiene tokens activos
      if (mentionedUser.push_token.length > 0) {
        await this.sendExpoPush(
          mentionedUser.push_token.map((t) => t.token),
          `📣 ${senderName} te mencionó`,
          text.length > 80 ? text.slice(0, 77) + '...' : text,
          { type: 'mention', messageId, groupId },
        );

        // Marcar push_sent en la notificación recién creada
        await this.prisma.notification.updateMany({
          where: {
            id_user: mentionedUser.id_user,
            related_entity_id: messageId,
            notification_type: 'mention',
            push_sent: false,
          },
          data: { push_sent: true },
        });
      }
    }
  }

  /**
   * Envía push notifications via Expo Push API.
   * Usa fetch nativo para no añadir dependencias.
   */
  private async sendExpoPush(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default' }));
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
    } catch (err) {
      console.error('[MessagesService] Error enviando push:', err);
    }
  }
}

