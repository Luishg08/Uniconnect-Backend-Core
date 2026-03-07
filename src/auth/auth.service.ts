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
                message: 'Invalid Google token or email not verified'
            });
        }

        const domain = googleUser.email.split('@')[1]
        if (domain !== 'ucaldas.edu.co') {
            throw new UnauthorizedException({
                success: false,
                statusCode: 401,
                message: 'Email domain not allowed'
            });
        }

        let user = await this.usersService.findByEmail(googleUser.email);

        if (!user) {
            const userRole = await this.rolesService.getUserRole();
            if (!userRole) {
                throw new Error('User role not found');
            }
            user = await this.usersService.create({
                email: googleUser.email,
                full_name: googleUser.name,
                picture: googleUser.picture,
                id_role: userRole.id_role,
                google_sub: googleUser.sub,
            })
        }

        const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);

        const payload = { sub: user.id_user, permissions: permissionsClaims.map(p => p.claim) };
                
        const jwt = this.jwtService.sign(payload);
        return {
            access_token: jwt,
            user,            
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
                message: 'User not found'
            });
        }
        
        const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);

        const payload = { sub: user.id_user, permissions: permissionsClaims.map(p => p.claim) };
                
        const jwt = this.jwtService.sign(payload);
        return {
            access_token: jwt,
            user,            
        };
    }

    async decodeToken(token: string): Promise<any> {
        return this.jwtService.decode(token);
    }

    async auth0Callback(authorizationCode: string, redirectUri: string, codeVerifier: string) {
        try {
            const tokenResponse = await this.exchangeAuth0Code(authorizationCode, redirectUri, codeVerifier);
            
            const userProfile = await this.getAuth0UserProfile(tokenResponse.access_token);
            
            if (!userProfile.email || !userProfile.email.endsWith('@ucaldas.edu.co')) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'Email domain not allowed. Only @ucaldas.edu.co emails are permitted.'
                });
            }

            let user = await this.usersService.findByEmail(userProfile.email);

            if (!user) {
                const userRole = await this.rolesService.getUserRole();
                if (!userRole) {
                    throw new Error('User role not found');
                }
                
                user = await this.usersService.create({
                    email: userProfile.email,
                    full_name: userProfile.name || userProfile.email,
                    picture: userProfile.picture || null,
                    id_role: userRole.id_role,
                    google_sub: userProfile.sub, // Auth0 user ID
                });
            }

            const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);
            const payload = { 
                sub: user.id_user, 
                permissions: permissionsClaims.map(p => p.claim),
                auth0_sub: userProfile.sub 
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
                        full_name: user.full_name,
                        email: user.email,
                        picture: user.picture,
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
                message: 'Authentication failed',
                error: error.message || 'Unknown error occurred'
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
        console.log(`Exchanging Auth0 code at: ${tokenUrl}`);
        
        const requestBody = {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        };

        try {
            console.log('Sending request to Auth0...');
            const response = await firstValueFrom(
                this.httpService.post(tokenUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 15000,
                })
            );

            console.log('Auth0 token exchange successful');
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
                    message: 'User not found'
                });
            }

            const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);
            const payload = { 
                sub: user.id_user, 
                permissions: permissionsClaims.map(p => p.claim),
                auth0_sub: user.google_sub 
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
                        full_name: user.full_name,
                        email: user.email,
                        picture: user.picture,
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