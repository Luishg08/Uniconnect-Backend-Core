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