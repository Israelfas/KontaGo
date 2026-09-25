import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/*
 * Códigos de verificación en dos pasos (TOTP, RFC 6238): los mismos de
 * Google Authenticator, Microsoft Authenticator o Authy. Cada 30 segundos,
 * un código de 6 dígitos que sale del secreto compartido y la hora.
 *
 * Implementado a mano (son pocas líneas y se prueba contra los vectores
 * del RFC) en vez de sumar una dependencia para esto.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32, RFC 4648
const PERIODO_S = 30;
const DIGITOS = 6;

export function aBase32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function deBase32(texto: string): Buffer {
  const limpio = texto.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const letra of limpio) {
    const indice = ALFABETO.indexOf(letra);
    if (indice < 0) throw new Error('Secreto con caracteres inválidos');
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Un secreto nuevo: 160 bits al azar, en Base32 (lo que se carga en la app). */
export function generarSecreto(): string {
  return aBase32(randomBytes(20));
}

/** El código de un paso de 30 segundos (HOTP, RFC 4226). */
export function codigoDelPaso(
  secreto: Buffer,
  paso: number,
  digitos = DIGITOS,
): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = createHmac('sha1', secreto).update(contador).digest();
  const corrimiento = hmac[hmac.length - 1] & 0x0f;
  const binario =
    ((hmac[corrimiento] & 0x7f) << 24) |
    (hmac[corrimiento + 1] << 16) |
    (hmac[corrimiento + 2] << 8) |
    hmac[corrimiento + 3];
  return String(binario % 10 ** digitos).padStart(digitos, '0');
}

export function pasoActual(ahoraMs = Date.now()): number {
  return Math.floor(ahoraMs / 1000 / PERIODO_S);
}

/**
 * Si el código vale para el secreto, en qué paso (para no aceptar el mismo
 * código dos veces). Acepta el paso anterior y el siguiente: el reloj del
 * celular puede estar unos segundos corrido.
 */
export function verificarCodigo(
  secretoBase32: string,
  codigo: string,
  ahoraMs = Date.now(),
  ventana = 1,
): number | null {
  const limpio = codigo.replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return null;
  const secreto = deBase32(secretoBase32);
  const actual = pasoActual(ahoraMs);
  for (let d = -ventana; d <= ventana; d++) {
    const esperado = codigoDelPaso(secreto, actual + d);
    if (timingSafeEqual(Buffer.from(esperado), Buffer.from(limpio))) {
      return actual + d;
    }
  }
  return null;
}

/** El enlace otpauth:// que se muestra como QR (y que abre la app autenticadora). */
export function enlaceOtpauth(
  secretoBase32: string,
  cuenta: string,
  emisor = 'KontaGo',
): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  const q = new URLSearchParams({
    secret: secretoBase32,
    issuer: emisor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PERIODO_S),
  });
  return `otpauth://totp/${etiqueta}?${q.toString()}`;
}
