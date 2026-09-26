import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import { BarraQueCrece, FRENAR, useMovimientoReducido } from './movimiento';
import { colores, espaciado, radios } from '../theme/colores';
import { formatearCentavos } from '../lib/formato';
import { aFecha, fechaLarga } from '../lib/periodo';
import type { ProductoVendido, PuntoSerie } from '../lib/tipos';
import { formatearCantidad, porPeso } from '../lib/cantidad';
import { COLOR_PAGO } from './metodo-pago';

/**
 * Gráficos del resumen, en SVG (react-native-svg), con las mismas reglas
 * que la web (web/src/components/graficos.tsx):
 * - Una sola serie por gráfico → un solo color (el ámbar de la marca). El
 *   degradado es de relleno (se desvanece hacia abajo), nunca por valor.
 * - La rejilla tenue y por detrás del dato.
 * - Cada punto se puede tocar para leer su valor exacto.
 * - Con "Reducir movimiento" no hay animaciones.
 */

interface Punto {
  x: number;
  y: number;
}

/**
 * Curva suave que pasa por todos los puntos sin inventar picos ni valles
 * (interpolación monótona): entre dos horas no aparece un valor más alto
 * que ambas, ni uno negativo.
 */
function curvaSuave(p: Punto[]): string {
  const n = p.length;
  const f = (v: number) => Math.round(v * 10) / 10;
  if (n === 0) return '';
  if (n === 1) return `M${f(p[0].x)},${f(p[0].y)}`;
  const pendiente: number[] = [];
  for (let i = 0; i < n - 1; i++) pendiente.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x));
  const m: number[] = new Array(n);
  m[0] = pendiente[0];
  m[n - 1] = pendiente[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = pendiente[i - 1] * pendiente[i] <= 0 ? 0 : (pendiente[i - 1] + pendiente[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (pendiente[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / pendiente[i];
    const b = m[i + 1] / pendiente[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * pendiente[i];
      m[i + 1] = t * b * pendiente[i];
    }
  }
  let camino = `M${f(p[0].x)},${f(p[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1].x - p[i].x) / 3;
    camino += ` C${f(p[i].x + h)},${f(p[i].y + m[i] * h)} ${f(p[i + 1].x - h)},${f(
      p[i + 1].y - m[i + 1] * h,
    )} ${f(p[i + 1].x)},${f(p[i + 1].y)}`;
  }
  return camino;
}

/** Escala "linda" para el eje: 1, 2, 2,5 o 5 × potencia de 10. */
function techoRedondo(valor: number): number {
  if (valor <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(valor)));
  for (const paso of [1, 2, 2.5, 5, 10]) if (valor <= paso * exp) return paso * exp;
  return 10 * exp;
}

function textos(punto: PuntoSerie, agrupadoPor: 'hora' | 'dia', muchos: boolean) {
  if (agrupadoPor === 'hora') {
    return {
      eje: `${punto.etiqueta}h`,
      corto: `${punto.etiqueta}h`,
      detalle: `${punto.etiqueta}:00 a ${punto.etiqueta}:59`,
    };
  }
  const fecha = aFecha(punto.etiqueta);
  const conSemana = `${fecha.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '')} ${fecha.getDate()}`;
  return {
    eje: muchos ? String(fecha.getDate()) : conSemana,
    corto: conSemana,
    detalle: fechaLarga(punto.etiqueta),
  };
}

/** El ancho que tiene el lugar, para dibujar a escala 1:1. */
function useAncho(inicial = 300) {
  const [ancho, setAncho] = useState(inicial);
  return [ancho, (e: { nativeEvent: { layout: { width: number } } }) => setAncho(e.nativeEvent.layout.width)] as const;
}

/** Lo dibujado aparece de izquierda a derecha (se destapa, no se estira). */
function Revelar({ ancho, children }: { ancho: number; children: ReactNode }) {
  const reducido = useMovimientoReducido();
  const progreso = useRef(new Animated.Value(reducido ? 1 : 0)).current;
  useEffect(() => {
    if (reducido) {
      progreso.setValue(1);
      return;
    }
    const animacion = Animated.timing(progreso, {
      toValue: 1,
      duration: 1100,
      delay: 250,
      easing: FRENAR,
      useNativeDriver: false,
    });
    animacion.start();
    return () => animacion.stop();
  }, [progreso, reducido]);
  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        width: progreso.interpolate({ inputRange: [0, 1], outputRange: [0, ancho] }),
      }}
    >
      <View style={{ width: ancho }}>{children}</View>
    </Animated.View>
  );
}

/** La tarjeta oscura del gráfico principal (como la franja de arriba). */
export function TarjetaOscura({ children }: { children: ReactNode }) {
  return (
    <View style={styles.oscura}>
      <View pointerEvents="none" style={styles.oscuraResplandor} />
      <View pointerEvents="none" style={styles.oscuraResplandorVerde} />
      {children}
    </View>
  );
}

function DatoDelGrafico({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

const ALTO = 170;
const MARGEN = { arriba: 26, abajo: 6, izquierda: 38, derecha: 10 };

/**
 * Lo cobrado a lo largo del período: por hora si es un día, por día si es
 * un rango. Va dentro de <TarjetaOscura>.
 */
export function GraficoIngreso({
  datos,
  agrupadoPor,
  titulo,
}: {
  datos: PuntoSerie[];
  agrupadoPor: 'hora' | 'dia';
  titulo: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const [ancho, alMedir] = useAncho();
  const idGradiente = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;

  const encabezado = (
    <View>
      <Text style={styles.oscuraTitulo}>{titulo}</Text>
      <Text style={styles.oscuraSubtitulo}>Lo cobrado, ya descontado lo anulado</Text>
    </View>
  );

  // Un rango sin ventas llega con todos los días en 0.
  if (datos.length === 0 || datos.every((d) => d.centavos === 0)) {
    return (
      <>
        {encabezado}
        <Text style={styles.oscuraVacio}>Todavía no hay ventas para graficar.</Text>
      </>
    );
  }

  const maximo = Math.max(...datos.map((d) => d.centavos));
  const techo = techoRedondo(maximo);
  const indiceMaximo = datos.findIndex((d) => d.centavos === maximo);
  const muchos = datos.length > 10;
  const etiquetas = datos.map((d) => textos(d, agrupadoPor, muchos));
  const salto = Math.ceil(datos.length / (agrupadoPor === 'dia' && !muchos ? 7 : 5));
  const conVentas = datos.filter((d) => d.centavos > 0);
  const promedio = Math.round(conVentas.reduce((a, d) => a + d.centavos, 0) / conVentas.length);
  // El punto tocado puede no existir más si cambió el período.
  const elegido = activo !== null && activo < datos.length ? activo : null;

  const anchoTrazado = Math.max(40, ancho - MARGEN.izquierda - MARGEN.derecha);
  const altoTrazado = ALTO - MARGEN.arriba - MARGEN.abajo;
  const base = MARGEN.arriba + altoTrazado;
  const banda = anchoTrazado / datos.length;
  const puntos = datos.map((d, i) => ({
    x: MARGEN.izquierda + banda * (i + 0.5),
    y: base - (d.centavos / techo) * altoTrazado,
  }));
  const linea = curvaSuave(puntos);
  const area =
    puntos.length > 1
      ? `${linea} L${puntos[puntos.length - 1].x},${base} L${puntos[0].x},${base} Z`
      : '';
  const pico = puntos[indiceMaximo];
  const xPico = Math.min(Math.max(pico.x, MARGEN.izquierda + 30), ancho - 32);
  const mostrado = elegido ?? indiceMaximo;

  return (
    <>
      <View style={styles.oscuraCabecera}>
        {encabezado}
        <View style={styles.datosFila}>
          <DatoDelGrafico
            etiqueta={agrupadoPor === 'hora' ? 'Hora pico' : 'Mejor día'}
            valor={etiquetas[indiceMaximo].corto}
          />
          <DatoDelGrafico
            etiqueta={agrupadoPor === 'hora' ? 'Promedio por hora' : 'Promedio por día'}
            valor={formatearCentavos(promedio)}
          />
        </View>
      </View>

      {/* Lo que dice el punto tocado (o el más alto, de entrada). */}
      <Text style={styles.lectura}>
        <Text style={styles.lecturaValor}>{formatearCentavos(datos[mostrado].centavos)}</Text>
        {'  '}
        {etiquetas[mostrado].detalle}
        {elegido === null ? ' · el más alto' : ''}
      </Text>

      <View onLayout={alMedir} style={{ marginTop: espaciado.sm }}>
        <Revelar ancho={ancho}>
          <Svg width={ancho} height={ALTO}>
            <Defs>
              <LinearGradient id={`${idGradiente}a`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#f2a93b" stopOpacity={0.5} />
                <Stop offset="0.6" stopColor="#d98c2b" stopOpacity={0.12} />
                <Stop offset="1" stopColor="#d98c2b" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id={`${idGradiente}l`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#e8943a" />
                <Stop offset="1" stopColor="#ffd08a" />
              </LinearGradient>
            </Defs>

            {[0, 0.5, 1].map((f) => {
              const y = base - altoTrazado * f;
              return (
                <G key={f}>
                  <Line
                    x1={MARGEN.izquierda}
                    x2={ancho - MARGEN.derecha}
                    y1={y}
                    y2={y}
                    stroke="rgba(246,243,236,0.1)"
                    strokeWidth={1}
                    strokeDasharray={f === 0 ? undefined : '3 5'}
                  />
                </G>
              );
            })}

            {puntos.length > 1 ? (
              <>
                <Path d={area} fill={`url(#${idGradiente}a)`} />
                {/* Un trazo ancho y translúcido debajo hace de brillo. */}
                <Path
                  d={linea}
                  fill="none"
                  stroke="#f2a93b"
                  strokeOpacity={0.25}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={linea}
                  fill="none"
                  stroke={`url(#${idGradiente}l)`}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              <Rect
                x={pico.x - 12}
                y={pico.y}
                width={24}
                height={Math.max(0, base - pico.y)}
                rx={7}
                fill={`url(#${idGradiente}a)`}
              />
            )}

            {datos.length <= 31 &&
              puntos.map((p, i) => (
                <Circle key={datos[i].etiqueta} cx={p.x} cy={p.y} r={2.5} fill="#ffd08a" opacity={0.7} />
              ))}

            {elegido !== null && (
              <Line
                x1={puntos[elegido].x}
                x2={puntos[elegido].x}
                y1={MARGEN.arriba - 6}
                y2={base}
                stroke="rgba(255,208,138,0.55)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}

            {/* El pico, con su monto. */}
            <Circle cx={pico.x} cy={pico.y} r={10} fill="#f2a93b" opacity={0.22} />
            <Circle cx={pico.x} cy={pico.y} r={5.5} fill="#ffd08a" stroke="#16232f" strokeWidth={2.5} />
            {elegido === null && (
              <G>
                <Rect x={xPico - 30} y={pico.y - 28} width={60} height={18} rx={9} fill="#ffd08a" />
              </G>
            )}
            {elegido !== null && (
              <Circle
                cx={puntos[elegido].x}
                cy={puntos[elegido].y}
                r={6}
                fill="#fffdf8"
                stroke="#f2a93b"
                strokeWidth={3}
              />
            )}
          </Svg>
          {/* El texto de la etiqueta del pico, encima del dibujo. */}
          {elegido === null && (
            <Text style={[styles.picoTexto, { left: xPico - 30, top: pico.y - 27 }]}>
              {formatearCentavos(maximo)}
            </Text>
          )}
          <Text style={[styles.ejeY, { top: MARGEN.arriba - 7 }]}>
            {formatearCentavos(techo).replace(',00', '')}
          </Text>
          <Text style={[styles.ejeY, { top: base - altoTrazado / 2 - 7 }]}>
            {formatearCentavos(techo / 2).replace(',00', '')}
          </Text>
          <Text style={[styles.ejeY, { top: base - 7 }]}>$0</Text>
        </Revelar>

        {/* Zonas para tocar cada punto. */}
        <View style={[styles.toques, { left: MARGEN.izquierda, width: anchoTrazado }]}>
          {datos.map((d, i) => (
            <Pressable
              key={d.etiqueta}
              style={{ flex: 1 }}
              onPress={() => setActivo(i === elegido ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${etiquetas[i].detalle}: ${formatearCentavos(d.centavos)}`}
            />
          ))}
        </View>

        <View style={[styles.eje, { marginLeft: 0 }]}>
          {datos.map((d, i) =>
            i % salto === 0 ? (
              <Text
                key={d.etiqueta}
                numberOfLines={1}
                style={[
                  styles.ejeTexto,
                  { left: puntos[i].x - 24 },
                  elegido === i && { color: colores.papel },
                ]}
              >
                {etiquetas[i].eje}
              </Text>
            ) : null,
          )}
        </View>
      </View>
    </>
  );
}

/** Mini curva para una tarjeta: la forma del período, sin ejes. */
export function Sparkline({ datos }: { datos: number[] }) {
  const [ancho, alMedir] = useAncho(120);
  const idGradiente = useRef(`s${Math.random().toString(36).slice(2, 8)}`).current;
  if (datos.length < 2) return null;
  const alto = 34;
  const maximo = Math.max(...datos, 1);
  const puntos = datos.map((v, i) => ({
    x: 2 + (i / (datos.length - 1)) * (ancho - 4),
    y: alto - 3 - (v / maximo) * (alto - 8),
  }));
  const linea = curvaSuave(puntos);
  return (
    <View onLayout={alMedir} style={{ marginTop: espaciado.sm }} accessible={false}>
      <Revelar ancho={ancho}>
        <Svg width={ancho} height={alto}>
          <Defs>
            <LinearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#d98c2b" stopOpacity={0.32} />
              <Stop offset="1" stopColor="#d98c2b" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={`${linea} L${ancho - 2},${alto} L2,${alto} Z`} fill={`url(#${idGradiente})`} />
          <Path d={linea} fill="none" stroke="#b06f1c" strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Revelar>
    </View>
  );
}

/** Anillo chico con un porcentaje (qué parte de lo cobrado es IVA…). */
export function Anillo({
  porcentaje,
  color,
  etiqueta,
}: {
  porcentaje: number;
  color: string;
  etiqueta: string;
}) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  const texto = valor > 0 && valor < 1 ? '<1%' : `${Math.round(valor)}%`;
  const r = 15;
  const vuelta = 2 * Math.PI * r;
  return (
    <View style={styles.anillo} accessible accessibilityLabel={`${etiqueta}: ${texto}`}>
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={r} fill="none" stroke={colores.papelLinea} strokeWidth={4.5} />
        {valor > 0 && (
          <Circle
            cx={20}
            cy={20}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(valor, 2) / 100) * vuelta} ${vuelta}`}
            rotation={-90}
            origin="20, 20"
          />
        )}
      </Svg>
      <Text style={styles.anilloTexto}>{texto}</Text>
    </View>
  );
}

/** Ranking de lo más vendido: puesto, barra de unidades y lo cobrado. */
export function GraficoTopProductos({ datos }: { datos: ProductoVendido[] }) {
  if (datos.length === 0) {
    return <Text style={styles.vacio}>Todavía no hay ventas para graficar.</Text>;
  }
  const maximo = Math.max(...datos.map((d) => d.unidades));
  return (
    <View style={{ gap: espaciado.md }}>
      {datos.map((d, i) => (
        <View
          key={d.nombre}
          style={styles.topFila}
          accessible
          accessibilityLabel={`Puesto ${i + 1}: ${d.nombre}, ${
            porPeso(d.unidad) ? formatearCantidad(d.unidades, d.unidad) : `${d.unidades} unidades`
          }, ${formatearCentavos(d.centavos)}`}
        >
          <View style={[styles.puesto, PUESTOS[Math.min(i, 3)].caja]}>
            <Text style={[styles.puestoTexto, PUESTOS[Math.min(i, 3)].texto]}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.topCabecera}>
              <Text style={styles.topNombre} numberOfLines={1}>
                {d.nombre}
              </Text>
              <Text style={styles.topMonto}>{formatearCentavos(d.centavos)}</Text>
            </View>
            <View style={styles.topPista}>
              <BarraQueCrece
                horizontal
                orden={i}
                style={[styles.topRelleno, { width: `${Math.max(3, (d.unidades / maximo) * 100)}%` }]}
              />
            </View>
          </View>
          <View style={styles.topUnidades}>
            <Text style={styles.topUnidadesValor}>{formatearCantidad(d.unidades, d.unidad)}</Text>
            <Text style={styles.topUnidadesNota}>
              {porPeso(d.unidad) ? 'vendidas' : d.unidades === 1 ? 'unidad' : 'unidades'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const PUESTOS = [
  { caja: { backgroundColor: '#e39a3b' }, texto: { color: '#fff' } },
  { caja: { backgroundColor: colores.tinta }, texto: { color: colores.papel } },
  { caja: { backgroundColor: 'rgba(217,140,43,0.16)' }, texto: { color: '#9a5f14' } },
  { caja: { borderWidth: 1, borderColor: colores.papelLinea }, texto: { color: colores.tintaSuave } },
];

/** Dona con lo vendido según cómo se pagó. */
export function GraficoPagos({
  efectivoCentavos,
  transferenciaCentavos,
  fiadoCentavos,
}: {
  efectivoCentavos: number;
  transferenciaCentavos: number;
  fiadoCentavos: number;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const total = efectivoCentavos + transferenciaCentavos + fiadoCentavos;
  if (total <= 0) return <Text style={styles.vacio}>Todavía no hay ventas para graficar.</Text>;

  const segmentos = (
    [
      { clave: 'efectivo', centavos: efectivoCentavos, nota: null },
      { clave: 'transferencia', centavos: transferenciaCentavos, nota: null },
      { clave: 'fiado', centavos: fiadoCentavos, nota: 'por cobrar' },
    ] as const
  ).map((s) => ({ ...s, ...COLOR_PAGO[s.clave], porcentaje: (s.centavos / total) * 100 }));
  const conMonto = segmentos
    .filter((s) => s.centavos > 0)
    .map((s, i, lista) => ({
      ...s,
      desde: lista.slice(0, i).reduce((a, previa) => a + previa.porcentaje, 0),
    }));
  const activo = conMonto.find((s) => s.clave === elegido) ?? null;
  const r = 46;
  const vuelta = 2 * Math.PI * r;
  const hueco = conMonto.length > 1 ? 1.4 : 0;
  const porcentajeTexto = (p: number) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);

  return (
    <View style={styles.pagos}>
      <View style={styles.dona}>
        <Svg width={150} height={150} viewBox="0 0 120 120">
          <Circle cx={60} cy={60} r={r} fill="none" stroke={colores.papelLinea} strokeWidth={14} />
          <G rotation={-90} origin="60, 60">
            {conMonto.map((s) => {
              const largo = (Math.max(0.5, s.porcentaje - hueco) / 100) * vuelta;
              return (
                <Circle
                  key={s.clave}
                  cx={60}
                  cy={60}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={activo?.clave === s.clave ? 18 : 14}
                  strokeDasharray={`${largo} ${vuelta}`}
                  strokeDashoffset={-(s.desde / 100) * vuelta}
                  opacity={activo && activo.clave !== s.clave ? 0.35 : 1}
                  onPress={() => setElegido(s.clave === elegido ? null : s.clave)}
                />
              );
            })}
          </G>
        </Svg>
        <View pointerEvents="none" style={styles.donaCentro}>
          <Text style={styles.donaEtiqueta}>{activo ? activo.nombre : 'Vendido'}</Text>
          <Text style={styles.donaValor}>{formatearCentavos(activo ? activo.centavos : total)}</Text>
          {activo && <Text style={styles.donaNota}>{porcentajeTexto(activo.porcentaje)}</Text>}
        </View>
      </View>

      <View style={{ gap: espaciado.xs }}>
        {segmentos.map((s, i) => (
          <Pressable
            key={s.clave}
            disabled={s.centavos === 0}
            onPress={() => setElegido(s.clave === elegido ? null : s.clave)}
            style={[
              styles.pagoFila,
              activo?.clave === s.clave && styles.pagoFilaActiva,
              s.centavos === 0 && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${s.nombre}: ${formatearCentavos(s.centavos)}, ${porcentajeTexto(s.porcentaje)}`}
          >
            <View style={[styles.pagoPunto, { backgroundColor: s.color }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.topCabecera}>
                <Text style={styles.pagoNombre} numberOfLines={1}>
                  {s.nombre}
                  {s.nota ? <Text style={styles.pagoNota}> {s.nota}</Text> : null}
                </Text>
                <Text style={styles.pagoMonto}>{formatearCentavos(s.centavos)}</Text>
              </View>
              <View style={styles.pagoBarraFila}>
                <View style={styles.pagoPista}>
                  <BarraQueCrece
                    horizontal
                    orden={i}
                    style={[styles.pagoRelleno, { width: `${s.porcentaje}%`, backgroundColor: s.color }]}
                  />
                </View>
                <Text style={styles.pagoPorcentaje}>{porcentajeTexto(s.porcentaje)}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { fontSize: 13, color: colores.tintaSuave },

  oscura: {
    overflow: 'hidden',
    borderRadius: radios.lg,
    backgroundColor: '#1d3041',
    padding: espaciado.md + 2,
  },
  oscuraResplandor: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(242,169,59,0.09)',
  },
  oscuraResplandorVerde: {
    position: 'absolute',
    bottom: -110,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: 'rgba(47,111,79,0.14)',
  },
  oscuraCabecera: { gap: espaciado.sm },
  oscuraTitulo: {
    color: 'rgba(246,243,236,0.72)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  oscuraSubtitulo: { marginTop: 2, color: 'rgba(246,243,236,0.58)', fontSize: 12 },
  oscuraVacio: { marginTop: espaciado.lg, color: 'rgba(246,243,236,0.75)', fontSize: 13 },
  datosFila: { flexDirection: 'row', gap: espaciado.sm },
  dato: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radios.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: espaciado.md,
    paddingVertical: 6,
  },
  datoEtiqueta: {
    color: 'rgba(246,243,236,0.6)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  datoValor: { marginTop: 1, color: '#ffd08a', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lectura: { marginTop: espaciado.md, color: 'rgba(246,243,236,0.7)', fontSize: 12 },
  lecturaValor: { color: colores.papel, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  picoTexto: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    color: colores.tinta,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  ejeY: {
    position: 'absolute',
    left: 0,
    width: MARGEN.izquierda - 6,
    textAlign: 'right',
    color: 'rgba(246,243,236,0.5)',
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
  },
  toques: { position: 'absolute', top: 0, height: ALTO, flexDirection: 'row' },
  eje: { height: 16, marginTop: 4 },
  ejeTexto: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    fontSize: 10,
    color: 'rgba(246,243,236,0.55)',
  },

  anillo: { width: 40, height: 40, marginTop: -6, marginRight: -4 },
  anilloTexto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 40,
    color: colores.tinta,
    fontSize: 10,
    fontWeight: '800',
  },

  topFila: { flexDirection: 'row', alignItems: 'center', gap: espaciado.md },
  puesto: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  puestoTexto: { fontSize: 12, fontWeight: '800' },
  topCabecera: { flexDirection: 'row', alignItems: 'baseline', gap: espaciado.sm },
  topNombre: { flex: 1, fontSize: 13, fontWeight: '600', color: colores.tinta },
  topMonto: { fontSize: 11, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  topPista: {
    height: 7,
    marginTop: 5,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(28,43,58,0.07)',
  },
  topRelleno: { height: '100%', borderRadius: 999, backgroundColor: '#d98c2b' },
  topUnidades: { minWidth: 48, alignItems: 'flex-end' },
  topUnidadesValor: { fontSize: 13, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  topUnidadesNota: { fontSize: 10, color: colores.tintaSuave },

  pagos: { gap: espaciado.md },
  dona: { alignSelf: 'center', width: 150, height: 150 },
  donaCentro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donaEtiqueta: {
    color: colores.tintaSuave,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  donaValor: { color: colores.tinta, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  donaNota: { color: colores.tintaSuave, fontSize: 11 },
  pagoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.md,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radios.md,
    paddingHorizontal: espaciado.sm,
    paddingVertical: espaciado.sm,
  },
  pagoFilaActiva: { borderColor: colores.papelLinea, backgroundColor: colores.superficieSuave },
  pagoPunto: { width: 10, height: 10, borderRadius: 999 },
  pagoNombre: { flex: 1, fontSize: 13, fontWeight: '600', color: colores.tinta },
  pagoNota: { fontSize: 11, fontWeight: '400', color: colores.tintaSuave },
  pagoMonto: { fontSize: 13, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  pagoBarraFila: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm, marginTop: 5 },
  pagoPista: {
    flex: 1,
    height: 5,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(28,43,58,0.07)',
  },
  pagoRelleno: { height: '100%', borderRadius: 999 },
  pagoPorcentaje: { width: 34, textAlign: 'right', fontSize: 11, color: colores.tintaSuave },
});
