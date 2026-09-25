'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RutaProtegida } from '@/components/ruta-protegida';
import { useAuth } from '@/lib/auth-context';
import { obtenerTicket, ApiError } from '@/lib/api';
import { formatearCentavos, numeroDeTicket } from '@/lib/formato';
import type { Ticket } from '@/lib/tipos';
import { formatearCantidad, precioPor } from '@/lib/cantidad';

// Ancho del papel de la impresora térmica. 80 mm es el más común en
// minimarkets; 58 mm, el de las impresoras chicas (y las Bluetooth).
type Papel = '80' | '58';
const CLAVE_PAPEL = 'kontago.papelTicket';

function papelGuardado(): Papel {
  try {
    return localStorage.getItem(CLAVE_PAPEL) === '58' ? '58' : '80';
  } catch {
    return '80';
  }
}

function Fila({
  izquierda,
  derecha,
  fuerte,
}: {
  izquierda: string;
  derecha: string;
  fuerte?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 ${fuerte ? 'text-[1.15em] font-bold' : ''}`}>
      <span>{izquierda}</span>
      <span className="shrink-0">{derecha}</span>
    </div>
  );
}

function Separador() {
  return <div className="my-2 border-t border-dashed border-black" aria-hidden="true" />;
}

/**
 * El ticket de una venta, armado como el papel de una impresora térmica:
 * una columna angosta, letra monoespaciada, negro sobre blanco. Se imprime
 * con el diálogo del navegador (que también permite guardarlo en PDF).
 */
function ContenidoTicket() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const imprimirAlAbrir = useSearchParams().get('imprimir') === '1';
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [papel, setPapel] = useState<Papel>('80');
  const yaImprimio = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPapel(papelGuardado());
  }, []);

  useEffect(() => {
    if (!token || !id) return;
    obtenerTicket(token, id)
      .then(setTicket)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el ticket'),
      );
  }, [token, id]);

  // Recién cuando el ticket está en pantalla (si no, se imprime vacío).
  useEffect(() => {
    if (ticket && imprimirAlAbrir && !yaImprimio.current) {
      yaImprimio.current = true;
      setTimeout(() => window.print(), 300);
    }
  }, [ticket, imprimirAlAbrir]);

  function cambiarPapel(nuevo: Papel) {
    setPapel(nuevo);
    try {
      localStorage.setItem(CLAVE_PAPEL, nuevo);
    } catch {
      // Sin almacenamiento, vale solo para esta vez.
    }
  }

  if (error) {
    return <p className="p-6 text-sm text-rojo-perdida">{error}</p>;
  }
  if (!ticket) {
    return <p className="p-6 text-sm text-tinta-suave">Cargando ticket…</p>;
  }

  const fecha = new Date(ticket.fecha);
  const cuando = `${fecha.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;

  return (
    <div className="ticket-pagina min-h-screen bg-papel py-6 print:bg-white print:py-0">
      <div className="no-imprimir mx-auto mb-4 flex max-w-sm flex-wrap items-center justify-center gap-2 px-4">
        <button type="button" onClick={() => window.print()} className="button button-primary">
          Imprimir
        </button>
        <div className="flex gap-1" role="group" aria-label="Ancho del papel">
          {(['80', '58'] as const).map((ancho) => (
            <button
              key={ancho}
              type="button"
              aria-pressed={papel === ancho}
              onClick={() => cambiarPapel(ancho)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                papel === ancho
                  ? 'border-tinta bg-tinta text-papel'
                  : 'border-papel-linea bg-white text-tinta'
              }`}
            >
              Papel {ancho} mm
            </button>
          ))}
        </div>
        <button type="button" onClick={() => window.close()} className="button button-ghost">
          Cerrar
        </button>
      </div>

      <article
        className={`ticket mx-auto bg-white p-3 font-ticket text-black shadow-sm print:p-0 print:shadow-none ${
          papel === '58' ? 'ticket-58' : 'ticket-80'
        }`}
        aria-label={`Ticket ${numeroDeTicket(ticket.numero)}`}
      >
        <header className="text-center">
          <p className="text-[1.15em] font-bold uppercase">{ticket.tienda.nombre}</p>
          {/* La razón social solo si es distinta del nombre del letrero. */}
          {ticket.tienda.razonSocial && ticket.tienda.razonSocial !== ticket.tienda.nombre && (
            <p>{ticket.tienda.razonSocial}</p>
          )}
          {ticket.tienda.ruc && <p>RUC {ticket.tienda.ruc}</p>}
          {ticket.tienda.direccion && <p>{ticket.tienda.direccion}</p>}
          {ticket.tienda.telefono && <p>Tel. {ticket.tienda.telefono}</p>}
          <div className="my-2 border-t border-dashed border-black" aria-hidden="true" />
          <p>Ticket {numeroDeTicket(ticket.numero)}</p>
          <p>{cuando}</p>
          <p>Atendió: {ticket.cajero}</p>
        </header>

        <Separador />

        {ticket.lineas.map((linea, i) => (
          <div key={i} className="mb-1">
            <p>{linea.nombre}</p>
            <div className="pl-3">
              <Fila
                izquierda={`${formatearCantidad(linea.cantidad, linea.unidad)} x ${formatearCentavos(linea.precioUnitarioCentavos)}${precioPor(linea.unidad)}`}
                derecha={formatearCentavos(linea.totalCentavos)}
              />
              {linea.cantidadAnulada > 0 && (
                <p>(anulado: {formatearCantidad(linea.cantidadAnulada, linea.unidad)})</p>
              )}
            </div>
          </div>
        ))}

        <Separador />

        {ticket.subtotalConIvaCentavos > 0 && (
          <Fila
            izquierda={`Subtotal ${ticket.tarifaIva}%`}
            derecha={formatearCentavos(ticket.subtotalConIvaCentavos)}
          />
        )}
        {ticket.subtotalSinIvaCentavos > 0 && (
          <Fila
            izquierda="Subtotal 0%"
            derecha={formatearCentavos(ticket.subtotalSinIvaCentavos)}
          />
        )}
        <Fila
          izquierda={`IVA ${ticket.tarifaIva}%`}
          derecha={formatearCentavos(ticket.ivaCentavos)}
        />
        <Fila izquierda="TOTAL" derecha={formatearCentavos(ticket.totalCentavos)} fuerte />

        <Separador />

        {ticket.metodoPago === 'transferencia' ? (
          <p>Pagado por transferencia</p>
        ) : ticket.metodoPago === 'fiado' ? (
          <p>Al fiado · {ticket.cliente ?? 'cliente'}</p>
        ) : (
          <>
            <Fila izquierda="Efectivo" derecha={formatearCentavos(ticket.montoRecibidoCentavos)} />
            <Fila izquierda="Vuelto" derecha={formatearCentavos(ticket.vueltoCentavos)} />
          </>
        )}
        {ticket.anuladoCentavos > 0 && (
          <Fila
            izquierda="Devuelto (anulación)"
            derecha={`-${formatearCentavos(ticket.anuladoCentavos)}`}
          />
        )}

        <Separador />

        <footer className="text-center">
          <p>¡Gracias por su compra!</p>
          {ticket.tienda.mensajeTicket && <p className="mt-1">{ticket.tienda.mensajeTicket}</p>}
          <p className="mt-1 text-[0.85em]">Este ticket no reemplaza a la factura.</p>
        </footer>
      </article>
    </div>
  );
}

export default function TicketPage() {
  return (
    <RutaProtegida>
      <ContenidoTicket />
    </RutaProtegida>
  );
}
