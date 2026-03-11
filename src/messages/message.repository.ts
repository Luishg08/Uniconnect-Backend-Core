import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

/**
 * Patrón Repository — encapsula TODAS las operaciones de persistencia de mensajes.
 * MessagesService y MessagesGateway usan esta clase; nunca acceden a Prisma
 * directamente para la entidad message.
 */
@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Inclusiones reutilizables ─────────────────────────────────────────────

  private readonly membershipInclude = {
    membership: {
      include: {
        user: {
          select: {
            id_user: true,
            full_name: true,
            picture: true,
          },
        },
        group: {
          select: {
            id_group: true,
            name: true,
          },
        },
      },
    },
  } as const;

  // ── Escritura ─────────────────────────────────────────────────────────────

  async create(dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        id_membership: dto.id_membership,
        text_content: dto.text_content,
        attachments: dto.attachments,
        send_at: dto.send_at ?? new Date(),
      },
      include: this.membershipInclude,
    });
  }

  /**
   * Solo actualiza si el mensaje le pertenece al usuario (por id_membership).
   * Retorna null si no tiene permisos.
   */
  async updateIfOwner(
    id_message: number,
    userId: number,
    dto: UpdateMessageDto,
  ) {
    const msg = await this.prisma.message.findUnique({
      where: { id_message },
      include: { membership: { select: { id_user: true } } },
    });

    if (!msg || msg.membership?.id_user !== userId) return null;

    return this.prisma.message.update({
      where: { id_message },
      data: dto,
      include: this.membershipInclude,
    });
  }

  /**
   * El autor del mensaje puede borrarlo; el admin del grupo también puede.
   * Retorna false si no tiene permisos.
   */
  async removeIfOwnerOrAdmin(
    id_message: number,
    userId: number,
  ): Promise<boolean> {
    const msg = await this.prisma.message.findUnique({
      where: { id_message },
      include: {
        membership: {
          select: {
            id_user: true,
            id_group: true,
          },
        },
      },
    });

    if (!msg) return false;

    const isAuthor = msg.membership?.id_user === userId;

    if (!isAuthor) {
      // Verificar si el usuario es admin en ese grupo
      const adminMembership = await this.prisma.membership.findFirst({
        where: {
          id_user: userId,
          id_group: msg.membership?.id_group ?? undefined,
          is_admin: true,
        },
      });
      if (!adminMembership) return false;
    }

    await this.prisma.message.delete({ where: { id_message } });
    return true;
  }

  // ── Lectura ───────────────────────────────────────────────────────────────

  async findById(id_message: number) {
    return this.prisma.message.findUnique({
      where: { id_message },
      include: this.membershipInclude,
    });
  }

  async findAll() {
    return this.prisma.message.findMany({
      include: this.membershipInclude,
      orderBy: { send_at: 'asc' },
    });
  }

  async findByGroup(id_group: number) {
    return this.prisma.message.findMany({
      where: { membership: { id_group } },
      include: this.membershipInclude,
      orderBy: { send_at: 'asc' },
    });
  }

  async findRecentByGroup(id_group: number, limit = 50) {
    const messages = await this.prisma.message.findMany({
      where: { membership: { id_group } },
      include: this.membershipInclude,
      orderBy: { send_at: 'desc' },
      take: limit,
    });
    return messages.reverse(); // Más antiguos primero
  }

  async findByMembership(id_membership: number) {
    return this.prisma.message.findMany({
      where: { id_membership },
      include: this.membershipInclude,
      orderBy: { send_at: 'asc' },
    });
  }

  async countByGroup(id_group: number) {
    return this.prisma.message.count({
      where: { membership: { id_group } },
    });
  }

  /**
   * Marcar mensaje como editado (Fase 1 enhancement)
   */
  async markAsEdited(id_message: number, newContent: string, userId: number) {
    const msg = await this.prisma.message.findUnique({
      where: { id_message },
      include: { membership: { select: { id_user: true } } },
    });

    if (!msg || msg.membership?.id_user !== userId) return null;

    return this.prisma.message.update({
      where: { id_message },
      data: {
        text_content: newContent,
        is_edited: true,
        edited_at: new Date(),
      },
      include: this.membershipInclude,
    });
  }

  /**
   * Buscar mensajes por texto en un grupo
   */
  async searchInGroup(id_group: number, searchTerm: string) {
    return this.prisma.message.findMany({
      where: {
        membership: { id_group },
        text_content: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      include: this.membershipInclude,
      orderBy: { send_at: 'desc' },
      take: 20,
    });
  }

  /**
   * Obtener último mensaje de un grupo
   */
  async getLastMessageByGroup(id_group: number) {
    return this.prisma.message.findFirst({
      where: { membership: { id_group } },
      orderBy: { send_at: 'desc' },
      include: this.membershipInclude,
    });
  }
}
