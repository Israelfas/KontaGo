'use client';

import { useState } from 'react';
import { useSinConexion } from '@/lib/sin-conexion';
import { formatearCentavos } from '@/lib/formato';
import { Button } from './ui';
import { AlertIcon, RefreshIcon } from './icons';
import { Ventana, VentanaPie, useVentana } from './ventana';

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

const ventas = (n: number) => `${n} venta${n === 1 ? '' : 's'}`;

/**
 * Arriba de la caja: si no hay conexión, si hay ventas guardadas que
 * todavía no llegaron al servidor, y las que el servidor rechazó (con qué
 * hacer con cada una). Sin nada de eso, no ocupa lugar.
 */
export function AvisoSinConexion() {
  const { sinConexion, pendientes, enviando, catalogo, enviarPendientes } = useSinConexion();
  const [viendoProblemas, setViendoProblemas] = useState(false);

  const porMandar = pendientes.filter((v) => !v.problema).length;
  const conProblema = pendientes.filter((v) => v.problema).length;
  // Con la lista abierta se queda aunque ya no quede nada: se cierra con Listo.
  if (!sinConexion && porMandar === 0 && conProblema === 0 && !viendoProblemas) return null;

  return (
    <div className="mb-4 space-y-2">
      {(sinConexion || porMandar > 0) && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-ambar/35 bg-ambar/10 px-3.5 py-3"
        >
          <RefreshIcon
            className={`h-4 w-4 shrink-0 text-[#9a5b08] ${enviando ? 'animate-spin' : ''}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#9a5b08]">
              {sinConexion
                ? 'Sin conexión · puedes seguir vendiendo'
                : `Enviando ${ventas(porMandar)}…`}
            </p>
            <p className="text-xs text-tinta-suave">
              {sinConexion
                ? `${
                    porMandar > 0
                      ? `${ventas(porMandar)} guardada${porMandar === 1 ? '' : 's'}; se envían solas al volver internet. `
                      : ''
                  }Productos del catálogo guardado${catalogo ? ` a las ${hora(catalogo.guardadoEn)}` : ''}.`
                : 'Las que se cobraron sin conexión.'}
            </p>
          </div>
          {sinConexion && porMandar > 0 && !enviando && (
            <button
              type="button"
              onClick={() => void enviarPendientes()}
              className="text-sm font-semibold text-tinta underline"
            >
              Probar
            </button>
          )}
        </div>
      )}

      {conProblema > 0 && (
        <button
          type="button"
          onClick={() => setViendoProblemas(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-rojo-perdida/30 bg-rojo-perdida/5 px-3.5 py-3 text-left transition-opacity hover:opacity-80"
        >
          <AlertIcon className="h-4 w-4 shrink-0 text-rojo-perdida" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-rojo-perdida">
              {ventas(conProblema)} no se pudo enviar
            </span>
            <span className="block text-xs text-tinta-suave">
              Haz clic para ver qué pasó y decidir.
            </span>
          </span>
        </button>
      )}

      {viendoProblemas && (
        <Ventana
          titulo="Ventas sin enviar"
          descripcion="El servidor no las aceptó. Corrige lo que dice cada una y reintenta, o descártala si no se cobró."
          icono={<AlertIcon className="h-5 w-5" />}
          tono="rojo"
          onCerrar={() => setViendoProblemas(false)}
        >
          <ListaDeProblemas />
        </Ventana>
      )}
    </div>
  );
}

function ListaDeProblemas() {
  const { pendientes, reintentar, descartar } = useSinConexion();
  const { cerrar } = useVentana();
  const conProblema = pendientes.filter((v) => v.problema);

  function confirmarDescarte(clave: string, total: number) {
    if (
      window.confirm(
        `La venta de ${formatearCentavos(total)} no se va a registrar. Hazlo solo si no se cobró.`,
      )
    ) {
      descartar(clave);
    }
  }

  return (
    <>
      <div className="space-y-2">
        {conProblema.length === 0 && (
          <p className="text-sm text-tinta-suave">Ya no queda ninguna.</p>
        )}
        {conProblema.map((venta) => (
          <div key={venta.clave} className="rounded-xl border border-papel-linea p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-ticket text-lg font-semibold text-tinta">
                {formatearCentavos(venta.totalCentavos)}
              </p>
              <p className="text-xs text-tinta-suave">Cobrada a las {hora(venta.vendidaEn)}</p>
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-tinta-suave">
              {venta.items
                .map((i) => `${i.cantidad.toLocaleString('es-EC')} × ${i.nombre}`)
                .join(', ')}
            </p>
            <p className="mt-1.5 text-sm font-medium text-rojo-perdida">{venta.problema}</p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => reintentar(venta.clave)}
              >
                Reintentar
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => confirmarDescarte(venta.clave, venta.totalCentavos)}
              >
                Descartar
              </Button>
            </div>
          </div>
        ))}
      </div>
      <VentanaPie>
        <Button variant="ghost" onClick={cerrar}>
          Listo
        </Button>
      </VentanaPie>
    </>
  );
}
