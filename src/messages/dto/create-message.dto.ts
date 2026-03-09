export class CreateMessageDto {
  id_membership: number;
  text_content: string;
  attachments?: string; // URL o JSON con datos del archivo
  send_at?: Date;
}
