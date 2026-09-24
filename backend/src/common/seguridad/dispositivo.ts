/**
 * "Chrome en Windows", "App en Android": el user-agent en palabras que
 * el dueño de la tienda reconoce ("¿ese soy yo?").
 *
 * La app móvil no manda un user-agent de navegador: en Android llega
 * "okhttp/…" y en iPhone "KontaGo/… CFNetwork/… Darwin/…".
 */
export function describirDispositivo(
  userAgent: string | null | undefined,
): string {
  const ua = userAgent ?? '';
  if (!ua) return 'Dispositivo desconocido';
  if (/okhttp/i.test(ua)) return 'App en Android';
  if (/CFNetwork|Darwin/i.test(ua) && !/Mozilla/i.test(ua))
    return 'App en iPhone';
  if (/Expo|ReactNative/i.test(ua)) return 'App KontaGo';

  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const sistema = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iPhone'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (navegador && sistema) return `${navegador} en ${sistema}`;
  return navegador ?? sistema ?? 'Otro dispositivo';
}
