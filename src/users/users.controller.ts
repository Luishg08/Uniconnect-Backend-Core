import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
    ) {
        return this.usersService.findAll({
            search,
            id_program: id_program ? Number(id_program) : undefined,
            id_course: id_course ? Number(id_course) : undefined,
        });
    }
}