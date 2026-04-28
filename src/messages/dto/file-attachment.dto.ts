import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class FileAttachmentDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @Min(0)
  size: number;
}
