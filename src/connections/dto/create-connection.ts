import { IsInt } from 'class-validator';

export class CreateConnectionDto {
  @IsInt()
  addressee_id: number;
}