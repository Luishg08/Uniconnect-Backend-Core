import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterFcmTokenDto {
    @ApiProperty({ example: 'dxxxxxxx:APA91bHPRgkFLp...', description: 'Token FCM del dispositivo' })
    @IsString()
    token: string;

    @ApiProperty({ enum: ['android', 'ios'], example: 'android' })
    @IsIn(['android', 'ios'])
    device_type: string;

    @ApiPropertyOptional({ example: 'Samsung Galaxy S24' })
    @IsOptional()
    @IsString()
    device_name?: string;
}
