import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';
import { PermissionsService } from 'src/permissions/permissions.service';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private rolesService: RolesService,
        private permissionsService: PermissionsService
    ) { }

    async googleLogin(accessToken: string) {
        const googleUser = await this.validateGoogleToken(accessToken);
        if (!googleUser || !googleUser.email_verified) {
            return {
                success: false,
                statusCode: 401,
                message: 'Invalid Google token or email not verified'
            }
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
                id_role: userRole.id_role
            })
        }

        const permissionsClaims = await this.permissionsService.getClaimsForRole(user.id_role);

        const jwt = this.jwtService.sign({ sub: user.id_user, permissions: permissionsClaims.map(p => p.claim) });

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

}
