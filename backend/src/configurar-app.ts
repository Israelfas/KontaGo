import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { mensajesEnEspanol } from './common/validacion/mensajes-en-espanol';

/**
 * Todo lo que se configura sobre la app además de los módulos. Aparte de
 * main.ts para que los tests e2e levanten la app EXACTAMENTE igual que
 * en producción (validación, CORS), no una versión parecida.
 */
export function configurarApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  // Para que req.ip sea la IP real del cliente detrás de un proxy (la usa
  // el límite de intentos de login). Ver TRUST_PROXY en configuration.ts.
  app.set('trust proxy', config.get<number | string | false>('trustProxy'));

  // Ver CORS_ORIGINS en configuration.ts. Sin cookies: la sesión viaja
  // en el header Authorization, así que no hace falta `credentials`.
  app.enableCors({
    origin: config.get<string[] | true>('corsOrigins'),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Para que la web lea el nombre del archivo de las descargas (Excel).
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });
  // No anunciar que el servidor es Express.
  app.disable('x-powered-by');

  // Encabezados de seguridad (ISO/IEC 27002:2022, 8.26 y 8.9): la API solo
  // responde JSON, así que nada de esto le quita funciones.
  const produccion = config.get<string>('nodeEnv') === 'production';
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // Las respuestas de /auth llevan tokens: que ningún intermediario ni
    // el navegador las guarde.
    if (req.path.startsWith('/auth'))
      res.setHeader('Cache-Control', 'no-store');
    // Solo con HTTPS de verdad (en producción): obliga a no volver a HTTP.
    if (produccion) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta propiedades no declaradas en los DTOs
      forbidNonWhitelisted: true,
      transform: true, // permite usar class-transformer (@Type) en los DTOs
      // Mensajes en español (class-validator responde en inglés).
      exceptionFactory: (errores) =>
        new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: mensajesEnEspanol(errores),
        }),
    }),
  );
}
