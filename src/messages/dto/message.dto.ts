import { IsString, IsBoolean, IsOptional, IsNumber, IsDate, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MentionDto } from './mention.dto';
import { FileAttachmentDto } from './file-attachment.dto';
import { ReactionDto } from './reaction.dto';

/**
 * Data Transfer Object for chat messages.
 * Contains all necessary fields for message processing and emission.
 * chat_type and room_id are computed fields, not required on input.
 */
export class MessageDto {
  @IsOptional()
  @IsNumber()
  id_message?: number;

  @IsOptional()
  @IsNumber()
  id_membership?: number;

  @IsOptional()
  @IsNumber()
  sender_id?: number;

  @IsOptional()
  @IsNumber()
  recipient_id?: number;

  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  send_at?: Date;

  @IsOptional()
  @IsString()
  attachments?: string;

  @IsOptional()
  @IsBoolean()
  is_edited?: boolean;

  // Computed fields (set by enrichMessageWithRoomInfo)
  @IsOptional()
  @IsIn(['private', 'group'])
  chat_type?: 'private' | 'group';

  @IsOptional()
  @IsString()
  room_id?: string;

  // Decorator metadata (set by applyDecorators)
  @IsOptional()
  @IsString({ each: true })
  decorators_applied?: string[];

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  processed_at?: Date;

  // Decorator pattern fields
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionDto)
  mentions?: MentionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileAttachmentDto)
  files?: FileAttachmentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReactionDto)
  reactions?: ReactionDto[];

  @IsOptional()
  @IsString()
  rendered_content?: string;
}
