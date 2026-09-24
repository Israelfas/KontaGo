import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import {
  obtenerVentasDeHoy,
  anularVenta,
  listarVentas,
  obtenerResumen,
  ApiError,
} from '../lib/api';
import { formatearCentavos, numeroDeTicket } from '../lib/formato';
import { compartirTicket } from '../lib/ticket-texto';
import {
  esHoy,
  fechaISO,
  fechaLarga,
  hoyISO,
  nombreDelPeriodo,
  periodoDeHoy,
  periodoElegido,
  rangoLegible,
  type Periodo,
} from '../lib/periodo';
import { SelectorPeriodo } from '../components/selector-periodo';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  Boton,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
  estilosCampo,
} from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { PaginaDeVentas, ResumenPeriodo, VentaDelHistorial } from '../lib/tipos';
import { Banda, LabioHoja } from '../components/banda';

const ESTADO: Record<VentaDelHistorial['estado'], { texto: string; color: string; fondo: string }> = {
  completa: { texto: 'Completa', color: colores.verdeGanancia, fondo: 'rgba(47,111,79,0.1)' },
  parcialmente_anulada: { texto: 'Anulada en parte', color: '#9a5b08', fondo: 'rgba(217,140,43,0.14)' },
  anulada: { texto: 'Anulada', color: colores.rojoPerdida, fondo: 'rgba(182,70,47,0.1)' },
};

// De a cuántas ventas se traen en el historial (un mes pasa de mil).
const POR_PAGINA = 50;

/** Día local de una venta, 'AAAA-MM-DD'. */
function diaDe(venta: VentaDelHistorial): string {
  return fechaISO(new Date(venta.createdAt));
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

// Por defecto propone anular todo lo que queda; con − / + se baja la
// cantidad de cada producto para anular solo una parte.
function PanelAnulacion({
  venta,
  onAnulada,
  onCerrar,
}: {
  venta: VentaDelHistorial;
  onAnulada: (v: VentaDelHistorial) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
  const pendientes = venta.items
    .map((item) => ({ ...item, pendiente: item.cantidad - item.cantidadAnulada }))
    .filter((item) => item.pendiente > 0);
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(pendientes.map((item) => [item.id, item.pendiente])),
  );
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aDevolverCentavos = pendientes.reduce(
    (acc, item) => acc + item.precioVentaCentavos * (cantidades[item.id] ?? 0),
    0,
  );
  const anulaTodo = pendientes.every((item) => cantidades[item.id] === item.pendiente);
  const valido = aDevolverCentavos > 0 && motivo.trim().length >= 3;

  function cambiar(itemId: string, pendiente: number, delta: number) {
    setCantidades((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Math.min(pendiente, (prev[itemId] ?? 0) + delta)),
    }));
  }

  async function anular() {
    if (!token || !valido) return;
    setError(null);
    setEnviando(true);
    try {
      const actualizada = await anularVenta(token, venta.id, {
        motivo: motivo.trim(),
        items: anulaTodo
          ? undefined
          : pendientes
              .filter((item) => (cantidades[item.id] ?? 0) > 0)
              .map((item) => ({ ventaItemId: item.id, cantidad: cantidades[item.id] })),
      });
      onAnulada(actualizada);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anular la venta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitulo}>¿Qué se anula?</Text>
      {pendientes.map((item) => (
        <View key={item.id} style={styles.panelFila}>
          <Text style={styles.panelNombre} numberOfLines={1}>
            {item.nombre} <Text style={styles.panelDe}>(de {item.pendiente})</Text>
          </Text>
          <View style={styles.contador}>
            <Pressable onPress={() => cambiar(item.id, item.pendiente, -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={24} color={colores.tinta} />
            </Pressable>
            <Text style={styles.contadorValor}>{cantidades[item.id] ?? 0}</Text>
            <Pressable onPress={() => cambiar(item.id, item.pendiente, 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={24} color={colores.tinta} />
            </Pressable>
          </View>
        </View>
      ))}

      <Etiqueta>Motivo (queda registrado)</Etiqueta>
      <TextInput
        value={motivo}
        onChangeText={setMotivo}
        style={estilosCampo.input}
        placeholder="Ej: el cliente devolvió el producto"
        maxLength={300}
      />

      <Text style={styles.panelTotal}>
        Devolver al cliente:{' '}
        <Text style={{ fontWeight: '700' }}>{formatearCentavos(aDevolverCentavos)}</Text>
      </Text>
      <Text style={styles.panelNota}>El stock vuelve al inventario.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <Boton
          variante="danger"
          onPress={anular}
          cargando={enviando}
          disabled={!valido}
          style={{ flex: 1 }}
        >
          {anulaTodo ? 'Anular todo' : 'Anular selección'}
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </View>
  );
}

function TarjetaVenta({
  venta,
  puedeAnular,
  anulando,
  onAnular,
  onAnulada,
  onCerrarAnulacion,
}: {
  venta: VentaDelHistorial;
  puedeAnular: boolean;
  anulando: boolean;
  onAnular: () => void;
  onAnulada: (v: VentaDelHistorial) => void;
  onCerrarAnulacion: () => void;
}) {
  const { token } = useAuth();
  const estado = ESTADO[venta.estado];
  const netoCentavos = venta.totalCentavos - venta.totalAnuladoCentavos;

  return (
    <Tarjeta style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hora}>
            <Text style={{ fontWeight: '700' }}>{numeroDeTicket(venta.numero)}</Text> · {hora(venta.createdAt)} ·{' '}
            <Text style={styles.vendedor}>{venta.vendedor}</Text>
          </Text>
          <View style={[styles.estadoPill, { backgroundColor: estado.fondo }]}>
            <Text style={[styles.estadoTexto, { color: estado.color }]}>{estado.texto}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.total}>{formatearCentavos(netoCentavos)}</Text>
          {venta.totalAnuladoCentavos > 0 && (
            <Text style={styles.totalOriginal}>{formatearCentavos(venta.totalCentavos)}</Text>
          )}
        </View>
      </View>

      <View style={{ marginTop: espaciado.sm, gap: 2 }}>
        {venta.items.map((item) => (
          <View key={item.id} style={styles.itemFila}>
            <Text style={styles.itemTexto} numberOfLines={1}>
              {item.cantidad} × {item.nombre}
              {item.cantidadAnulada > 0 && (
                <Text style={styles.itemAnulado}>
                  {' '}
                  ({item.cantidadAnulada === item.cantidad
                    ? 'anulado'
                    : `${item.cantidadAnulada} anulado${item.cantidadAnulada === 1 ? '' : 's'}`})
                </Text>
              )}
            </Text>
            <Text style={styles.itemPrecio}>
              {formatearCentavos(item.precioVentaCentavos * item.cantidad)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.pago}>
        {venta.metodoPago === 'transferencia'
          ? 'Pagado por transferencia'
          : `Efectivo · recibido ${formatearCentavos(venta.montoRecibidoCentavos)} · vuelto ${formatearCentavos(venta.vueltoCentavos)}`}
      </Text>

      {venta.anulaciones.length > 0 && (
        <View style={styles.anulaciones}>
          {venta.anulaciones.map((a) => (
            <Text key={a.id} style={styles.anulacionTexto}>
              {hora(a.createdAt)} · {a.anuladoPor} anuló {formatearCentavos(a.montoDevueltoCentavos)}: “
              {a.motivo}”
            </Text>
          ))}
        </View>
      )}

      {!anulando && (
        <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
          <Pressable
            onPress={() => token && compartirTicket(token, venta.id)}
            hitSlop={8}
            style={styles.botonAnular}
          >
            <Text style={styles.botonAnularTexto}>Compartir ticket</Text>
          </Pressable>
          {puedeAnular && venta.estado !== 'anulada' && (
            <Pressable onPress={onAnular} hitSlop={8} style={styles.botonAnular}>
              <Text style={styles.botonAnularTexto}>Anular…</Text>
            </Pressable>
          )}
        </View>
      )}

      {anulando && (
        <PanelAnulacion venta={venta} onAnulada={onAnulada} onCerrar={onCerrarAnulacion} />
      )}
    </Tarjeta>
  );
}

export function VentasHoyScreen() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const { params } = useRoute<RouteProp<RootStackParamList, 'VentasHoy'>>();
  // El cajero ve solo las de hoy (para encontrar una a anular): el
  // historial y los totales de otros días son información del dueño.
  const [periodoElegidoPorAdmin, setPeriodo] = useState<Periodo>(() =>
    params ? periodoElegido(params.desde, params.hasta) : periodoDeHoy(),
  );
  const periodo = esAdmin ? periodoElegidoPorAdmin : periodoDeHoy();
  const [ventas, setVentas] = useState<VentaDelHistorial[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  // Solo la última consulta pisa el estado (cambiar de período rápido).
  const ultimaConsulta = useRef(0);

  const cargar = useCallback(() => {
    if (!token) return;
    const numero = ++ultimaConsulta.current;
    setCargando(true);
    setError(null);
    setAnulandoId(null);
    const pedido: Promise<[PaginaDeVentas, ResumenPeriodo | null]> = esAdmin
      ? Promise.all([listarVentas(token, periodo, POR_PAGINA), obtenerResumen(token, periodo)])
      : obtenerVentasDeHoy(token).then((deHoy) => [{ ventas: deHoy, total: deHoy.length }, null]);
    pedido
      .then(([pagina, resumenResp]) => {
        if (numero !== ultimaConsulta.current) return;
        setVentas(pagina.ventas);
        setTotal(pagina.total);
        setResumen(resumenResp);
      })
      .catch((err) => {
        if (numero === ultimaConsulta.current)
          setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ventas');
      })
      .finally(() => {
        if (numero === ultimaConsulta.current) setCargando(false);
      });
    // periodo se arma en cada render para el cajero: se compara por fechas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, esAdmin, periodo.desde, periodo.hasta]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function cargarMas() {
    if (!token || !esAdmin || cargando || cargandoMas || ventas.length >= total) return;
    setCargandoMas(true);
    try {
      const pagina = await listarVentas(token, periodo, POR_PAGINA, ventas.length);
      // Si entró una venta nueva mientras tanto, el corte se corre uno:
      // se evita mostrar dos veces la misma.
      setVentas((previas) => {
        const vistas = new Set(previas.map((v) => v.id));
        return [...previas, ...pagina.ventas.filter((v) => !vistas.has(v.id))];
      });
      setTotal(pagina.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar más ventas');
    } finally {
      setCargandoMas(false);
    }
  }

  function alAnular(actualizada: VentaDelHistorial) {
    setVentas((prev) => prev.map((v) => (v.id === actualizada.id ? actualizada : v)));
    // Los totales de la franja salen del resumen: se vuelven a pedir.
    if (esAdmin && token) obtenerResumen(token, periodo).then(setResumen).catch(() => {});
  }

  const hoy = esHoy(periodo);
  const deHoy = hoyISO();
  const variosDias = periodo.desde !== periodo.hasta;
  // Admin: totales del período entero (la lista viene por partes).
  // Cajero: salen de las ventas de hoy, que llegan todas.
  const cobrado =
    resumen?.ingresoBrutoCentavos ??
    ventas.reduce((acc, v) => acc + v.totalCentavos - v.totalAnuladoCentavos, 0);
  const cantidad = resumen?.cantidadVentas ?? ventas.filter((v) => v.estado !== 'anulada').length;
  const anulado = resumen?.anuladoCentavos ?? ventas.reduce((acc, v) => acc + v.totalAnuladoCentavos, 0);
  const porDia = new Map(
    resumen?.agrupadoPor === 'dia' ? resumen.serie.map((p) => [p.etiqueta, p.centavos]) : [],
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <FlatList
        data={cargando || error ? [] : ventas}
        keyExtractor={(v) => v.id}
        renderItem={({ item, index }) => {
          const dia = diaDe(item);
          // Varios días: un título cada vez que cambia el día.
          const nuevoDia = variosDias && (index === 0 || diaDe(ventas[index - 1]) !== dia);
          return (
            <View style={styles.fila}>
              {nuevoDia && (
                <View style={styles.dia}>
                  <Text style={styles.diaTexto}>
                    {dia === deHoy ? 'Hoy' : fechaLarga(dia)[0].toUpperCase() + fechaLarga(dia).slice(1)}
                  </Text>
                  {porDia.has(dia) && (
                    <Text style={styles.diaTotal}>{formatearCentavos(porDia.get(dia)!)}</Text>
                  )}
                </View>
              )}
              <TarjetaVenta
                venta={item}
                // Solo el mismo día: una venta de otro día ya está en los
                // números cerrados de ese día.
                puedeAnular={esAdmin && dia === deHoy}
                anulando={anulandoId === item.id}
                onAnular={() => setAnulandoId(item.id)}
                onAnulada={alAnular}
                onCerrarAnulacion={() => setAnulandoId(null)}
              />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: espaciado.sm }} />}
        contentContainerStyle={styles.listaContenido}
        refreshing={cargando && ventas.length > 0}
        onRefresh={cargar}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.4}
        // La franja va dentro de la lista: con los botones de período es
        // alta, y fija se comería media pantalla.
        ListHeaderComponent={
          <View>
            <Banda
              eyebrow={hoy ? 'Caja · hoy' : `Ventas · ${rangoLegible(periodo)}`}
              titulo={hoy ? 'Ventas del día' : nombreDelPeriodo(periodo)}
              valor={formatearCentavos(cobrado)}
              detalle={`Cobrado en ${cantidad} venta${cantidad === 1 ? '' : 's'}${
                anulado > 0 ? ` · ${formatearCentavos(anulado)} anulados` : ''
              }`}
            >
              {esAdmin && <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />}
            </Banda>
            <LabioHoja />
            <Text style={[styles.descripcion, styles.fila]}>
              {!esAdmin
                ? 'Si hay que anular una venta, avísale al administrador.'
                : hoy
                  ? 'Puedes anular una venta completa o solo algunos productos; el stock vuelve al inventario.'
                  : 'Las ventas se pueden anular solo el mismo día en que se hicieron.'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.fila}>
            {cargando ? (
              <EstadoCargando texto="Cargando ventas…" />
            ) : error ? (
              <EstadoError mensaje={error} onReintentar={cargar} />
            ) : (
              <EstadoVacio
                icono="receipt-outline"
                titulo={hoy ? 'Todavía no hay ventas hoy' : 'No hubo ventas en estas fechas'}
                descripcion={
                  hoy
                    ? 'Las ventas que se registren en la caja van a aparecer aquí.'
                    : 'Prueba con otro período.'
                }
              />
            )}
          </View>
        }
        ListFooterComponent={
          ventas.length > 0 && !cargando && !error ? (
            <View style={styles.pie}>
              {cargandoMas ? (
                <ActivityIndicator color={colores.tinta} />
              ) : (
                <Text style={styles.pieTexto}>
                  {ventas.length < total
                    ? `Mostrando ${ventas.length} de ${total} · desliza para ver más`
                    : `${total} venta${total === 1 ? '' : 's'}`}
                </Text>
              )}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  listaContenido: { paddingBottom: espaciado.xl, flexGrow: 1 },
  fila: { paddingHorizontal: espaciado.lg },
  descripcion: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18, marginBottom: espaciado.md },
  dia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espaciado.sm,
    marginTop: espaciado.md,
    marginBottom: espaciado.sm,
    paddingBottom: espaciado.xs,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  diaTexto: { fontSize: 15, fontWeight: '800', color: colores.tinta },
  diaTotal: { fontSize: 13, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  pie: { alignItems: 'center', paddingVertical: espaciado.lg },
  pieTexto: { fontSize: 12, color: colores.tintaSuave },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  tarjeta: { paddingVertical: espaciado.md },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm },
  hora: { fontSize: 13, color: colores.tinta, fontVariant: ['tabular-nums'] },
  vendedor: { color: colores.tintaSuave },
  estadoPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radios.full,
  },
  estadoTexto: { fontSize: 11, fontWeight: '700' },
  total: { fontSize: 17, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  totalOriginal: {
    fontSize: 12,
    color: colores.tintaSuave,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  itemFila: { flexDirection: 'row', justifyContent: 'space-between', gap: espaciado.sm },
  itemTexto: { flex: 1, fontSize: 13, color: colores.tinta },
  itemAnulado: { fontSize: 12, color: colores.rojoPerdida },
  itemPrecio: { fontSize: 13, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  anulaciones: {
    marginTop: espaciado.sm,
    paddingTop: espaciado.sm,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
    gap: 2,
  },
  anulacionTexto: { fontSize: 12, color: colores.tintaSuave },
  botonAnular: {
    alignSelf: 'flex-start',
    marginTop: espaciado.sm,
    paddingHorizontal: espaciado.md,
    paddingVertical: 6,
    borderRadius: radios.sm,
    borderWidth: 1,
    borderColor: colores.papelLinea,
  },
  botonAnularTexto: { fontSize: 13, fontWeight: '600', color: colores.tintaSuave },
  pago: { marginTop: espaciado.xs, fontSize: 12, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: espaciado.xl, marginBottom: espaciado.md },
  resumenEtiqueta: { fontSize: 11, color: colores.tintaSuave },
  resumenValor: { fontSize: 17, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  panel: {
    marginTop: espaciado.md,
    padding: espaciado.md,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: 'rgba(182,70,47,0.3)',
    backgroundColor: 'rgba(182,70,47,0.05)',
  },
  panelTitulo: { fontSize: 14, fontWeight: '700', color: colores.tinta, marginBottom: espaciado.sm },
  panelFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaciado.sm,
    marginBottom: espaciado.sm,
  },
  panelNombre: { flex: 1, fontSize: 13, color: colores.tinta },
  panelDe: { fontSize: 12, color: colores.tintaSuave },
  contador: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm },
  contadorValor: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
  },
  panelTotal: { fontSize: 14, color: colores.tinta, marginTop: espaciado.xs },
  panelNota: { fontSize: 12, color: colores.tintaSuave, marginBottom: espaciado.md },
});
