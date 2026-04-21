import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        configService: ConfigService,
        private usersService: UsersService,
    ){
        const secret = configService.get<string>('JWT_SECRET') || 'uniconnect-test-key';        
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
            passReqToCallback: true, // ⭐ Permite acceder al request en validate()
        });
    }

    async validate(request: Request, payload: any){
        // Extraer el token del header
        const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
        
        if (token) {
            // Verificar si el token está en la blacklist
            const isBlacklisted = await this.usersService.findBlacklistedToken(token);
            
            if (isBlacklisted) {
                throw new UnauthorizedException('Token has been revoked');
            }
        }
        
        return payload;
    }
}