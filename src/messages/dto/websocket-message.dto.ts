export class FileDto {
  id_file: number;
  url: string;
  file_name: string;
  mime_type: string;
  size?: number | null;
  created_at?: Date | null;
}

export class SendMessageDto {
  id_membership: number;
  text_content?: string;
  attachments?: string | null;
}

export class MessageEventDto {
  id_message: number;
  id_membership: number;
  text_content?: string;
  send_at: Date;
  attachments?: string | null;

  files?: FileDto[];

  sender_name: string;
  sender_picture: string | null;

  user: {
    id_user: number;
    full_name: string;
    picture?: string;
  };
  group: {
    id_group: number;
    name: string;
  };
}

/**
 * DTO para evento de lectura de mensaje
 * Usado en el patrón Observer para notificar cuando un mensaje es leído
 */
export class MessageReadDto {
  id_message: number;
  id_user: number;
  read_at: Date;
}

/**
 * DTO para evento de presencia de usuario
 * Usado en el patrón Observer para broadcast de estado de presencia
 */
export class UserPresenceDto {
  id_user: number;
  status: 'online' | 'offline' | 'away';
  last_seen?: Date;
}

/**
 * DTO para evento de actividad de grupo
 * Usado en el patrón Observer para notificar actividades del grupo
 */
export class GroupActivityDto {
  id_group: number;
  activity_type: 'member_joined' | 'member_left' | 'group_updated';
  actor_id: number;
  actor_name: string;
  timestamp: Date;
}