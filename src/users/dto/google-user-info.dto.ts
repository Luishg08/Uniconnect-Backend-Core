import { IsOptional, IsString } from 'class-validator';

    export class ProfileUpdateDto {
    @IsString()
    @IsOptional()
    current_semester?: string | null;

    @IsString()
    @IsOptional()
    image?: string | null;

    @IsString()
    @IsOptional()
    phone?: string | null;
}