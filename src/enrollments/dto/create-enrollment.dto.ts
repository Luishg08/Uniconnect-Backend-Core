import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEnrollmentDto {

  @ApiProperty({ example: 1 })
  @IsNumber()
  id_course: number;

  @ApiProperty({ example: 'active', required: false })
  @IsString()
  @IsOptional()
  status?: string;
}