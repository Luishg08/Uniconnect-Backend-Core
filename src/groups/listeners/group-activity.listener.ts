import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGE_EVENTS } from '../../messages/events/message.events';
import type {
  GroupCreatedPayload,
  GroupUpdatedPayload,
  GroupDeletedPayload,
  UserLeftGroupPayload,
} from '../../messages/events/message.events';

/**
 * Listener de eventos para actividades de grupos de estudio
 * Patrón Observer: Escucha eventos del ciclo de vida de grupos y reacciona creando notificaciones
 * US-O01: Observer para eventos del grupo de estudio
 */
@Injectable()
export class GroupActivityListener {
  private readonly logger = new Logger(GroupActivityListener.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Escuchar evento de grupo creado
   * Crear notificación para el owner confirmando la creación
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_CREATED)
  async handleGroupCreated(payload: GroupCreatedPayload) {
    try {
      this.logger.log(
        `Handling GROUP_CREATED event for group ${payload.id_group}`,
      );

      await this.prisma.notification.create({
        data: {
          id_user: payload.owner_id,
          message: `Grupo '${payload.group_name}' creado exitosamente`,
          is_read: false,
          created_at: new Date(),
          related_entity_id: payload.id_group,
          notification_type: 'group_created',
        },
      });

      this.logger.log(
        `Created notification for owner ${payload.owner_id} - group created`,
      );
    } catch (error) {
      this.logger.error('Error handling GROUP_CREATED event:', error);
    }
  }

  /**
   * Escuchar evento de grupo actualizado
   * Crear notificaciones para todos los miembros excepto el owner
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_UPDATED)
  async handleGroupUpdated(payload: GroupUpdatedPayload) {
    try {
      this.logger.log(
        `Handling GROUP_UPDATED event for group ${payload.id_group}`,
      );

      // Obtener todos los miembros del grupo excepto el owner
      const members = await this.prisma.membership.findMany({
        where: {
          id_group: payload.id_group,
          id_user: { not: payload.owner_id },
        },
      });

      if (members.length === 0) {
        this.logger.log('No members to notify for group update');
        return;
      }

      // Crear notificaciones batch para todos los miembros
      const notifications = members.map((member) => ({
        id_user: member.id_user!,
        message: `El grupo '${payload.group_name}' fue actualizado`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: payload.id_group,
        notification_type: 'group_updated',
      }));

      await this.prisma.notification.createMany({
        data: notifications,
      });

      this.logger.log(
        `Created ${notifications.length} notifications for group update`,
      );
    } catch (error) {
      this.logger.error('Error handling GROUP_UPDATED event:', error);
    }
  }

  /**
   * Escuchar evento de grupo eliminado
   * Crear notificaciones para todos los miembros que estaban en el grupo
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_DELETED)
  async handleGroupDeleted(payload: GroupDeletedPayload) {
    try {
      this.logger.log(
        `Handling GROUP_DELETED event for group ${payload.id_group}`,
      );

      if (payload.member_ids.length === 0) {
        this.logger.log('No members to notify for group deletion');
        return;
      }

      // Crear notificaciones para todos los miembros usando member_ids del payload
      const notifications = payload.member_ids.map((memberId) => ({
        id_user: memberId,
        message: `El grupo '${payload.group_name}' fue eliminado`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: payload.id_group,
        notification_type: 'group_deleted',
      }));

      await this.prisma.notification.createMany({
        data: notifications,
      });

      this.logger.log(
        `Created ${notifications.length} notifications for group deletion`,
      );
    } catch (error) {
      this.logger.error('Error handling GROUP_DELETED event:', error);
    }
  }

  /**
   * Escuchar evento de usuario que salió del grupo
   * Crear notificaciones para los miembros restantes
   */
  @OnEvent(MESSAGE_EVENTS.USER_LEFT_GROUP)
  async handleUserLeftGroup(payload: UserLeftGroupPayload) {
    try {
      this.logger.log(
        `Handling USER_LEFT_GROUP event: user ${payload.id_user} left group ${payload.id_group}`,
      );

      // Obtener miembros restantes del grupo (excluir al usuario que salió)
      const remainingMembers = await this.prisma.membership.findMany({
        where: {
          id_group: payload.id_group,
          id_user: { not: payload.id_user },
        },
      });

      if (remainingMembers.length === 0) {
        this.logger.log('No remaining members to notify');
        return;
      }

      // Crear notificaciones batch para miembros restantes
      const notifications = remainingMembers.map((member) => ({
        id_user: member.id_user!,
        message: `${payload.user_name} salió del grupo '${payload.group_name}'`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: payload.id_group,
        notification_type: 'user_left_group',
      }));

      await this.prisma.notification.createMany({
        data: notifications,
      });

      this.logger.log(
        `Created ${notifications.length} notifications for user leaving group`,
      );
    } catch (error) {
      this.logger.error('Error handling USER_LEFT_GROUP event:', error);
    }
  }
}
