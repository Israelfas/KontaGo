/**
 * Emails de la cuenta. HTML simple (con estilos en línea, que es lo que
 * respetan todos los clientes de correo) y siempre con una salida para
 * quien no pidió nada: ignorar el email o avisar.
 */

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function plantilla(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#1c2b3a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffdf8;border:1px solid #e4ddc9;border-radius:16px">
          <tr><td style="padding:28px 28px 8px">
            <p style="margin:0;font-size:13px;font-weight:bold;color:#d98c2b">KontaGo</p>
            <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25">${titulo}</h1>
          </td></tr>
          <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.55">${cuerpo}</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#4c5c6b">Este es un mensaje automático de KontaGo. No lo respondas.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function correoRecuperacion(
  nombre: string,
  enlace: string,
  minutos: number,
) {
  return {
    asunto: 'Cambiá tu contraseña de KontaGo',
    html: plantilla(
      'Cambiá tu contraseña',
      `<p style="margin:0 0 16px">Hola ${escapar(nombre)}: alguien (seguramente vos) pidió cambiar la contraseña de tu cuenta.</p>
       <p style="margin:0 0 24px"><a href="${escapar(enlace)}" style="display:inline-block;background:#1c2b3a;color:#f6f3ec;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Elegir una contraseña nueva</a></p>
       <p style="margin:0 0 8px;font-size:13px;color:#4c5c6b">El enlace sirve una sola vez y durante ${minutos} minutos.</p>
       <p style="margin:0;font-size:13px;color:#4c5c6b">Si no fuiste vos, ignorá este email: tu contraseña sigue siendo la misma.</p>`,
    ),
  };
}

export function correoPasswordCambiada(nombre: string, cuando: Date) {
  const fecha = cuando.toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'long',
    timeStyle: 'short',
  });
  return {
    asunto: 'Tu contraseña de KontaGo cambió',
    html: plantilla(
      'Tu contraseña cambió',
      `<p style="margin:0 0 16px">Hola ${escapar(nombre)}: la contraseña de tu cuenta se cambió el ${escapar(fecha)}. Por seguridad, cerramos tu sesión en todos los dispositivos.</p>
       <p style="margin:0;font-size:13px;color:#4c5c6b">Si no fuiste vos, pedí una contraseña nueva desde "¿Olvidaste tu contraseña?" y avisale al administrador de tu tienda.</p>`,
    ),
  };
}
