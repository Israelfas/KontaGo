import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configurarApp(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Error al iniciar KontaGo backend:', error);
  process.exit(1);
});
