import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { obtenerVentasDeHoy, anularVenta, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
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
import type { VentaDelHistorial } from '../lib/tipos';

const ESTADO: Record<VentaDelHistorial['estado'], { texto: string; color: string; fondo: string }> = {
  completa: { texto: 'Completa', color: colores.verdeGanancia, fondo: 'rgba(47,111,79,0.1)' },
  parcialmente_anulada: { texto: 'Anulada en parte', color: '#9a5b08', fondo: 'rgba(217,140,43,0.14)' },
  anulada: { texto: 'Anulada', color: colores.rojoPerdida, fondo: 'rgba(182,70,47,0.1)' },
};

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
  const estado = ESTADO[venta.estado];
  const netoCentavos = venta.totalCentavos - venta.totalAnuladoCentavos;

  return (
    <Tarjeta style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hora}>
            {hora(venta.createdAt)} · <Text style={styles.vendedor}>{venta.vendedor}</Text>
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

      {puedeAnular && venta.estado !== 'anulada' && !anulando && (
        <Pressable onPress={onAnular} hitSlop={8} style={{ marginTop: espaciado.sm }}>
          <Text style={styles.botonAnular}>Anular…</Text>
        </Pressable>
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
  const [ventas, setVentas] = useState<VentaDelHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anulandoId, setAnulandoId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    setError(null);
    obtenerVentasDeHoy(token)
      .then(setVentas)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ventas'))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <FlatList
        data={cargando || error ? [] : ventas}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <TarjetaVenta
            venta={item}
            puedeAnular={esAdmin}
            anulando={anulandoId === item.id}
            onAnular={() => setAnulandoId(item.id)}
            onAnulada={(actualizada) =>
              setVentas((prev) => prev.map((v) => (v.id === actualizada.id ? actualizada : v)))
            }
            onCerrarAnulacion={() => setAnulandoId(null)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: espaciado.sm }} />}
        contentContainerStyle={styles.listaContenido}
        refreshing={cargando}
        onRefresh={cargar}
        ListHeaderComponent={
          <Text style={styles.descripcion}>
            {esAdmin
              ? 'Podés anular una venta completa o solo algunos productos; el stock vuelve al inventario.'
              : 'Si hay que anular una venta, avisale al administrador.'}
          </Text>
        }
        ListEmptyComponent={
          !cargando && !error ? (
            <EstadoVacio
              icono="receipt-outline"
              titulo="Todavía no hay ventas hoy"
              descripcion="Las ventas que se registren en la caja van a aparecer acá."
            />
          ) : null
        }
      />

      {cargando && ventas.length === 0 && <EstadoCargando texto="Cargando ventas…" />}
      {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  listaContenido: { padding: espaciado.lg, flexGrow: 1 },
  descripcion: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18, marginBottom: espaciado.md },
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
  botonAnular: { fontSize: 13, fontWeight: '600', color: colores.rojoPerdida, textDecorationLine: 'underline' },
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
