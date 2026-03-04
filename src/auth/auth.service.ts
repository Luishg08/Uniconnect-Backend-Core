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

    /**
     * TSK-3.1: Auth0 BFF Integration
     * Exchange authorization code for Auth0 tokens and user profile
     */
    async auth0Callback(authorizationCode: string, redirectUri: string) {
        try {
            // Step 1: Exchange authorization code for tokens
            const tokenResponse = await this.exchangeAuth0Code(authorizationCode, redirectUri);
            
            // Step 2: Get user profile from Auth0
            const userProfile = await this.getAuth0UserProfile(tokenResponse.access_token);
            
            // Step 3: Validate email domain (ucaldas.edu.co)
            if (!userProfile.email || !userProfile.email.endsWith('@ucaldas.edu.co')) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'Email domain not allowed. Only @ucaldas.edu.co emails are permitted.'
                });
            }

            // Step 4: Find or create user in local database
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

            // Step 5: Generate local JWT with permissions
            const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);
            const payload = { 
                sub: user.id_user, 
                permissions: permissionsClaims.map(p => p.claim),
                auth0_sub: userProfile.sub 
            };
            
            const jwt = this.jwtService.sign(payload);

            // Step 6: Return FEN-formatted response
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

    /**
     * Exchange authorization code for Auth0 tokens
     */
    private async exchangeAuth0Code(code: string, redirectUri: string) {
        const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
        const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
        const clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');

        if (!auth0Domain || !clientId || !clientSecret) {
            throw new Error('Auth0 configuration is missing in environment variables');
        }

        const tokenUrl = `https://${auth0Domain}/oauth/token`;
        
        const requestBody = {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
        };

        try {
            const response = await firstValueFrom(
                this.httpService.post(tokenUrl, requestBody, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            return response.data;
        } catch (error) {
            console.error('Auth0 token exchange error:', error.response?.data || error.message);
            throw new Error('Failed to exchange authorization code for tokens');
        }
    }

    /**
     * Get user profile from Auth0 using access token
     */
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

    /**
     * TSK-4.2: Refresh Auth0 Token
     * Exchanges a refresh token for new Auth0 tokens and updates local JWT
     */
    async refreshAuth0Token(refreshToken: string, userId: number) {
        try {
            const auth0Domain = this.configService.get<string>('AUTH0_DOMAIN');
            const clientId = this.configService.get<string>('AUTH0_CLIENT_ID');
            const clientSecret = this.configService.get<string>('AUTH0_CLIENT_SECRET');

            if (!auth0Domain || !clientId || !clientSecret) {
                throw new Error('Auth0 configuration is missing in environment variables');
            }

            // Step 1: Exchange refresh token for new tokens with Auth0
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

            // Step 2: Get user from local database
            const user = await this.usersService.findById(userId);
            if (!user) {
                throw new UnauthorizedException({
                    success: false,
                    statusCode: 401,
                    message: 'User not found'
                });
            }

            // Step 3: Generate new local JWT with permissions
            const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);
            const payload = { 
                sub: user.id_user, 
                permissions: permissionsClaims.map(p => p.claim),
                auth0_sub: user.google_sub 
            };
            
            const jwt = this.jwtService.sign(payload);

            // Step 4: Return FEN-formatted response
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