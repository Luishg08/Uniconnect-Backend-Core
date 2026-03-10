import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageRepository } from './message.repository';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo mensaje
   */
  async create(createMessageDto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        id_membership: createMessageDto.id_membership,
        text_content: createMessageDto.text_content,
        attachments: createMessageDto.attachments,
        send_at: createMessageDto.send_at || new Date(),
      },
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
    });
  }

  /**
   * Obtener todos los mensajes
   */
  async findAll() {
    return this.prisma.message.findMany({
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
      orderBy: {
        send_at: 'asc',
      },
    });
  }

  /**
   * Obtener un mensaje por su ID
   */
  async findOne(id: number) {
    return this.prisma.message.findUnique({
      where: { id_message: id },
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
    });
  }

  /**
   * Obtener todos los mensajes de un grupo
   */
  async findByGroup(id_group: number) {
    return this.prisma.message.findMany({
      where: {
        membership: {
          id_group,
        },
      },
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
      orderBy: {
        send_at: 'asc',
      },
    });
  }

  /**
   * Obtener todos los mensajes de una membresía (usuario en grupo)
   */
  async findByMembership(id_membership: number) {
    return this.prisma.message.findMany({
      where: { id_membership },
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
      orderBy: {
        send_at: 'asc',
      },
    });
  }

  /**
   * Actualizar un mensaje (editar contenido)
   */
  async update(id: number, updateMessageDto: UpdateMessageDto) {
    return this.prisma.message.update({
      where: { id_message: id },
      data: updateMessageDto,
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
    });
  }

  /**
   * Eliminar un mensaje
   */
  async remove(id: number) {
    return this.prisma.message.delete({
      where: { id_message: id },
    });
  }

  /**
   * Obtener mensajes recientes de un grupo (últimos N mensajes)
   */
  async findRecentByGroup(id_group: number, limit: number = 50) {
    return this.prisma.message.findMany({
      where: {
        membership: {
          id_group,
        },
      },
      include: {
        membership: {
          include: {
            user: true,
            group: true,
          },
        },
      },
      orderBy: {
        send_at: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Contar mensajes en un grupo
   */
  async countByGroup(id_group: number) {
    return this.prisma.message.count({
      where: {
        membership: {
          id_group,
        },
      },
    });
  }

  /**
   * Obtener o crear un chat 1:1 entre dos usuarios
   * Reutiliza la estructura de Group con exactamente 2 miembros
   */
  async getOrCreateDirectChat(user1Id: number, user2Id: number) {
    // Validación básica
    if (user1Id === user2Id) {
      throw new Error('No puedes iniciar un chat contigo mismo');
    }

    // 1. Buscar si ya existe un grupo compartido entre estos dos usuarios que tenga exactamente 2 miembros
    const existingGroups = await this.prisma.group.findMany({
      where: {
        memberships: { some: { id_user: user1Id } },
        AND: { memberships: { some: { id_user: user2Id } } },
      },
      include: { memberships: true },
    });

    // Filtrar para asegurar que sea un chat exclusivo de ellos 2 y sea de tipo Direct Message
    const directChat = existingGroups.find(
      (group) =>
        group.memberships.length === 2 &&
        group.description === 'Direct Message',
    );

    if (directChat) {
      return directChat;
    }

    // 2. Si no existe, crear el "grupo privado" para ellos dos
    return await this.prisma.group.create({
      data: {
        name: `DM_${Math.min(user1Id, user2Id)}_${Math.max(user1Id, user2Id)}`,
        description: 'Direct Message',
        memberships: {
          create: [
            { id_user: user1Id, joined_at: new Date() },
            { id_user: user2Id, joined_at: new Date() },
          ],
        },
      },
      include: { memberships: true },
    });
  }

  /**
   * Obtener todos los chats 1:1 de un usuario
   */
  async getUserDirectChats(userId: number) {
    const chats = await this.prisma.group.findMany({
      where: {
        description: 'Direct Message',
        memberships: {
          some: { id_user: userId },
        },
      },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });

    // Para cada chat, obtener el último mensaje (query separada por eficiencia)
    const chatsWithLastMessage = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await this.prisma.message.findFirst({
          where: {
            membership: {
              id_group: chat.id_group,
            },
          },
          orderBy: {
            send_at: 'desc',
          },
          take: 1,
        });

        const otherUser = chat.memberships.find((m) => m.id_user !== userId);

        return {
          id_group: chat.id_group,
          otherUserId: otherUser?.id_user,
          otherUserName: otherUser?.user?.full_name,
          otherUserPicture: otherUser?.user?.picture,
          lastMessage,
        };
      }),
    );

    // Ordenar por fecha del último mensaje (más reciente primero)
    return chatsWithLastMessage.sort(
      (a, b) =>
        new Date(b.lastMessage?.send_at || 0).getTime() -
        new Date(a.lastMessage?.send_at || 0).getTime(),
    );
  }
}

