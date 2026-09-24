import type { Metadata } from 'next';
import Link from 'next/link';
import { Contacto, DocumentoLegal } from '@/components/documento-legal';

export const metadata: Metadata = { title: 'Términos y condiciones · KontaGo' };

export default function TerminosPage() {
  return (
    <DocumentoLegal titulo="Términos y condiciones" actualizado="23 de septiembre de 2026">
      <h2>1. Sobre KontaGo</h2>
      <p>
        KontaGo es una herramienta de punto de venta e inventario para pequeños negocios. Al crear
        una cuenta o usarla, aceptas estos términos y la{' '}
        <Link href="/privacidad" className="font-semibold underline">
          política de privacidad
        </Link>
        .
      </p>

      <h2>2. Tu cuenta y tu equipo</h2>
      <p>
        Eres responsable de tu contraseña y de lo que se haga con tu cuenta. Como administrador,
        también de las cuentas que creas para tu equipo y de quitarle el acceso a quien deje de
        trabajar contigo. Si sospechas un uso indebido, cambia la contraseña y avísanos.
      </p>

      <h2>3. Tus datos</h2>
      <p>
        Los datos de tu negocio son tuyos. Los usamos solo para darte el servicio, como explica la
        política de privacidad.
      </p>

      <h2>4. Uso aceptable</h2>
      <p>
        No se puede usar KontaGo para actividades ilegales, para intentar entrar a cuentas o datos
        de otros, ni para afectar el funcionamiento del servicio.
      </p>

      <h2>5. Tickets y facturación</h2>
      <p>
        El ticket de venta de KontaGo es un comprobante interno y no reemplaza a la factura
        electrónica del SRI. Cumplir con tus obligaciones tributarias es responsabilidad tuya.
      </p>

      <h2>6. Disponibilidad</h2>
      <p>
        Hacemos lo posible por mantener el servicio disponible y tus datos respaldados, pero puede
        haber interrupciones por mantenimiento o causas ajenas.
      </p>

      <h2>7. Cambios</h2>
      <p>
        Si cambiamos estos términos en algo importante, te avisamos antes de que rijan. Dudas:{' '}
        <Contacto />.
      </p>
    </DocumentoLegal>
  );
}
