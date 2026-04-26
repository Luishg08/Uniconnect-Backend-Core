import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Grupo de Estudio Cálculo III', description: 'Nombre del grupo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Repaso para el parcial final', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 1, description: 'ID de la materia (course)' })
  @IsInt()
  @IsNotEmpty()
  id_course: number;
}