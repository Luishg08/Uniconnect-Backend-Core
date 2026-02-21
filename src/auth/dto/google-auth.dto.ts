import { IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  access_token: string;
}