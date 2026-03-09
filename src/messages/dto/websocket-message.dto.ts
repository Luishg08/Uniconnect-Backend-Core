export class SendMessageDto {
  id_membership: number;
  text_content: string;
  attachments?: string;
}

export class MessageEventDto {
  id_message: number;
  id_membership: number;
  text_content: string;
  send_at: Date;
  attachments?: string;
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
