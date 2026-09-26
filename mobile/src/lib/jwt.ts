// RN/Hermes moderno trae atob global, pero no en todos los engines JS que
// puede usar Expo (JSC en algunos builds no lo expone) — decodificamos
// base64 a mano para no depender de eso.
const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 o base64url (el de los JWT: usa - y _ en vez de + y /). */
export function decodificarBase64(input: string): string {
  const str = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of str) {
    const val = BASE64_CHARS.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

/** De quién es un token (su `sub`), sin verificarlo; null si no se entiende. */
export function cuentaDelToken(token: string): string | null {
  try {
    const payload = JSON.parse(decodificarBase64(token.split('.')[1])) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
