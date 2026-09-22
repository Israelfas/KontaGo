import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Para que req.ip sea la IP real del cliente detrás de un proxy (la usa
  // el límite de intentos de login). Ver TRUST_PROXY en configuration.ts.
  app.set(
    'trust proxy',
    app.get(ConfigService).get<number | string | false>('trustProxy'),
  );

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta propiedades no declaradas en los DTOs
      forbidNonWhitelisted: true,
      transform: true, // permite usar class-transformer (@Type) en los DTOs
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Error al iniciar KontaGo backend:', error);
  process.exit(1);
});
