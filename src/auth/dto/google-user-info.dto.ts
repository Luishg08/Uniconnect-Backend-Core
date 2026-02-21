import { IsBoolean, IsString } from 'class-validator';

export class GoogleUserInfoDto {
    @IsString()
    sub: string;

    @IsString()
    name: string;

    @IsString()
    given_name: string;

    @IsString()
    family_name: string;

    @IsString()
    picture: string;

    @IsString()
    email: string;

    @IsBoolean()
    email_verified: boolean;
}