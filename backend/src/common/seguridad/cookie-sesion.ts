import type { Request, Response } from 'express';

/*
 * La sesión de la web en una cookie (ISO/IEC 27002:2022, 8.5 y 8.24).
 *
 * El token de renovación (dura días) viaja en una cookie httpOnly: ningún
 * script de la página puede leerlo, así que un ataque de inyección de
 * código no se lo lleva. El de acceso (minutos) queda en la memoria de la
 * web. La app del celular no usa esto: guarda sus tokens en el almacén
 * seguro del teléfono y los manda en el cuerpo, como siempre.
 *
 * La web se identifica con el encabezado X-Cliente: web. Como no es un
 * encabezado "simple", el navegador pregunta antes (CORS) y solo lo deja
 * pasar desde los orígenes permitidos: otra página no puede usar la cookie.
 */

export const COOKIE_SESION = 'kontago_sesion';

/**
 * Cómo se guarda la cookie. `ruta`: solo las rutas de sesión la reciben (no
 * viaja en cada pedido), tal como las ve el navegador. Ver
 * COOKIE_SESION_RUTA en configuration.ts.
 */
export interface OpcionesCookie {
  segura: boolean;
  ruta: string;
}

export function esClienteWeb(req: Request): boolean {
  return req.headers['x-cliente'] === 'web';
}

/** El valor de una cookie del pedido (sin depender de cookie-parser). */
export function leerCookie(req: Request, nombre: string): string | undefined {
  const cabecera = req.headers.cookie;
  if (!cabecera) return undefined;
  for (const parte of cabecera.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() === nombre) {
      try {
        return decodeURIComponent(parte.slice(igual + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function guardarSesionEnCookie(
  res: Response,
  refreshToken: string,
  duracionSegundos: number,
  { segura, ruta }: OpcionesCookie,
): void {
  res.cookie(COOKIE_SESION, refreshToken, {
    httpOnly: true,
    // En producción, solo por https.
    secure: segura,
    // No viaja en pedidos que empiezan en otro sitio (protege de CSRF).
    sameSite: 'strict',
    path: ruta,
    maxAge: duracionSegundos * 1000,
  });
}

export function borrarCookieDeSesion(
  res: Response,
  { segura, ruta }: OpcionesCookie,
): void {
  res.clearCookie(COOKIE_SESION, {
    httpOnly: true,
    secure: segura,
    sameSite: 'strict',
    path: ruta,
  });
}
