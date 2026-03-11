import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [PrismaModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        const region = configService.get<string>('AWS_REGION');
        if (!region) {
          throw new Error('AWS_REGION no está definida');
        }
        return new S3Client({ region });
      },
      inject: [ConfigService],
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}