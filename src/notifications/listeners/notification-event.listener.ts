import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import { MESSAGE_EVENTS } from '../../messages/events/message.events';
import type {
  MessageSentPayload,
  GroupInvitationSentPayload,
  GroupInvitationAcceptedPayload,
  UserJoinedGroupPayload,
  ConnectionRequestSentPayload,
  GroupJoinRequestSentPayload,
  GroupJoinRequestAcceptedPayload,
  GroupJoinRequestRejectedPayload,
} from '../../messages/events/message.events';

/**
 * Patrón Observer: escucha eventos del sistema (Sprint 3) y delega el envío
 * al NotificationsService que aplica el patrón Strategy por canal.
 */
@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent(MESSAGE_EVENTS.MESSAGE_SENT)
  async handleMessageSent(payload: MessageSentPayload) {
    try {
      const members = await this.prisma.membership.findMany({
        where: {
          id_group: payload.id_group,
          id_user: { not: payload.id_user },
        },
        include: { group: { select: { name: true } } },
      });

      await Promise.all(
        members.map((member) =>
          this.notificationsService.enviarNotificacion({
            id_user: member.id_user!,
            mensaje: `Nuevo mensaje en ${member.group?.name || 'el grupo'}`,
            tipo_evento: 'message',
            entidad_relacionada_id: payload.id_message,
          }),
        ),
      );

      this.logger.log(
        `MESSAGE_SENT: notificaciones enviadas a ${members.length} miembro(s) del grupo ${payload.id_group}`,
      );
    } catch (error) {
      this.logger.error('Error handling MESSAGE_SENT event:', error);
    }
  }

  @OnEvent(MESSAGE_EVENTS.GROUP_INVITATION_SENT)
  async handleGroupInvitationSent(payload: GroupInvitationSentPayload) {
    try {
      await this.notificationsService.enviarNotificacion({
        id_user: payload.invitee_id,
        mensaje: `${payload.inviter_name} te invitó a unirte al grupo "${payload.group_name}"`,
        tipo_evento: 'group_invitation',
        entidad_relacionada_id: payload.id_invitation,
      });
    } catch (error) {
      this.logger.error('Error handling GROUP_INVITATION_SENT event:', error);
    }
  }

  @OnEvent(MESSAGE_EVENTS.GROUP_INVITATION_ACCEPTED)
  async handleGroupInvitationAccepted(payload: GroupInvitationAcceptedPayload) {
    try {
      const invitation = await this.prisma.group_invitation.findUnique({
        where: { id_invitation: payload.id_invitation },
        select: { inviter_id: true },
      });

      if (invitation) {
        await this.notificationsService.enviarNotificacion({
          id_user: invitation.inviter_id,
          mensaje: `${payload.invitee_name} aceptó tu invitación al grupo "${payload.group_name}"`,
          tipo_evento: 'group_invitation_accepted',
          entidad_relacionada_id: payload.id_invitation,
        });
      }
    } catch (error) {
      this.logger.error('Error handling GROUP_INVITATION_ACCEPTED event:', error);
    }
  }

  @OnEvent(MESSAGE_EVENTS.USER_JOINED_GROUP)
  async handleUserJoinedGroup(payload: UserJoinedGroupPayload) {
    try {
      const members = await this.prisma.membership.findMany({
        where: {
          id_group: payload.id_group,
          id_user: { not: payload.id_user },
        },
        include: { group: { select: { name: true } } },
      });

      await Promise.all(
        members.map((member) =>
          this.notificationsService.enviarNotificacion({
            id_user: member.id_user!,
            mensaje: `${payload.full_name} se unió al grupo ${member.group?.name || 'el grupo'}`,
            tipo_evento: 'user_joined_group',
            entidad_relacionada_id: payload.id_group,
          }),
        ),
      );

      this.logger.log(
        `USER_JOINED_GROUP: notificaciones enviadas a ${members.length} miembro(s)`,
      );
    } catch (error) {
      this.logger.error('Error handling USER_JOINED_GROUP event:', error);
    }
  }

  @OnEvent(MESSAGE_EVENTS.CONNECTION_REQUEST_SENT)
  async handleConnectionRequestSent(payload: ConnectionRequestSentPayload) {
    try {
      await this.notificationsService.enviarNotificacion({
        id_user: payload.addressee_id,
        mensaje: `${payload.requester_name} te ha enviado una solicitud de conexión`,
        tipo_evento: 'connection_request',
        entidad_relacionada_id: payload.id_connection,
      });

      this.logger.log(
        `Created notification for connection request ${payload.id_connection}`,
      );
    } catch (error) {
      this.logger.error('Error handling CONNECTION_REQUEST_SENT event:', error);
      throw error;
    }
  }

  /**
   * Escuchar evento de solicitud de unión a grupo enviada
   * Notifica al OWNER del grupo que alguien quiere unirse
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_SENT)
  async handleGroupJoinRequestSent(payload: GroupJoinRequestSentPayload) {
    try {
      this.logger.log(
        `Handling GROUP_JOIN_REQUEST_SENT event: user ${payload.requester_id} → group ${payload.id_group}`,
      );

      await this.notificationsService.enviarNotificacion({
        id_user: payload.owner_id,
        mensaje: `${payload.requester_name} quiere unirse a tu grupo "${payload.group_name}"`,
        tipo_evento: 'group_join_request',
        entidad_relacionada_id: payload.id_request,
      });

      this.logger.log(
        `Created join-request notification for owner ${payload.owner_id}`,
      );
    } catch (error) {
      this.logger.error('Error handling GROUP_JOIN_REQUEST_SENT event:', error);
    }
  }

  /**
   * Escuchar evento de solicitud de unión aceptada
   * Notifica al REQUESTER que fue aceptado en el grupo
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_ACCEPTED)
  async handleGroupJoinRequestAccepted(payload: GroupJoinRequestAcceptedPayload) {
    try {
      this.logger.log(
        `Handling GROUP_JOIN_REQUEST_ACCEPTED event for request ${payload.id_request}`,
      );

      await this.notificationsService.enviarNotificacion({
        id_user: payload.requester_id,
        mensaje: `Tu solicitud para unirte al grupo "${payload.group_name}" fue aceptada`,
        tipo_evento: 'group_join_request_accepted',
        entidad_relacionada_id: payload.id_request,
      });

      this.logger.log(
        `Created accepted notification for requester ${payload.requester_id}`,
      );
    } catch (error) {
      this.logger.error('Error handling GROUP_JOIN_REQUEST_ACCEPTED event:', error);
    }
  }

  /**
   * Escuchar evento de solicitud de unión rechazada
   * Notifica al REQUESTER que fue rechazado
   */
  @OnEvent(MESSAGE_EVENTS.GROUP_JOIN_REQUEST_REJECTED)
  async handleGroupJoinRequestRejected(payload: GroupJoinRequestRejectedPayload) {
    try {
      this.logger.log(
        `Handling GROUP_JOIN_REQUEST_REJECTED event for request ${payload.id_request}`,
      );

      await this.notificationsService.enviarNotificacion({
        id_user: payload.requester_id,
        mensaje: `Tu solicitud para unirte al grupo "${payload.group_name}" fue rechazada`,
        tipo_evento: 'group_join_request_rejected',
        entidad_relacionada_id: payload.id_request,
      });

      this.logger.log(
        `Created rejected notification for requester ${payload.requester_id}`,
      );
    } catch (error) {
      this.logger.error('Error handling GROUP_JOIN_REQUEST_REJECTED event:', error);
    }
  }
}
