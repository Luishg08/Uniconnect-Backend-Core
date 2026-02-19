import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('Uniconnect API')
    .setDescription('Documentación oficial de la API Uniconnect')
    .setVersion('1.0')
    .addBearerAuth() // para JWT después
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document);
  await app.listen(port);
}
bootstrap();
