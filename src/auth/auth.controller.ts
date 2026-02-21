import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
   
    @Post('google')
    //@UseGuards(JwtAuthGuard) Se usó para test de cabecera de autenticación
    async googleLogin(@Body() dto: GoogleLoginDto){
        return this.authService.googleLogin(dto.access_token);
    }

}
