import type { Metadata } from 'next';
import { Contacto, DocumentoLegal } from '@/components/documento-legal';

export const metadata: Metadata = { title: 'Política de privacidad · KontaGo' };

/**
 * Política de privacidad según la Ley Orgánica de Protección de Datos
 * Personales de Ecuador (LOPDP) y el control 5.34 de ISO/IEC 27002:2022.
 */
export default function PrivacidadPage() {
  return (
    <DocumentoLegal titulo="Política de privacidad" actualizado="23 de septiembre de 2026">
      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        KontaGo es responsable del tratamiento de los datos de las cuentas (dueños y cajeros). Los
        datos de tu negocio (productos, ventas, inventario, caja) son tuyos: KontaGo los trata por
        encargo tuyo, solo para darte el servicio. Contacto: <Contacto />.
      </p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>
          De la cuenta: nombre, email, contraseña (guardada cifrada, nadie puede leerla) y rol.
        </li>
        <li>De la tienda: nombre, y si los cargas, RUC, razón social, dirección y teléfono.</li>
        <li>
          De la operación: productos, ventas, inventario y movimientos de caja, con quién y cuándo
          los registró.
        </li>
        <li>
          De seguridad: fecha, IP y dispositivo de cada ingreso, intento fallido y cambio de
          contraseña.
        </li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Darte el servicio: que puedas vender, controlar el stock y ver tus números.</li>
        <li>Mantener segura tu cuenta: detectar accesos indebidos y bloquear ataques.</li>
        <li>Mandarte los emails de la cuenta (recuperar la contraseña, alertas que actives).</li>
      </ul>
      <p>
        No vendemos tus datos ni los usamos para publicidad. La base para tratarlos es tu
        consentimiento al crear la cuenta y la ejecución del servicio que contratas.
      </p>

      <h2>4. Con quién se comparten</h2>
      <p>
        Solo con proveedores que hacen falta para que KontaGo funcione (servidores, envío de emails
        e inicio de sesión con Google), obligados a cuidarlos igual que nosotros. No se entregan a
        nadie más, salvo orden de una autoridad competente.
      </p>

      <h2>5. Cuánto tiempo se guardan</h2>
      <p>
        Mientras tu cuenta esté activa. Las ventas pueden tener que conservarse más tiempo por
        obligaciones tributarias. Si cierras la cuenta, eliminamos o anonimizamos los datos en un
        plazo razonable, salvo lo que la ley obligue a guardar.
      </p>

      <h2>6. Cómo los protegemos</h2>
      <p>
        Contraseñas cifradas, conexión segura, sesiones que se pueden cerrar, bloqueo tras intentos
        fallidos, registro de los accesos y separación de los datos de cada tienda. Si hubiera un
        incidente que afecte tus datos, te avisamos a ti y a la autoridad dentro de los plazos de
        la ley.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Puedes pedir acceder a tus datos, corregirlos, eliminarlos, oponerte a un uso, pedir una
        copia portable o retirar tu consentimiento. Escríbenos a <Contacto /> y te respondemos
        dentro de los plazos de la LOPDP. También puedes reclamar ante la Superintendencia de
        Protección de Datos Personales.
      </p>

      <h2>8. Cambios a esta política</h2>
      <p>
        Si la cambiamos en algo importante, te avisamos en la app o por email antes de que rija.
      </p>
    </DocumentoLegal>
  );
}
