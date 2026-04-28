import { IsString, IsNotEmpty, IsInt, Min, IsArray, ArrayMinSize } from 'class-validator';

export class ReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;

  @IsInt()
  @Min(1)
  count: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  users: number[];
}
