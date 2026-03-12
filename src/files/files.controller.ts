import { Controller, Post, Get, Body, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { File } from 'multer';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Endpoint de prueba para validar conexión a S3
   * GET /files/health
   */
  @Get('health')
  async healthCheck() {
    return this.filesService.testS3Connection();
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadFiles(
    @UploadedFiles() files: File[],
    @Body('id_group') id_group: string,
    @Body('id_message') id_message?: string,
  ) {
    const parsedGroupId = parseInt(id_group, 10);
    const parsedMessageId = id_message ? parseInt(id_message, 10) : undefined;

    const savedFiles = await this.filesService.uploadGroupFiles(
      files, 
      parsedGroupId, 
      parsedMessageId
    );

    return {
      message: 'Archivos subidos con éxito a S3 y guardados en base de datos',
      data: savedFiles,
    };
  }
}