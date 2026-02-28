import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';
import { ProfileUpdateDto } from './dto/google-user-info.dto';

@ApiTags('Users')
@ApiBearerAuth()  
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @UseGuards(JwtAuthGuard)
    @Get()
    @ApiOperation({ 
        summary: 'HU-03: Visualizar y filtrar estudiantes', 
        description: 'Filtra estudiantes por nombre, programa académico o materia específica.' 
    })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Nombre del estudiante o de la materia' })
    @ApiQuery({ name: 'id_program', required: false, type: Number, description: 'ID del programa académico' })
    @ApiQuery({ name: 'id_course', required: false, type: Number, description: 'ID de la materia específica' })
    async findAll(
        @Query('search') search?: string,
        @Query('id_program') id_program?: string,
        @Query('id_course') id_course?: string,
        @GetClaim('sub') userId?: number
    ) {
        return this.usersService.findAll({
            search,
            id_program: id_program ? Number(id_program) : undefined,
            id_course: id_course ? Number(id_course) : undefined,
            userId,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getProfile(@GetClaim('sub') userId: number) {
        return this.usersService.getProfile(userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile/:id')
    async getOtherProfile(@GetClaim('sub') userId: number, @Param('id') profileId: number) {
        return this.usersService.getOtherProfile(userId, profileId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    async updateProfile(@GetClaim('sub') userId: number, @Body() dto: ProfileUpdateDto) {
        return this.usersService.updateProfile(userId, dto);
    }

}