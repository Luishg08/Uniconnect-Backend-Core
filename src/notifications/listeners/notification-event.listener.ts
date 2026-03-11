import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGE_EVENTS } from '../../messages/events/message.events';
import type {
  MessageSentPayload,
  GroupInvitationSentPayload,
  GroupInvitationAcceptedPayload,
  UserJoinedGroupPayload,
  ConnectionRequestSentPayload,
} from '../../messages/events/message.events';

/**
 * Listener de eventos para crear notificaciones automáticamente
 * Patrón Observer: Escucha eventos del sistema y reacciona creando notificaciones
 */
@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Escuchar evento de mensaje enviado
   * Crear notificaciones para todos los miembros del grupo excepto el remitente
   */
  @OnEvent(MESSAGE_EVENTS.MESSAGE_SENT)
  async handleMessageSent(payload: MessageSentPayload) {
    try {
      this.logger.log(
        `Handling MESSAGE_SENT event for group ${payload.id_group}`,
      );

      // Obtener todos los miembros del grupo excepto el remitente
      const members = await this.prisma.membership.findMany({
        where: {
          id_group: payload.id_group,
          id_user: { not: payload.id_user },
        },
        include: {
          user: { select: { full_name: true } },
          group: { select: { name: true } },
        },
      });

      // Crear notificaciones para cada miembro
      const notifications = members.map((member) => ({
        id_user: member.id_user!,
        message: `Nuevo mensaje en ${member.group?.name || 'el grupo'}`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: payload.id_message,
        notification_type: 'message',
      }));

      if (notifications.length > 0) {
        await this.prisma.notification.createMany({
          data: notifications,
        });

        this.logger.log(
          `Created ${notifications.length} notifications for message ${payload.id_message}`,
        );
      }
    } catch (error) {
      this.logger.error('Error handling MESSAGE_SENT event:', error);
    }
  }

  /**
   * Escuchar evento de invitación enviada
   * Crear notificación para el invitado
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_INVITATION_SENT)
  async handleGroupInvitationSent(payload: GroupInvitationSentPayload) {
    try {
      this.logger.log(
        `Handling GROUP_INVITATION_SENT event for user ${payload.invitee_id}`,
      );

      await this.prisma.notification.create({
        data: {
          id_user: payload.invitee_id,
          message: `${payload.inviter_name} te invitó a unirte al grupo "${payload.group_name}"`,
          is_read: false,
          created_at: new Date(),
          related_entity_id: payload.id_invitation,
          notification_type: 'group_invitation',
        },
      });

      this.logger.log(
        `Created notification for invitation ${payload.id_invitation}`,
      );
    } catch (error) {
      this.logger.error(
        'Error handling GROUP_INVITATION_SENT event:',
        error,
      );
    }
  }

  /**
   * Escuchar evento de invitación aceptada
   * Crear notificación para el admin que envió la invitación
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_INVITATION_ACCEPTED)
  async handleGroupInvitationAccepted(payload: GroupInvitationAcceptedPayload) {
    try {
      this.logger.log(
        `Handling GROUP_INVITATION_ACCEPTED event for invitation ${payload.id_invitation}`,
      );

      // Obtener el inviter para notificarle
      const invitation = await this.prisma.group_invitation.findUnique({
        where: { id_invitation: payload.id_invitation },
        select: { inviter_id: true },
      });

      if (invitation) {
        await this.prisma.notification.create({
          data: {
            id_user: invitation.inviter_id,
            message: `${payload.invitee_name} aceptó tu invitación al grupo "${payload.group_name}"`,
            is_read: false,
            created_at: new Date(),
            related_entity_id: payload.id_invitation,
            notification_type: 'group_invitation_accepted',
          },
        });

        this.logger.log(
          `Created notification for accepted invitation ${payload.id_invitation}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Error handling GROUP_INVITATION_ACCEPTED event:',
        error,
      );
    }
  }

  /**
   * Escuchar evento de usuario unido al grupo
   * Notificar a todos los miembros del grupo
   */
  @OnEvent(MESSAGE_EVENTS.USER_JOINED_GROUP)
  async handleUserJoinedGroup(payload: UserJoinedGroupPayload) {
    try {
      this.logger.log(
        `Handling USER_JOINED_GROUP event for group ${payload.id_group}`,
      );

      // Obtener todos los miembros del grupo excepto el que se unió
      const members = await this.prisma.membership.findMany({
        where: {
          id_group: payload.id_group,
          id_user: { not: payload.id_user },
        },
        include: {
          group: { select: { name: true } },
        },
      });

      // Crear notificaciones para cada miembro
      const notifications = members.map((member) => ({
        id_user: member.id_user!,
        message: `${payload.full_name} se unió al grupo ${member.group?.name || 'el grupo'}`,
        is_read: false,
        created_at: new Date(),
        related_entity_id: payload.id_group,
        notification_type: 'user_joined_group',
      }));

      if (notifications.length > 0) {
        await this.prisma.notification.createMany({
          data: notifications,
        });

        this.logger.log(
          `Created ${notifications.length} notifications for user ${payload.id_user} joining group`,
        );
      }
    } catch (error) {
      this.logger.error('Error handling USER_JOINED_GROUP event:', error);
    }
  }

  /**
   * Escuchar evento de solicitud de conexión enviada
   * Crear notificación para el destinatario
   */
  @OnEvent(MESSAGE_EVENTS.CONNECTION_REQUEST_SENT)
  async handleConnectionRequestSent(payload: ConnectionRequestSentPayload) {
    console.log('👂 [NotificationEventListener] RECEIVED CONNECTION_REQUEST_SENT:', {
      payload,
      timestamp: new Date().toISOString(),
    });

    try {
      this.logger.log(
        `Handling CONNECTION_REQUEST_SENT event for user ${payload.addressee_id}`,
      );

      const notification = await this.prisma.notification.create({
        data: {
          id_user: payload.addressee_id,
          message: `${payload.requester_name} te ha enviado una solicitud de conexión`,
          is_read: false,
          created_at: new Date(),
          related_entity_id: payload.id_connection,
          notification_type: 'connection_request',
        },
      });

      console.log('✅ [NotificationEventListener] NOTIFICATION CREATED:', {
        id_notification: notification.id_notification,
        id_user: notification.id_user,
        related_entity_id: notification.related_entity_id,
        is_read: notification.is_read,
        notification_type: notification.notification_type,
      });

      this.logger.log(
        `Created notification for connection request ${payload.id_connection}`,
      );
    } catch (error) {
      console.error('❌ [NotificationEventListener] NOTIFICATION CREATE FAILED:', {
        error,
        payload,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.logger.error('Error handling CONNECTION_REQUEST_SENT event:', error);
      // Re-lanzar para que sea visible
      throw error;
    }
  }
}
