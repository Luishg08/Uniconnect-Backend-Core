import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token received from Auth0',
    example: 'refresh_token_string_here'
  })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @ApiProperty({
    description: 'User ID for token validation',
    example: 1
  })
  @IsNumber()
  user_id: number;
}