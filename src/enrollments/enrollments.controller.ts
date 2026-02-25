// src/enrollments/enrollments.controller.ts

import { Controller, Get, Post, Body, UseGuards, Delete, Param, Patch } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { GetClaim } from 'src/auth/decorators/get-token-claim.decorator';

@ApiTags('Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) { }

  @Post()
  @ApiOperation({ summary: 'Matricular a un estudiante en una materia' })
  create(@Body() createEnrollmentDto: CreateEnrollmentDto, @GetClaim('sub') userId: number) {
    return this.enrollmentsService.create(createEnrollmentDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las matrículas' })
  findAll() {
    return this.enrollmentsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar el estado de una matrícula' })
  updateStatus(@GetClaim('sub') userId: number, @Param('id') id_course: number, @Body('state') status: string) {
    return this.enrollmentsService.updateStatus(userId, id_course, status);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una matrícula por ID' })
  remove(@GetClaim('sub') userId: number, @Param('id') id_course: number) {
    return this.enrollmentsService.remove(userId, id_course);
  }

}