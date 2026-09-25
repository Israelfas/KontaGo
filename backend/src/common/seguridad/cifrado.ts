import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/*
 * Cifrado de datos sensibles guardados en la base (ISO/IEC 27002:2022,
 * 8.24): hoy, el secreto de la verificación en dos pasos. AES-256-GCM, que
 * además de ocultar detecta si alguien lo alteró.
 *
 * La clave sale de la configuración (CLAVE_CIFRADO), nunca de la base:
 * con una copia de la base sola no se pueden generar códigos.
 */

const VERSION = 'v1';

/** La clave de 32 bytes, a partir de lo configurado (cualquier largo). */
function claveDe(configurada: string): Buffer {
  return createHash('sha256').update(configurada).digest();
}

export function cifrar(texto: string, claveConfigurada: string): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', claveDe(claveConfigurada), iv);
  const datos = Buffer.concat([
    cifrador.update(texto, 'utf8'),
    cifrador.final(),
  ]);
  const etiqueta = cifrador.getAuthTag();
  return [VERSION, iv, etiqueta, datos]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64')))
    .join(':');
}

export function descifrar(guardado: string, claveConfigurada: string): string {
  const [version, iv, etiqueta, datos] = guardado.split(':');
  if (version !== VERSION || !iv || !etiqueta || !datos) {
    throw new Error('Dato cifrado con un formato desconocido');
  }
  const descifrador = createDecipheriv(
    'aes-256-gcm',
    claveDe(claveConfigurada),
    Buffer.from(iv, 'base64'),
  );
  descifrador.setAuthTag(Buffer.from(etiqueta, 'base64'));
  return Buffer.concat([
    descifrador.update(Buffer.from(datos, 'base64')),
    descifrador.final(),
  ]).toString('utf8');
}
