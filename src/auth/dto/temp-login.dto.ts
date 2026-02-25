import { IsString } from 'class-validator';

export class TempLoginDto {
  @IsString()
  googleSub: string;
}