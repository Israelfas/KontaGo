import type { ReactNode } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';

/*
 * Dónde se baja la app. Los enlaces se configuran con variables de entorno
 * (al compilar la web), así el día que esté en las tiendas o haya un APK
 * nuevo no hay que tocar código:
 *
 *   NEXT_PUBLIC_APP_ANDROID_URL  Google Play o el .apk
 *   NEXT_PUBLIC_APP_IOS_URL      App Store o TestFlight
 *
 * Sin enlace, el botón dice "Muy pronto" y no lleva a ningún lado.
 */
const ANDROID = process.env.NEXT_PUBLIC_APP_ANDROID_URL || null;
const IOS = process.env.NEXT_PUBLIC_APP_IOS_URL || null;

function IconoAndroid({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10ZM3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8Zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8Zm-4.97-5.84 1.3-1.3a.5.5 0 1 0-.7-.7l-1.48 1.47A5.96 5.96 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15a.5.5 0 1 0-.7.7l1.31 1.31A5.97 5.97 0 0 0 6 7h12a5.97 5.97 0 0 0-2.47-4.84ZM10 5H9V4h1v1Zm5 0h-1V4h1v1Z" />
    </svg>
  );
}

function IconoIphone({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M10.5 5h3" strokeLinecap="round" />
      <path d="M11 18.5h2" strokeLinecap="round" />
    </svg>
  );
}

function BotonTienda({
  href,
  plataforma,
  icono,
}: {
  href: string | null;
  plataforma: string;
  icono: ReactNode;
}) {
  const contenido = (
    <>
      <span className="boton-tienda-icono">{icono}</span>
      <span className="text-left leading-tight">
        <span className="block text-[0.68rem] font-medium opacity-70">
          {href ? 'Descargar para' : 'Muy pronto para'}
        </span>
        <span className="block font-display text-base font-bold tracking-[-0.02em]">
          {plataforma}
        </span>
      </span>
    </>
  );
  if (!href) {
    return (
      <span className="boton-tienda" data-pronto="true" aria-disabled="true">
        {contenido}
      </span>
    );
  }
  const esApk = href.toLowerCase().endsWith('.apk');
  return (
    <a
      href={href}
      className="boton-tienda"
      {...(esApk ? { download: '' } : { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {contenido}
    </a>
  );
}

/** Botones de descarga y, en la computadora, el QR para descargarla desde el celular. */
export async function Descarga() {
  const qr = ANDROID
    ? await QRCode.toString(ANDROID, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#1c2b3a', light: '#00000000' },
      })
    : null;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <BotonTienda
            href={ANDROID}
            plataforma="Android"
            icono={<IconoAndroid className="h-6 w-6" />}
          />
          <BotonTienda href={IOS} plataforma="iPhone" icono={<IconoIphone className="h-6 w-6" />} />
        </div>
        <p className="text-sm text-papel/65">
          {ANDROID || IOS ? 'O úsala' : 'Mientras tanto, úsala'} desde el navegador del celular:{' '}
          <Link
            href="/registro"
            className="font-semibold text-papel underline decoration-ambar decoration-2 underline-offset-4"
          >
            crear mi cuenta
          </Link>
          .
        </p>
      </div>

      {qr && (
        <div className="hidden items-center gap-3 rounded-2xl bg-papel p-3 pr-4 md:flex">
          <span
            className="block h-20 w-20 [&>svg]:h-full [&>svg]:w-full"
            role="img"
            aria-label="Código QR para descargar la app de Android"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <span className="max-w-[9rem] text-xs leading-5 text-tinta-suave">
            Escanéalo con la cámara del celular para descargarla.
          </span>
        </div>
      )}
    </div>
  );
}
