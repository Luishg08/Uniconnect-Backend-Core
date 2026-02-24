// src/enrollments/enrollments.controller.ts

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@ApiTags('Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Matricular a un estudiante en una materia' })
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las matrículas' })
  findAll() {
    return this.enrollmentsService.findAll();
  }
}