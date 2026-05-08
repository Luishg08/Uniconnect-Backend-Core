import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

export class PreferenciaCanalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tipo_evento: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  canal: string;

  @IsBoolean()
  activo: boolean;
}
