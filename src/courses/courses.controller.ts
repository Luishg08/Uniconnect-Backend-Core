import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCourseDto } from './dto/create-course.dto'; 
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva materia' })
  @ApiBody({ type: CreateCourseDto }) 
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las materias' })
  findAll() {
    return this.coursesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('get-by-student')
  getCoursesByStudent(@GetClaim('sub') userId: number) {
    return this.coursesService.getCoursesByStudent(userId);
  }

}