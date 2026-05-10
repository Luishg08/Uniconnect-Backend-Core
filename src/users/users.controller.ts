import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';
import { ProfileUpdateDto } from './dto/google-user-info.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

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
    @Get('community/connected')
    @ApiOperation({
        summary: 'HU-Comunidad: Listar amigos en comunidad',
        description: 'Lista usuarios con conexión aceptada del usuario autenticado para sección Amigos.'
    })
    async getConnectedCommunity(@GetClaim('sub') userId: number) {
        return this.usersService.getConnectedCommunityUsers(userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('community/not-connected')
    @ApiOperation({
        summary: 'HU-Comunidad: Listar usuarios no conectados',
        description: 'Lista todos los usuarios que no tienen conexión aceptada con el usuario autenticado para sección Comunidad general.'
    })
    async getNotConnectedCommunity(@GetClaim('sub') userId: number) {
        return this.usersService.getNotConnectedCommunityUsers(userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('connections/with-courses/:groupId')
    @ApiOperation({
        summary: 'HU-Invitaciones: Conexiones con materia del grupo',
        description: 'Lista conexiones aceptadas del usuario que comparten la materia específica del grupo, para invitarlos a ese grupo.'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Lista de conexiones con la materia del grupo',
        schema: {
            example: [{
                id_user: 2,
                full_name: 'Juan Perez',
                picture: 'https://...',
                email: 'juan@example.com',
                program: { name: 'Ingeniería de Sistemas' },
                course: {
                    id_course: 1,
                    name: 'Matemáticas'
                }
            }]
        }
    })
    async getConnectionsForGroupInvite(
        @GetClaim('sub') userId: number,
        @Param('groupId') groupId: number
    ) {
        console.log('[CONTROLLER-INVITE] Endpoint llamado con userId:', userId, 'groupId:', groupId);
        return this.usersService.getConnectionsForGroupInvite(userId, groupId);
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

    @UseGuards(JwtAuthGuard)
    @Post('onboarding')
    @ApiOperation({
        summary: 'HU-Onboarding: Completar datos académicos iniciales',
        description: 'Se llama una sola vez tras el primer login con Auth0. Asigna el programa y semestre actual del usuario. Devuelve 409 si ya fue completado.',
    })
    async completeOnboarding(@GetClaim('sub') userId: number, @Body() dto: CompleteOnboardingDto) {
        return this.usersService.completeOnboarding(userId, dto);
    }

}