import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}
