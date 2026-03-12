import { Injectable, BadRequestException, InternalServerErrorException, Inject } from '@nestjs/common';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as multer from 'multer';

@Injectable()
export class FilesService {
  private bucketName: string;
  private region: string;

  constructor(
    @Inject(S3Client) private readonly s3Client: S3Client,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME')!;
    this.region = this.configService.get<string>('AWS_REGION')!;

    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME no está definida');
    }
    if (!this.region) {
      throw new Error('AWS_REGION no está definida');
    }
  }

  /**
   * Prueba la conexión a AWS S3
   */
  async testS3Connection(): Promise<{ ok: boolean; bucket: string; region: string; message: string }> {
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucketName });
      await this.s3Client.send(command);
      return {
        ok: true,
        bucket: this.bucketName,
        region: this.region,
        message: 'Conexión a S3 exitosa',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al conectar con S3: ${error.message}. Verifica credenciales y permisos IAM.`,
      );
    }
  }

  /**
   * Sube archivos a S3 y los guarda en BD.
   * Si no se envía id_message, crea un mensaje contenedor automáticamente
   * para que los archivos aparezcan en el historial del chat.
   */
  async uploadGroupFiles(
    files: multer.File[],
    id_group: number,
    id_user: number,
    id_message?: number,
  ): Promise<{ files: any[]; messageId: number }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se enviaron archivos');
    }

    // Validar que el grupo existe
    const groupExists = await this.prisma.group.findUnique({
      where: { id_group },
    });

    if (!groupExists) {
      throw new BadRequestException(`El grupo con id ${id_group} no existe`);
    }

    // Si no hay id_message, crear un mensaje contenedor automáticamente
    let currentMessageId = id_message;

    if (!currentMessageId) {
      // Buscar la membresía del usuario en este grupo
      const membership = await this.prisma.membership.findFirst({
        where: {
          id_user,
          id_group,
        },
      });

      if (!membership) {
        throw new BadRequestException(
          `El usuario ${id_user} no es miembro del grupo ${id_group}`,
        );
      }

      // Crear mensaje contenedor (texto vacío, solo llevará archivos)
      const newMessage = await this.prisma.message.create({
        data: {
          id_membership: membership.id_membership,
          text_content: '',
          send_at: new Date(),
        },
      });

      currentMessageId = newMessage.id_message;
    }

    // Subir todos los archivos a AWS S3 en concurrencia
    const uploadPromises = files.map(async (file) => {
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const safeName = file.originalname.replace(/\s+/g, '_');
        const fileName = `uploads/${uniqueSuffix}-${safeName}`;

        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await this.s3Client.send(command);

        const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileName}`;

        return this.prisma.file.create({
          data: {
            url: fileUrl,
            file_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
            id_group,
            id_message: currentMessageId,
          },
        });
      } catch (error) {
        throw new InternalServerErrorException(
          `Error al subir archivo: ${error.message}`,
        );
      }
    });

    const savedFiles = await Promise.all(uploadPromises);

    return {
      files: savedFiles,
      messageId: currentMessageId!,
    };
  }
}
