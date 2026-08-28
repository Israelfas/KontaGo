import ms from 'ms';

function parseDuracionASegundos(valor: string): number {
  const milisegundos = ms(valor as ms.StringValue);
  return Math.floor(milisegundos / 1000);
}

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'kontago',
    password: process.env.DB_PASSWORD || 'kontago',
    name: process.env.DB_NAME || 'kontago',
    // Nunca en true en producción: las migraciones son la única fuente de verdad del esquema.
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    // true para el puerto 465 (SSL implícito); false + STARTTLS para 587/25.
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'KontaGo <no-reply@kontago.local>',
  },

  alertas: {
    diasVencimientoDefault: parseInt(
      process.env.ALERTAS_DIAS_VENCIMIENTO || '7',
      10,
    ),
  },

  // Tarifa general de IVA vigente en Ecuador (15% desde abril 2024,
  // ratificada por el SRI para 2026). Configurable por .env porque esta
  // tarifa cambia por decreto ejecutivo periódicamente — no es un valor
  // que deba quedar hardcodeado en el código. Los precios de producto
  // (precioVentaCentavos) son SIEMPRE precio final al público con IVA
  // incluido (así se muestran los precios en Ecuador); el IVA se extrae
  // de ese precio final, nunca se suma aparte, salvo que el producto esté
  // marcado como ivaExento (tarifa 0%, ej. alimentos básicos según el
  // art. 55 de la LRTI).
  impuestos: {
    tarifaIvaGeneral: parseFloat(process.env.IVA_TARIFA_GENERAL || '15') / 100,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change-me-access-secret',
    // Segundos (número), no string ('15m'): así @nestjs/jwt tipa expiresIn
    // como `number` sin necesidad de castear a `any` en ningún lado.
    accessExpiresInSeconds: parseDuracionASegundos(
      process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    ),
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh-secret',
    refreshExpiresInSeconds: parseDuracionASegundos(
      process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    ),
  },
});
