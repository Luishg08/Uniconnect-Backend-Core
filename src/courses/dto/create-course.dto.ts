import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'Ingeniería de Software III', description: 'Nombre de la materia' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1, description: 'ID del programa al que pertenece', required: false })
  @IsNumber()
  @IsOptional()
  id_program?: number;
}