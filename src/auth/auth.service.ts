import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';
import { PermissionsService } from 'src/permissions/permissions.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private rolesService: RolesService,
        private permissionsService: PermissionsService,
        private configService: ConfigService,
        private httpService: HttpService // Added for Auth0 BFF communication
    ) {
    }

    async googleLogin(accessToken: string) {
        const googleUser = await this.validateGoogleToken(accessToken);
        if (!googleUser || !googleUser.email_verified) {
            throw new UnauthorizedException({
                success: false,
                statusCode: 401,
                message: 'Token de Google inválido o correo no verificado'
            });
        }

        const domain = googleUser.email.split('@')[1]
        if (domain !== 'ucaldas.edu.co') {
            throw new UnauthorizedException({
                success: false,
                statusCode: 401,
                message: 'Dominio de correo no permitido. Solo se permiten correos @ucaldas.edu.co'
            });
        }

        let user = await this.usersService.findByEmail(googleUser.email);

        if (!user) {
            // Asignar rol "student" por defecto a usuarios nuevos
            const studentRole = await this.rolesService.getStudentRole();
            if (!studentRole) {
                throw new Error('Rol "student" no encontrado en la base de datos. Ejecuta el seeder.');
            }
            user = await this.usersService.create({
                email: googleUser.email,
                full_name: googleUser.name,
                picture: googleUser.picture,
                id_role: studentRole.id_role,
                google_sub: googleUser.sub,
            })
        }

        const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);

        const payload = { 
            sub: user.id_user, 
            permissions: permissionsClaims.map(p => p.claim),
            roleName: user.role?.name || 'student' // ⭐ FIX: Include roleName in JWT payload
        };
                
        const jwt = this.jwtService.sign(payload);
        return {
            access_token: jwt,
            user: {
                ...user,
                role: user.role, // ⭐ Asegurar que role esté incluido
            },            
        };
    }

    async validateGoogleToken(accessToken: string) {
        const response =
            await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

        return await response.json();
    }

    async tempLogin(googleSub: string) {
        const user = await this.usersService.findByGoogleSub(googleSub);
        if (!user) {
            throw new UnauthorizedException({
                success: false,
                statusCode: 401,
                message: 'Usuario no encontrado'
            });
        }
        
        const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);

        const payload = { 
            sub: user.id_user, 
            permissions: permissionsClaims.map(p => p.claim),
            roleName: user.role?.name || 'student' // ⭐ FIX: Include roleName in JWT payload
        };
                
        const jwt = this.jwtService.sign(payload);
        return {
            access_token: jwt,
            user: {
                ...user,
                role: user.role, // ⭐ Asegurar que role esté incluido
            },            
        };
    }

    async decodeToken(token: string): Promise<any> {
        return this.jwtService.decode(token);
    }

    async logout(accessToken: string, userId: number) {
        try {
            // 1. Verificar que el token sea válido
            let decoded: any;
            try {
                decoded = this.jwtService.verify(accessToken);
            } catch (error) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'Token inválido o expirado',
                });
            }

            // 2. Verificar que el token pertenezca al usuario que hace logout
            if (decoded.sub !== userId) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'El token no pertenece al usuario autenticado',
                });
            }

            // 3. Verificar si el token ya está en la blacklist
            const existingBlacklist = await this.usersService.findBlacklistedToken(accessToken);
            if (existingBlacklist) {
                return {
                    success: true,
                    data: {
                        message: 'Logout successful',
                    },
                    error: null,
                    metadata: {
                        timestamp: new Date().toISOString(),
                    },
                };
            }

            // 4. Agregar el token a la blacklist
            const expiresAt = new Date(decoded.exp * 1000); // exp está en segundos
            await this.usersService.addTokenToBlacklist(accessToken, userId, expiresAt);

            return {
                success: true,
                data: {
                    message: 'Logout successful',
                },
                error: null,
                metadata: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            console.error('❌ [AuthService.logout] Error:', {
                message: error.message,
                userId,
            });

            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new InternalServerErrorException({
                success: false,
                statusCode: 500,
                message: 'Error al cerrar sesión',
                error: error.message || 'Ocurrió un error desconocido',
            });
        }
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {
        const blacklisted = await this.usersService.findBlacklistedToken(token);
        return !!blacklisted;
    }

    async auth0Callback(authorizationCode: string, redirectUri: string, codeVerifier: string) {
        try {
            const tokenResponse = await this.exchangeAuth0Code(authorizationCode, redirectUri, codeVerifier);
            
            const userProfile = await this.getAuth0UserProfile(tokenResponse.access_token);
            
            if (!userProfile.email || !userProfile.email.endsWith('@ucaldas.edu.co')) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'Dominio de correo no permitido. Solo se permiten correos @ucaldas.edu.co'
                });
            }

            let user = await this.usersService.findByEmail(userProfile.email);

            if (!user) {
                // Asignar rol "student" por defecto a usuarios nuevos
                const studentRole = await this.rolesService.getStudentRole();
                if (!studentRole) {
                    throw new Error('Rol "student" no encontrado en la base de datos. Ejecuta el seeder.');
                }
                
                user = await this.usersService.create({
                    email: userProfile.email,
                    full_name: userProfile.name || userProfile.email,
                    picture: userProfile.picture || null,
                    id_role: studentRole.id_role,
                    google_sub: userProfile.sub, // Auth0 user ID
                });
            }

            const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);
            const payload = { 
                sub: user.id_user, 
                permissions: permissionsClaims.map(p => p.claim),
                auth0_sub: userProfile.sub,
                roleName: user.role?.name || 'student' // ⭐ FIX: Include roleName in JWT payload
            };
            
            const jwt = this.jwtService.sign(payload);

            return {
                success: true,
                statusCode: 200,
                message: 'Authentication successful',
                data: {
                    access_token: jwt,
                    user: {
                        id_user: user.id_user,
                        id_role: user.id_role,
                        role: user.role, // ⭐ INCLUIR OBJETO ROLE COMPLETO
                        full_name: user.full_name,
                        email: user.email,
                        picture: user.picture,
                        id_program: user.id_program ?? null,
                        needsOnboarding: user.id_program === null || user.id_program === undefined,
                    },
                    auth0_tokens: {
                        access_token: tokenResponse.access_token,
                        id_token: tokenResponse.id_token,
                        refresh_token: tokenResponse.refresh_token,
                        expires_in: tokenResponse.expires_in,
                    }
                }
            };

        } catch (error) {
            console.error('Auth0 callback error:', error);
            
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            
            throw new UnauthorizedException({
                success: false,
                statusCode: 401,
                message: 'Autenticación fallida',
                error: error.message || 'Ocurrió un error desconocido'
            });
        }
    }

    private async exchangeAuth0Code(code: string, redirectUri: string, codeVerifier: string) {
        const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
        const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
        const clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');

        if (!auth0Domain || !clientId || !clientSecret) {
            console.error('Auth0 configuration incomplete:', {
                domain: auth0Domain ? '✓ configured' : '✗ missing',
                clientId: clientId ? '✓ configured' : '✗ missing',
                clientSecret: clientSecret ? '✓ configured' : '✗ missing',
            });
            throw new Error('Auth0 configuration is missing in environment variables');
        }

        const tokenUrl = `https://${auth0Domain}/oauth/token`;
        
        
        const requestBody = {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        };

        try {
            
            const response = await firstValueFrom(
                this.httpService.post(tokenUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 15000,
                })
            );

            
            return response.data;
        } catch (error: any) {
            console.error('Auth0 token exchange error:', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                syscall: error.syscall,
                hostname: error.hostname,
                status: error.response?.status,
                statusText: error.response?.statusText,
                auth0Response: error.response?.data,
            });
            throw new Error(`Failed to exchange authorization code for tokens: ${error.code || error.message}`);
        }
    }


    private async getAuth0UserProfile(accessToken: string) {
        const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
        
        if (!auth0Domain) {
            throw new Error('Auth0 domain is missing in environment variables');
        }

        const userInfoUrl = `https://${auth0Domain}/userinfo`;

        try {
            const response = await firstValueFrom(
                this.httpService.get(userInfoUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                })
            );

            return response.data;
        } catch (error) {
            console.error('Auth0 user profile error:', error.response?.data || error.message);
            throw new Error('Failed to get user profile from Auth0');
        }
    }

    async refreshAuth0Token(refreshToken: string, userId: number) {
        try {
            const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
            const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
            const clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');

            if (!auth0Domain || !clientId || !clientSecret) {
                throw new Error('Auth0 configuration is missing in environment variables');
            }

            const response = await firstValueFrom(
                this.httpService.post(`https://${auth0Domain}/oauth/token`, {
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            const tokenData = response.data;

            const user = await this.usersService.findById(userId);
            if (!user) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'Usuario no encontrado'
                });
            }

            const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);
            const payload = { 
                sub: user.id_user, 
                permissions: permissionsClaims.map(p => p.claim),
                auth0_sub: user.google_sub,
                roleName: user.role?.name || 'student' // ⭐ FIX: Include roleName in JWT payload
            };
            
            const jwt = this.jwtService.sign(payload);

            return {
                success: true,
                statusCode: 200,
                message: 'Token refreshed successfully',
                data: {
                    access_token: jwt,
                    user: {
                        id_user: user.id_user,
                        id_role: user.id_role,
                        role: user.role, // ⭐ INCLUIR OBJETO ROLE COMPLETO
                        full_name: user.full_name,
                        email: user.email,
                        picture: user.picture,
                        id_program: user.id_program ?? null,
                        needsOnboarding: user.id_program === null || user.id_program === undefined,
                    },
                    auth0_tokens: {
                        access_token: tokenData.access_token,
                        id_token: tokenData.id_token,
                        refresh_token: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
                        expires_in: tokenData.expires_in,
                    }
                }
            };

        } catch (error) {
            console.error('Error refrescando token en Auth0:', error.response?.data || error.message);
            
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            
            throw new InternalServerErrorException({
                success: false,
                statusCode: 500,
                message: 'No se pudo refrescar la sesión',
                error: error.message || 'Unknown error occurred'
            });
        }
    }
}