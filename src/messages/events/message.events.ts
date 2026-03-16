/**
 * Eventos del sistema de mensajería
 * Patrones: Observer Pattern y Event-Driven Architecture
 */
export const MESSAGE_EVENTS = {
  // Eventos de mensajes
  MESSAGE_SENT: 'message.sent',
  MESSAGE_EDITED: 'message.edited',
  MESSAGE_DELETED: 'message.deleted',

  // Eventos de usuarios
  USER_JOINED_GROUP: 'user.joined.group',
  USER_LEFT_GROUP: 'user.left.group',
  USER_TYPING: 'user.typing',
  USER_ONLINE: 'user.online',
  USER_OFFLINE: 'user.offline',

  // Eventos de grupos
  GROUP_CREATED: 'group.created',
  GROUP_UPDATED: 'group.updated',
  GROUP_DELETED: 'group.deleted',

  // Eventos de invitaciones
  GROUP_INVITATION_SENT: 'group.invitation.sent',
  GROUP_INVITATION_ACCEPTED: 'group.invitation.accepted',
  GROUP_INVITATION_REJECTED: 'group.invitation.rejected',

  // Eventos de solicitudes de unión a grupos
  GROUP_JOIN_REQUEST_SENT: 'group.join_request.sent',
  GROUP_JOIN_REQUEST_ACCEPTED: 'group.join_request.accepted',
  GROUP_JOIN_REQUEST_REJECTED: 'group.join_request.rejected',

  // Eventos de conexiones
  CONNECTION_REQUEST_SENT: 'connection.request.sent',
  CONNECTION_REQUEST_ACCEPTED: 'connection.request.accepted',
  CONNECTION_REQUEST_REJECTED: 'connection.request.rejected',
} as const;

/**
 * Tipo para eventos del sistema
 */
export type MessageEvent = typeof MESSAGE_EVENTS[keyof typeof MESSAGE_EVENTS];

/**
 * Payloads para cada evento
 */
export interface MessageSentPayload {
  id_message: number;
  id_group: number;
  id_user: number;
  text_content: string;
  send_at: Date;
  sender_name: string;
  sender_picture: string | null;
}

export interface MessageEditedPayload {
  id_message: number;
  id_group: number;
  id_user: number;
  text_content: string;
  edited_at: Date;
  sender_name: string;
  sender_picture: string | null;
}

export interface MessageDeletedPayload {
  id_message: number;
  id_group: number;
  id_user: number;
  deleted_at: Date;
}

export interface UserJoinedGroupPayload {
  id_user: number;
  id_group: number;
  full_name: string;
  joined_at: Date;
}

export interface UserLeftGroupPayload {
  id_user: number;
  id_group: number;
  full_name: string;
  left_at: Date;
}

export interface GroupInvitationSentPayload {
  id_invitation: number;
  id_group: number;
  group_name: string;
  inviter_id: number;
  inviter_name: string;
  invitee_id: number;
  invited_at: Date;
}

export interface GroupInvitationAcceptedPayload {
  id_invitation: number;
  id_group: number;
  group_name: string;
  invitee_id: number;
  invitee_name: string;
  accepted_at: Date;
}

export interface ConnectionRequestSentPayload {
  id_connection: number;
  requester_id: number;
  requester_name: string;
  requester_picture?: string;
  addressee_id: number;
  sent_at: Date;
}

export interface GroupJoinRequestSentPayload {
  id_request: number;
  id_group: number;
  group_name: string;
  owner_id: number;
  requester_id: number;
  requester_name: string;
  requester_picture?: string | null;
  requested_at: Date;
}

export interface GroupJoinRequestAcceptedPayload {
  id_request: number;
  id_group: number;
  group_name: string;
  requester_id: number;
  requester_name: string;
  responded_at: Date;
}

export interface GroupJoinRequestRejectedPayload {
  id_request: number;
  id_group: number;
  group_name: string;
  requester_id: number;
  responded_at: Date;
}
