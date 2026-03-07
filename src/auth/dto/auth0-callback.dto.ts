import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'PKCE code_verifier used to generate the code_challenge',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
  })
  @IsString()
  @IsNotEmpty()
  code_verifier: string;
}