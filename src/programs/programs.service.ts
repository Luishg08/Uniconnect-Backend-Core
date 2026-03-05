import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateProgramDto) {
    return (this.prisma as any).program.create({
      data: {
        name: data.name,
      },
    });
  }

  async findAll() {
    return (this.prisma as any).program.findMany({
      orderBy: { name: 'asc' },
    });
  }
}