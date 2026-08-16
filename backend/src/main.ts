import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
