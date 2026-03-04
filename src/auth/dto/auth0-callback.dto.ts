import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Auth0 Authorization Code Exchange
 * TSK-3.1: BFF Endpoint Implementation
 */
export class Auth0CallbackDto {
  @ApiProperty({
    description: 'Authorization code received from Auth0 Universal Login',
    example: 'abc123def456ghi789'
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Redirect URI used in the Auth0 authorization request',
    example: 'exp://localhost:8081/--/auth/callback'
  })
  @IsString()
  @IsNotEmpty()
  redirect_uri: string;
}