'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RutaProtegida } from '@/components/ruta-protegida';
import { Nav } from '@/components/nav';
import { Button, ErrorState, LoadingState } from '@/components/ui';
import { Banda, Hoja, Pieza } from '@/components/banda';
import { CartIcon, CashIcon, ReceiptIcon } from '@/components/icons';
import { SelectorPeriodo, usePeriodoDeLaURL } from '@/components/selector-periodo';
import { BotonExcel } from '@/components/boton-excel';
import {
  Anillo,
  GraficoIngreso,
  GraficoPagos,
  GraficoTopProductos,
  Sparkline,
} from '@/components/graficos';
import { useAuth } from '@/lib/auth-context';
import { obtenerResumen, ApiError } from '@/lib/api';
import { formatearCentavos } from '@/lib/formato';
import {
  busquedaDelPeriodo,
  esHoy,
  fechaLarga,
  hoyISO,
  nombreDelPeriodo,
  periodoAnterior,
  rangoLegible,
  type Periodo,
} from '@/lib/periodo';
import type { ResumenPeriodo } from '@/lib/tipos';

/** "de hoy", "de los últimos 7 días"… para completar frases. */
function delPeriodo(p: Periodo): string {
  switch (p.clave) {
    case 'hoy':
      return 'de hoy';
    case 'ayer':
      return 'de ayer';
    case 'semana':
      return 'de los últimos 7 días';
    case 'mes':
      return 'de este mes';
    case 'mes-pasado':
      return 'del mes pasado';
    case 'elegido':
      return 'del período';
  }
}

/** "↑ 12 % frente a los 7 días anteriores", o null si no hay con qué comparar. */
function comparacion(actual: ResumenPeriodo, anterior: ResumenPeriodo | null): string | null {
  if (!anterior || anterior.gananciaCentavos <= 0) return null;
  const cambio = Math.round(
    ((actual.gananciaCentavos - anterior.gananciaCentavos) / anterior.gananciaCentavos) * 100,
  );
  const contra = actual.dias === 1 ? 'el día anterior' : `los ${actual.dias} días anteriores`;
  if (cambio === 0) return `Igual que ${contra}.`;
  // "frente a el" → "frente al"
  return `${cambio > 0 ? '↑' : '↓'} ${Math.abs(cambio)} % frente a ${contra}.`.replace(
    ' a el ',
    ' al ',
  );
}

function ContenidoDashboard() {
  const { token } = useAuth();
  const [periodo, setPeriodo] = usePeriodoDeLaURL();
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [anterior, setAnterior] = useState<ResumenPeriodo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!token || !periodo) return;
    // Si se cambia de período antes de que llegue la respuesta anterior,
    // esa respuesta ya no sirve: no tiene que pisar a la nueva.
    let vigente = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerResumen(token, periodo),
      // Hoy todavía no terminó: compararlo con un día completo engaña.
      esHoy(periodo) ? Promise.resolve(null) : obtenerResumen(token, periodoAnterior(periodo)),
    ])
      .then(([actual, previo]) => {
        if (!vigente) return;
        setResumen(actual);
        setAnterior(previo);
      })
      .catch((err) => {
        if (vigente)
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [token, periodo, intento]);

  const hoy = periodo ? esHoy(periodo) : true;
  const fechaDeHoy = fechaLarga(hoyISO());
  const ticketPromedioCentavos =
    resumen && resumen.cantidadVentas > 0
      ? Math.round(resumen.ingresoBrutoCentavos / resumen.cantidadVentas)
      : 0;
  const margenPorcentaje =
    resumen && resumen.ingresoBrutoCentavos > 0
      ? Math.round((resumen.gananciaCentavos / resumen.ingresoBrutoCentavos) * 100)
      : 0;
  // El promedio por día cuenta solo los días en que se vendió: un día
  // cerrado (o antes de empezar a usar KontaGo) no es un día flojo.
  const diasConVentas =
    resumen?.agrupadoPor === 'dia' ? resumen.serie.filter((p) => p.centavos > 0).length : 1;
  const enlaceVentas = `/ventas${periodo ? busquedaDelPeriodo(periodo) : ''}`;
  // Qué parte de lo cobrado es IVA, y qué parte de lo que se había vendido
  // se anuló (lo cobrado ya viene sin lo anulado).
  const ivaPorcentaje =
    resumen && resumen.ingresoBrutoCentavos > 0
      ? (resumen.ivaCentavos / resumen.ingresoBrutoCentavos) * 100
      : 0;
  const vendidoAntesDeAnular = resumen ? resumen.ingresoBrutoCentavos + resumen.anuladoCentavos : 0;
  const anuladoPorcentaje =
    resumen && vendidoAntesDeAnular > 0
      ? (resumen.anuladoCentavos / vendidoAntesDeAnular) * 100
      : 0;
  const frente = resumen ? comparacion(resumen, anterior) : null;

  return (
    <div>
      <Banda
        eyebrow={
          !periodo || hoy
            ? fechaDeHoy[0].toUpperCase() + fechaDeHoy.slice(1)
            : `Resumen · ${rangoLegible(periodo)}`
        }
        titulo={!periodo || hoy ? 'Resumen del día' : nombreDelPeriodo(periodo)}
        valor={resumen ? formatearCentavos(resumen.gananciaCentavos) : undefined}
        detalle={
          resumen && periodo
            ? resumen.cantidadVentas > 0
              ? `Ganancia real ${delPeriodo(periodo)} · tu margen es el ${margenPorcentaje}% de lo vendido, ya descontados costos e IVA.${frente ? ` ${frente}` : ''}`
              : hoy
                ? 'Ganancia real de hoy. Todavía no registraste ninguna venta.'
                : `No hubo ventas en ${rangoLegible(periodo)}.`
            : undefined
        }
        accion={
          <div className="flex items-center gap-2">
            {periodo && <BotonExcel periodo={periodo} />}
            <Link href="/venta" className="button button-claro">
              <CartIcon className="h-4 w-4" />
              Vender
            </Link>
          </div>
        }
        extra={periodo && <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />}
      />

      <Hoja>
        {cargando && !resumen && <LoadingState label="Cargando resumen…" />}

        {error && !cargando && (
          <ErrorState
            action={
              <Button variant="secondary" onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </Button>
            }
          >
            {error}
          </ErrorState>
        )}

        {resumen && periodo && !error && (
          <div
            className={`space-y-3 transition-opacity md:space-y-4 ${cargando ? 'opacity-60' : ''}`}
            aria-busy={cargando}
          >
            <div className="mosaico">
              <Pieza
                etiqueta="Ingreso bruto"
                valor={formatearCentavos(resumen.ingresoBrutoCentavos)}
                adorno={
                  <span className="pieza-icono" aria-hidden>
                    <CashIcon className="h-4 w-4" />
                  </span>
                }
                detalle={
                  <>
                    <Link href={enlaceVentas} className="font-medium text-tinta underline">
                      {resumen.cantidadVentas} venta{resumen.cantidadVentas === 1 ? '' : 's'}
                    </Link>
                    {diasConVentas > 1 &&
                      ` · ${formatearCentavos(Math.round(resumen.ingresoBrutoCentavos / diasConVentas))} por día${diasConVentas < resumen.dias ? ' con ventas' : ''}`}
                  </>
                }
              >
                <Sparkline
                  datos={resumen.serie.map((p) => p.centavos)}
                  etiqueta={
                    resumen.agrupadoPor === 'hora'
                      ? 'Cómo se repartió lo cobrado durante el día'
                      : 'Cómo se repartió lo cobrado en el período'
                  }
                />
              </Pieza>
              <Pieza
                etiqueta="Ticket promedio"
                valor={formatearCentavos(ticketPromedioCentavos)}
                adorno={
                  <span className="pieza-icono" aria-hidden>
                    <ReceiptIcon className="h-4 w-4" />
                  </span>
                }
                detalle={`Lo que gasta cada cliente, en ${resumen.cantidadVentas} venta${
                  resumen.cantidadVentas === 1 ? '' : 's'
                }`}
              />
              <Pieza
                etiqueta="IVA incluido"
                valor={formatearCentavos(resumen.ivaCentavos)}
                adorno={
                  <Anillo
                    porcentaje={ivaPorcentaje}
                    color="#2f8fb0"
                    etiqueta="Parte de lo cobrado que es IVA"
                  />
                }
                detalle="De lo cobrado · para tu declaración al SRI"
              />
              <Pieza
                etiqueta={hoy ? 'Anulado hoy' : 'Anulado'}
                valor={formatearCentavos(resumen.anuladoCentavos)}
                tono={resumen.anuladoCentavos > 0 ? 'rojo' : 'neutro'}
                adorno={
                  <Anillo
                    porcentaje={anuladoPorcentaje}
                    color="var(--rojo-perdida)"
                    etiqueta="Parte de lo vendido que se anuló"
                  />
                }
                detalle={
                  resumen.anuladoCentavos > 0 ? (
                    <Link href={enlaceVentas} className="font-medium text-tinta underline">
                      Ya descontado · ver ventas
                    </Link>
                  ) : (
                    'Sin anulaciones'
                  )
                }
              />

              <div className="pieza pieza-completa pieza-oscura">
                <GraficoIngreso
                  datos={resumen.serie}
                  agrupadoPor={resumen.agrupadoPor}
                  titulo={
                    resumen.agrupadoPor === 'hora' ? '¿A qué hora vendes?' : 'Ingreso por día'
                  }
                />
                {resumen.serie.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-papel/65">
                      Ver los datos
                    </summary>
                    <table className="mt-2 w-full text-left text-xs text-papel/90">
                      <thead>
                        <tr className="text-papel/60">
                          <th className="py-1 font-medium">
                            {resumen.agrupadoPor === 'hora' ? 'Hora' : 'Día'}
                          </th>
                          <th className="py-1 text-right font-medium">Cobrado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.serie.map((punto) => (
                          <tr key={punto.etiqueta} className="border-t border-white/10">
                            <td className="py-1">
                              {resumen.agrupadoPor === 'hora'
                                ? `${punto.etiqueta}:00`
                                : fechaLarga(punto.etiqueta)}
                            </td>
                            <td className="py-1 text-right font-ticket">
                              {formatearCentavos(punto.centavos)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>

              <div className="pieza pieza-mitad">
                <p className="pieza-etiqueta">Lo que más sale</p>
                <div className="mt-4">
                  <GraficoTopProductos
                    datos={resumen.topProductos}
                    cuando={hoy ? 'hoy' : rangoLegible(periodo)}
                  />
                </div>
              </div>

              <div className="pieza pieza-mitad">
                <p className="pieza-etiqueta">¿Cómo te pagan?</p>
                <div className="mt-4">
                  <GraficoPagos
                    efectivoCentavos={resumen.efectivoCentavos}
                    transferenciaCentavos={resumen.transferenciaCentavos}
                    fiadoCentavos={resumen.fiadoCentavos}
                  />
                </div>
              </div>
            </div>

            <p className="flex items-start gap-2 text-xs text-tinta-suave">
              <ReceiptIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ambar" />
              La ganancia es el margen (venta − costo) de cada producto vendido, no el ingreso
              bruto.
            </p>
          </div>
        )}
      </Hoja>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RutaProtegida soloAdmin>
      <Nav />
      <ContenidoDashboard />
    </RutaProtegida>
  );
}
