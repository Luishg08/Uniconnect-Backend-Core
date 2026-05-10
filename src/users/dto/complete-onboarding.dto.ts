import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class CompleteOnboardingDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  id_program: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  current_semester: number;
}
