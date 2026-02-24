import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateProgramDto {
  @ApiProperty({ example: 'Ingeniería de Sistemas', description: 'Nombre del programa académico' })
  @IsString()
  name: string;
}