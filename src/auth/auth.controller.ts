import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { Auth0CallbackDto } from './dto/auth0-callback.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetClaim } from './decorators/get-token-claim.decorator';
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

    @Post('callback')
    @ApiOperation({ 
        summary: 'Auth0 Authorization Code Exchange (BFF)',
        description: 'Exchanges Auth0 authorization code for tokens and returns user profile in FEN format. This is the BFF endpoint that handles the secure token exchange with Auth0.'
    })
    @ApiBody({ 
        type: Auth0CallbackDto,
        description: 'Authorization code, redirect URI, and PKCE code_verifier from Auth0 Universal Login'
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
                message: 'Dominio de correo no permitido. Solo se permiten correos @ucaldas.edu.co',
                error: 'Unauthorized'
            }
        }
    })
    async auth0Callback(@Body() dto: Auth0CallbackDto) {
        return this.authService.auth0Callback(dto.code, dto.redirect_uri, dto.code_verifier);
    }

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
                message: 'Usuario no encontrado',
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

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ 
        summary: 'Logout - Invalidate JWT Token',
        description: 'Invalidates the current JWT token by adding it to a blacklist. The token will no longer be valid for authentication.'
    })
    @ApiBody({ 
        type: LogoutDto,
        description: 'JWT access token to invalidate'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Logout successful - Token invalidated',
        schema: {
            example: {
                success: true,
                data: {
                    message: 'Logout successful'
                },
                error: null,
                metadata: {
                    timestamp: '2024-01-01T00:00:00.000Z'
                }
            }
        }
    })
    @ApiResponse({ 
        status: 401, 
        description: 'Unauthorized - Invalid token or token does not belong to user',
        schema: {
            example: {
                success: false,
                statusCode: 401,
                message: 'Token inválido o expirado',
                error: 'Unauthorized'
            }
        }
    })
    @ApiResponse({ 
        status: 500, 
        description: 'Internal server error',
        schema: {
            example: {
                success: false,
                statusCode: 500,
                message: 'Error al cerrar sesión',
                error: 'Internal Server Error'
            }
        }
    })
    async logout(
        @Body() dto: LogoutDto,
        @GetClaim('sub') userId: number,
    ) {
        return this.authService.logout(dto.access_token, userId);
    }
}
