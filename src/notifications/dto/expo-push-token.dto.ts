import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ExpoPushTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;
}
