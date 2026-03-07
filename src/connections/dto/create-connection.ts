import { IsInt } from 'class-validator';

export class CreateConnectionDto {
  @IsInt()
  adressee_id: number;
}