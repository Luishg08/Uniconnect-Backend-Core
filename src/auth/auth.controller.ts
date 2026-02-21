import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-auth.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
   
    @Post('google')
    async googleLogin(@Body() dto: GoogleLoginDto){
        return this.authService.googleLogin(dto.access_token);
    }

}
