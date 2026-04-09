import { Controller, Post, Get, Body, UseInterceptors, UploadedFiles, UseGuards, Req, Param, ParseIntPipe } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { MessageRepository } from '../messages/message.repository';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly messagesGateway: MessagesGateway,
    private readonly messageRepository: MessageRepository,
  ) {}

  /**
   * Endpoint de prueba para validar conexión a S3
   * GET /files/health
   */
  @Get('health')
  async healthCheck() {
    return this.filesService.testS3Connection();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('id_group') id_group: string,
    @Body('id_message') id_message: string | undefined,
    @Req() req: any,
  ) {
    const parsedGroupId = parseInt(id_group, 10);
    const parsedMessageId = id_message ? parseInt(id_message, 10) : undefined;
    const userId = req.user.sub; // id_user del JWT

    const result = await this.filesService.uploadGroupFiles(
      files,
      parsedGroupId,
      userId,
      parsedMessageId,
    );

    // Obtener el mensaje completo con files + membership para emitir por WebSocket
    const fullMessage = await this.messageRepository.findById(result.messageId);

    if (fullMessage && fullMessage.membership?.user) {
      // Formatear archivos
      const filesArray = (fullMessage.files || []).map((file: any) => ({
        id_file: file.id_file,
        url: file.url,
        file_name: file.file_name,
        mime_type: file.mime_type,
        size: file.size ?? undefined,
        created_at: file.created_at ?? undefined,
      }));

      // Emitir message:new al grupo para que todos vean los archivos en tiempo real
      const messageEvent = {
        id_message: fullMessage.id_message,
        id_membership: fullMessage.id_membership,
        text_content: fullMessage.text_content || '',
        send_at: fullMessage.send_at,
        attachments: fullMessage.attachments || null,
        files: filesArray,
        user: {
          id_user: fullMessage.membership.user.id_user,
          full_name: fullMessage.membership.user.full_name,
          picture: fullMessage.membership.user.picture ?? undefined,
        },
        group: {
          id_group: fullMessage.membership.group?.id_group ?? parsedGroupId,
          name: fullMessage.membership.group?.name || 'Grupo',
        },
      };

      this.messagesGateway.sendMessageToGroup(parsedGroupId, 'message:new', messageEvent);
    }

    return {
      message: 'Archivos subidos con éxito a S3 y guardados en base de datos',
      data: result.files,
      id_message: result.messageId,
    };
  }

    /**
     * Endpoint para obtener URL prefirmada de descarga
     * GET /files/:id/download
     * Protegido con JWT
     */
    @Get(':id/download')
    @UseGuards(JwtAuthGuard)
    async getDownloadUrl(@Param('id', ParseIntPipe) id: number) {
      const signedUrl = await this.filesService.getPresignedUrl(id);

      return {
        success: true,
        data: {
          url: signedUrl,
        },
      };
    }
}
