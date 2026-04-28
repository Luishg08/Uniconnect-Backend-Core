import { IsInt, IsString, IsNotEmpty, Min } from 'class-validator';

export class MentionDto {
  @IsInt()
  @Min(1)
  userId: number;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsInt()
  @Min(0)
  position: number;
}
