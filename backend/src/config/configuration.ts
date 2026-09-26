import ms from 'ms';

function parseDuracionASegundos(valor: string): number {
  const milisegundos = ms(valor as ms.StringValue);
  return Math.floor(milisegundos / 1000);
}

/**
 * Secretos que firman los JWT. En desarrollo se tolera el valor por
 * defecto para no trabar a nadie, pero en producción arrancar con
 * 'change-me-...' significaría que cualquiera que lea este repo puede
 * firmar tokens válidos (de cualquier tenant, con rol admin). Mejor que
 * el backend no levante a que levante inseguro.
 */
function secretoRequerido(nombre: string, porDefecto: string): string {
  const valor = process.env[nombre];
  if (valor) return valor;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `Falta la variable de entorno ${nombre} (obligatoria en producción)`,
    );
  }
  return porDefecto;
}

/**
 * TRUST_PROXY: cuántos proxies (Nginx, Railway, Cloudflare...) hay
 * delante del backend. Sin esto, detrás de un proxy todas las peticiones
 * parecen venir de la IP del proxy, y el límite de intentos de login se
 * compartiría entre TODOS los usuarios.
 *
 * - vacío (default): sin proxy, se usa la IP de la conexión.
 * - número (ej. 1): Express toma la IP que agregó el último proxy en
 *   X-Forwarded-For — la del cliente real, que él no puede falsificar.
 * - lista de IPs/subredes (ej. "loopback, 10.0.0.0/8"): confía solo en
 *   proxies con esas direcciones.
 *
 * "true" se rechaza a propósito: con true Express toma la IP de más a la
 * izquierda del header, que la escribe el propio cliente — un atacante
 * mandaría una IP inventada distinta en cada intento y el límite nunca
 * lo frenaría.
 */
function parseTrustProxy(valor: string | undefined): number | string | false {
  const limpio = valor?.trim();
  if (!limpio || limpio === 'false') return false;
  if (/^\d+$/.test(limpio)) return parseInt(limpio, 10);
  if (limpio === 'true') {
    throw new Error(
      'TRUST_PROXY=true es inseguro (permite falsificar la IP y saltarse el límite de intentos). ' +
        'Usa la cantidad de proxies delante del backend, ej. TRUST_PROXY=1',
    );
  }
  return limpio;
}

/**
 * CORS_ORIGINS: desde qué páginas web se puede llamar a la API (la web
 * de KontaGo, ej. "https://app.kontago.ec"), separadas por coma. La app
 * móvil no manda Origin, así que no le afecta: esto frena a que otra
 * página, abierta en el navegador de alguien con sesión, use la API.
 *
 * - En desarrollo, vacío = cualquier origen (la web local cambia de IP).
 * - En producción es obligatorio: el backend no arranca sin él.
 */
function parseCorsOrigins(valor: string | undefined): string[] | true {
  const origenes = (valor ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (origenes.length > 0) return origenes;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Falta CORS_ORIGINS (obligatoria en producción): la dirección de la web, ej. CORS_ORIGINS=https://app.kontago.ec',
    );
  }
  return true;
}

/**
 * APP_WEB_URL: dirección de la web, para los enlaces que van por email
 * (recuperar la contraseña). Si no está, la primera de CORS_ORIGINS (en
 * producción es obligatoria y es justamente la web); en local, la web de
 * desarrollo.
 */
function parseAppWebUrl(corsOrigins: string[] | true): string {
  const valor =
    process.env.APP_WEB_URL?.trim() ||
    (Array.isArray(corsOrigins) ? corsOrigins[0] : '') ||
    'http://localhost:3001';
  return valor.replace(/\/+$/, '');
}

/**
 * COOKIE_SESION_RUTA: la ruta de la cookie de sesión de la web, tal como la
 * ve el navegador. /auth (default) si la web llama directo al backend;
 * /api/auth si lo llama a través de su propio reenvío de /api (así en
 * Railway: ahí la web y el backend quedan en sitios distintos y la cookie
 * no viajaría de uno a otro).
 */
function parseRutaCookie(valor: string | undefined): string {
  const limpio = valor?.trim().replace(/\/+$/, '');
  if (!limpio) return '/auth';
  if (!limpio.startsWith('/')) {
    throw new Error(
      'COOKIE_SESION_RUTA tiene que empezar con /, ej. COOKIE_SESION_RUTA=/api/auth',
    );
  }
  return limpio;
}

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  appWebUrl: parseAppWebUrl(parseCorsOrigins(process.env.CORS_ORIGINS)),
  cookieSesionRuta: parseRutaCookie(process.env.COOKIE_SESION_RUTA),

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'kontago',
    // La contraseña de ejemplo ('kontago') no puede llegar a producción.
    password: secretoRequerido('DB_PASSWORD', 'kontago'),
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
  },

  correo: {
    // Quién firma los correos. SMTP_FROM es el nombre anterior.
    remitente:
      process.env.CORREO_REMITENTE ||
      process.env.SMTP_FROM ||
      'KontaGo <no-reply@kontago.local>',
    // API HTTPS de Brevo. Si está, gana sobre SMTP (en Railway, fuera del
    // plan Pro, las conexiones SMTP salientes están bloqueadas).
    brevoApiKey: process.env.BREVO_API_KEY || '',
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

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
  },

  // Cifra en la base los datos sensibles (el secreto de la verificación
  // en dos pasos). Si se cambia, las verificaciones ya activadas dejan de
  // servir: cada persona tendría que volver a activarla.
  claveCifrado: secretoRequerido('CLAVE_CIFRADO', 'change-me-clave-de-cifrado'),

  jwt: {
    accessSecret: secretoRequerido(
      'JWT_ACCESS_SECRET',
      'change-me-access-secret',
    ),
    // Segundos (número), no string ('15m'): así @nestjs/jwt tipa expiresIn
    // como `number` sin necesidad de castear a `any` en ningún lado.
    accessExpiresInSeconds: parseDuracionASegundos(
      process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    ),
    refreshSecret: secretoRequerido(
      'JWT_REFRESH_SECRET',
      'change-me-refresh-secret',
    ),
    refreshExpiresInSeconds: parseDuracionASegundos(
      process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    ),
  },
});
