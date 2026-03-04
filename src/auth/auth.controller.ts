import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { Auth0CallbackDto } from './dto/auth0-callback.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequireAll, RequireAny } from './decorators/permissions.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import { TempLoginDto } from './dto/temp-login.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
   
    @Post('google')
    //@UseGuards(JwtAuthGuard, PermissionsGuard) Ejemplo de uso de guardian para token y permiso
    //@RequireAll('GC', 'GD') // Ejemplo de uso para requerir uno o todos los permisos definidos en parámetros
    //@RequireAny('GC', 'GD') // Ejemplo de uso para requerir al menos uno de los permisos definidos en parámetros
    async googleLogin(@Body() dto: GoogleLoginDto){
        return this.authService.googleLogin(dto.access_token);
    }

    @Post('temp-login')
    async tempLogin(@Body() dto: TempLoginDto){
        return this.authService.tempLogin(dto.googleSub);
    }

    /**
     * TSK-3.1: Auth0 BFF Endpoint
     * Receives authorization code from frontend and exchanges it for tokens
     * Returns user profile in FEN format
     */
    @Post('callback')
    @ApiOperation({ 
        summary: 'Auth0 Authorization Code Exchange (BFF)',
        description: 'Exchanges Auth0 authorization code for tokens and returns user profile in FEN format. This is the BFF endpoint that handles the secure token exchange with Auth0.'
    })
    @ApiBody({ 
        type: Auth0CallbackDto,
        description: 'Authorization code and redirect URI from Auth0 Universal Login'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Authentication successful - Returns FEN formatted response with user profile and tokens',
        schema: {
            example: {
                success: true,
                statusCode: 200,
                message: 'Authentication successful',
                data: {
                    access_token: 'jwt-token-here',
                    user: {
                        id_user: 1,
                        id_role: 2,
                        full_name: 'John Doe',
                        email: 'john.doe@ucaldas.edu.co',
                        picture: 'https://example.com/avatar.jpg'
                    },
                    auth0_tokens: {
                        access_token: 'auth0-access-token',
                        id_token: 'auth0-id-token',
                        refresh_token: 'auth0-refresh-token',
                        expires_in: 3600
                    }
                }
            }
        }
    })
    @ApiResponse({ 
        status: 401, 
        description: 'Authentication failed - Invalid code, unauthorized domain, or Auth0 error',
        schema: {
            example: {
                success: false,
                statusCode: 401,
                message: 'Email domain not allowed. Only @ucaldas.edu.co emails are permitted.',
                error: 'Unauthorized'
            }
        }
    })
    async auth0Callback(@Body() dto: Auth0CallbackDto) {
        return this.authService.auth0Callback(dto.code, dto.redirect_uri);
    }

    /**
     * TSK-4.2: Auth0 Refresh Token Endpoint
     * Exchanges refresh token for new Auth0 tokens and local JWT
     * Returns updated user session in FEN format
     */
    @Post('refresh')
    @ApiOperation({ 
        summary: 'Refresh Auth0 Tokens (BFF)',
        description: 'Exchanges Auth0 refresh token for new tokens and generates updated local JWT. Maintains user session without re-authentication.'
    })
    @ApiBody({ 
        type: RefreshTokenDto,
        description: 'Refresh token and user ID for token renewal'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Token refresh successful - Returns FEN formatted response with new tokens',
        schema: {
            example: {
                success: true,
                statusCode: 200,
                message: 'Token refreshed successfully',
                data: {
                    access_token: 'new-jwt-token-here',
                    user: {
                        id_user: 1,
                        id_role: 2,
                        full_name: 'John Doe',
                        email: 'john.doe@ucaldas.edu.co',
                        picture: 'https://example.com/avatar.jpg'
                    },
                    auth0_tokens: {
                        access_token: 'new-auth0-access-token',
                        id_token: 'new-auth0-id-token',
                        refresh_token: 'auth0-refresh-token',
                        expires_in: 3600
                    }
                }
            }
        }
    })
    @ApiResponse({ 
        status: 401, 
        description: 'Token refresh failed - Invalid refresh token or user not found',
        schema: {
            example: {
                success: false,
                statusCode: 401,
                message: 'User not found',
                error: 'Unauthorized'
            }
        }
    })
    @ApiResponse({ 
        status: 500, 
        description: 'Internal server error - Auth0 service unavailable',
        schema: {
            example: {
                success: false,
                statusCode: 500,
                message: 'No se pudo refrescar la sesión',
                error: 'Internal Server Error'
            }
        }
    })
    async refreshToken(@Body() dto: RefreshTokenDto) {
        return this.authService.refreshAuth0Token(dto.refresh_token, dto.user_id);
    }
}
