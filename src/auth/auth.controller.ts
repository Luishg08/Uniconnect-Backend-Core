import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequireAll, RequireAny } from './decorators/permissions.decorator';
import { PermissionsGuard } from './guards/permissions.guard';

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

}
