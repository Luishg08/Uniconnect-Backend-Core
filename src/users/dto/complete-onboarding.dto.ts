import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CompleteOnboardingDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  id_program: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  current_semester: number;
}
