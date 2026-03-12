export class CreateMessageDto {
  id_membership: number;
  text_content?: string;

  send_at?: Date;

  attachments?: string | null;

  files?: Array<{
    url: string;
    file_name: string;
    mime_type: string;
    size: number;
    id_group: number;
  }>;
}

