import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { listarTurnosCaja, obtenerCajaActual, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { horaDe, textoDiferencia, tonoDiferencia } from '../lib/caja';
import { fechaISO, fechaLarga, periodoPredefinido } from '../lib/periodo';
import { Boton, EstadoCargando, EstadoError, Tarjeta } from '../components/ui';
import { Banda, Hoja } from '../components/banda';
import { Ficha } from '../components/ficha';
import { COLOR_PAGO } from '../components/metodo-pago';
import {
  FormularioAbrirCaja,
  FormularioCierre,
  FormularioMovimiento,
  ListaMovimientos,
  ResultadoArqueo,
} from '../components/caja';
import { colores, espaciado, radios } from '../theme/colores';
import { HojaModal } from '../components/hoja-modal';
import type { TurnoCaja } from '../lib/tipos';
import { useSinConexion } from '../lib/sin-conexion';

const PERIODOS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'semana', texto: '7 días' },
  { clave: 'mes', texto: 'Este mes' },
] as const;

const TONO = {
  ok: { fondo: 'rgba(47,111,79,0.1)', texto: colores.verdeGanancia, borde: colores.verdeGanancia },
  falta: { fondo: 'rgba(182,70,47,0.1)', texto: colores.rojoPerdida, borde: colores.rojoPerdida },
  sobra: { fondo: 'rgba(217,140,43,0.15)', texto: '#9a5b08', borde: colores.ambar },
} as const;

/**
 * De dónde sale lo que tiene que haber en el cajón, como una suma:
 * cambio inicial + ventas en efectivo + lo puesto − lo sacado. Lo cobrado
 * por transferencia o al fiado va aparte: no entra al cajón.
 *
 * El cajero no ve las ventas en efectivo ni el total (conteo a ciegas:
 * lo ve al cerrar, después de contar).
 */
function CuentaDelCajon({ turno }: { turno: TurnoCaja }) {
  const ciega = turno.efectivoEsperadoCentavos === undefined;
  const ventas = `${turno.cantidadVentas} venta${turno.cantidadVentas === 1 ? '' : 's'}`;
  const pasos = [
    {
      signo: '',
      etiqueta: 'Cambio inicial',
      valor: formatearCentavos(turno.fondoInicialCentavos),
      nota: `Desde las ${horaDe(turno.abiertoEn)}`,
    },
    {
      signo: '+',
      etiqueta: 'Ventas en efectivo',
      valor: ciega ? ventas : formatearCentavos(turno.ventasEfectivoCentavos ?? 0),
      nota: ciega ? 'El monto lo ves al cerrar' : `${ventas} en total`,
    },
    {
      signo: '+',
      etiqueta: 'Puesto',
      valor: formatearCentavos(turno.ingresosCentavos),
      nota: 'Cambio que trajiste',
    },
    {
      signo: '−',
      etiqueta: 'Sacado',
      valor: formatearCentavos(turno.retirosCentavos),
      nota: 'Pagos, depósitos',
    },
  ];
  return (
    <Tarjeta>
      <View style={{ gap: espaciado.md }}>
        {pasos.map((paso) => (
          <View key={paso.etiqueta} style={styles.paso}>
            <View style={[styles.signo, !paso.signo && { opacity: 0 }]}>
              <Text style={styles.signoTexto}>{paso.signo || '·'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pasoEtiqueta}>{paso.etiqueta}</Text>
              <Text style={styles.pasoNota}>{paso.nota}</Text>
            </View>
            <Text style={styles.pasoValor}>{paso.valor}</Text>
          </View>
        ))}
        <View style={styles.total}>
          <View style={[styles.signo, styles.signoTotal]}>
            <Text style={[styles.signoTexto, { color: '#ffd08a' }]}>=</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pasoEtiqueta, styles.totalSuave]}>En el cajón</Text>
            <Text style={[styles.pasoNota, styles.totalSuave]}>
              {ciega ? 'Se ve al cerrar la caja' : 'Lo que hay que contar'}
            </Text>
          </View>
          <Text style={[styles.pasoValor, styles.totalValor]}>
            {ciega ? '¿?' : formatearCentavos(turno.efectivoEsperadoCentavos ?? 0)}
          </Text>
        </View>
      </View>
      <View style={styles.aparte}>
        <Text style={styles.aparteTexto}>No entran al cajón:</Text>
        <View style={[styles.aparteChip, { backgroundColor: COLOR_PAGO.transferencia.fondo }]}>
          <Text style={[styles.aparteChipTexto, { color: COLOR_PAGO.transferencia.texto }]}>
            Transferencias {formatearCentavos(turno.ventasTransferenciaCentavos)}
          </Text>
        </View>
        <View style={[styles.aparteChip, { backgroundColor: COLOR_PAGO.fiado.fondo }]}>
          <Text style={[styles.aparteChipTexto, { color: COLOR_PAGO.fiado.texto }]}>
            Al fiado {formatearCentavos(turno.ventasFiadoCentavos)}
          </Text>
        </View>
      </View>
    </Tarjeta>
  );
}

function TarjetaTurno({
  turno,
  propio,
  onCambio,
}: {
  turno: TurnoCaja;
  propio: boolean;
  onCambio: () => void;
}) {
  const [viendo, setViendo] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const fecha = fechaLarga(fechaISO(new Date(turno.abiertoEn)));
  const tono = turno.diferenciaCentavos !== undefined ? TONO[tonoDiferencia(turno.diferenciaCentavos)] : null;

  return (
    <Tarjeta
      style={[styles.turno, { borderLeftColor: tono ? tono.borde : COLOR_PAGO.transferencia.color }]}
    >
      <View style={styles.turnoCabecera}>
        <Ficha nombre={turno.cajero} tamano="chica" redonda />
        <View style={{ flex: 1 }}>
          <Text style={styles.turnoCajero}>{turno.cajero}</Text>
          <Text style={styles.turnoFecha}>
            {fecha[0].toUpperCase() + fecha.slice(1)} · {horaDe(turno.abiertoEn)}
            {turno.cerradoEn ? ` a ${horaDe(turno.cerradoEn)}` : ' · abierta'}
          </Text>
        </View>
        <Text
          style={[
            styles.pildora,
            tono ? { backgroundColor: tono.fondo, color: tono.texto } : styles.pildoraAbierta,
          ]}
        >
          {turno.diferenciaCentavos !== undefined ? textoDiferencia(turno.diferenciaCentavos) : 'Abierta'}
        </Text>
      </View>
      <View style={styles.turnoDatos}>
        <View style={{ flex: 1 }}>
          <Text style={styles.turnoEtiqueta}>Ventas</Text>
          <Text style={styles.turnoValor}>{turno.cantidadVentas}</Text>
        </View>
        <View style={{ flex: 1.3 }}>
          <Text style={styles.turnoEtiqueta}>
            {turno.estado === 'abierto' ? 'Hay en el cajón' : 'Tenía que haber'}
          </Text>
          <Text style={styles.turnoValor}>{formatearCentavos(turno.efectivoEsperadoCentavos ?? 0)}</Text>
        </View>
        {turno.efectivoContadoCentavos !== undefined ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.turnoEtiqueta}>Se contó</Text>
            <Text style={styles.turnoValor}>{formatearCentavos(turno.efectivoContadoCentavos)}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={styles.turnoEtiqueta}>Transferencias</Text>
            <Text style={styles.turnoValor}>{formatearCentavos(turno.ventasTransferenciaCentavos)}</Text>
          </View>
        )}
      </View>
      <View style={styles.enlaces}>
        <Pressable
          onPress={() => setViendo(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.pildoraAccion, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="receipt-outline" size={12} color={colores.tinta} />
          <Text style={styles.pildoraAccionTexto}>Ver el detalle</Text>
        </Pressable>
        {turno.estado === 'abierto' && !propio && (
          <Pressable
            onPress={() => setCerrando(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.pildoraAccion, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="cash-outline" size={12} color={colores.tinta} />
            <Text style={styles.pildoraAccionTexto}>Cerrar esta caja</Text>
          </Pressable>
        )}
      </View>

      {viendo && (
        <HojaModal
          titulo={`Caja de ${turno.cajero}`}
          descripcion={`${fecha[0].toUpperCase() + fecha.slice(1)} · ${horaDe(turno.abiertoEn)}${
            turno.cerradoEn ? ` a ${horaDe(turno.cerradoEn)}` : ' · abierta'
          }`}
          icono="receipt-outline"
          onCerrar={() => setViendo(false)}
        >
          <View style={{ gap: espaciado.md }}>
            <ResultadoArqueo turno={turno} />
            <ListaMovimientos movimientos={turno.movimientos} />
          </View>
        </HojaModal>
      )}
      {cerrando && (
        <HojaModal
          titulo={`Cerrar la caja de ${turno.cajero}`}
          descripcion="Cuenta todo el efectivo del cajón, incluido el cambio con el que abrió."
          icono="cash-outline"
          onCerrar={() => setCerrando(false)}
        >
          <FormularioCierre turnoId={turno.id} onCerrado={onCambio} />
        </HojaModal>
      )}
    </Tarjeta>
  );
}

function CajasDelEquipo({ usuarioId, version }: { usuarioId: string; version: number }) {
  const { token } = useAuth();
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['clave']>('semana');
  const [turnos, setTurnos] = useState<TurnoCaja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let vigente = true;
      listarTurnosCaja(token, periodoPredefinido(periodo))
        .then((t) => vigente && setTurnos(t))
        .catch((err) => vigente && setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las cajas'));
      return () => {
        vigente = false;
      };
    }, [token, periodo, version, recarga]),
  );

  const cerrados = turnos?.filter((t) => t.diferenciaCentavos !== undefined) ?? [];
  const neto = cerrados.reduce((acc, t) => acc + t.diferenciaCentavos!, 0);

  return (
    <View style={{ gap: espaciado.sm }}>
      <Text style={styles.seccion}>Cajas del equipo</Text>
      <View style={styles.chips}>
        {PERIODOS.map((p) => (
          <Pressable
            key={p.clave}
            onPress={() => setPeriodo(p.clave)}
            accessibilityRole="button"
            accessibilityState={{ selected: periodo === p.clave }}
            style={[styles.chip, periodo === p.clave && styles.chipActivo]}
          >
            <Text style={[styles.chipTexto, periodo === p.clave && styles.chipTextoActivo]}>{p.texto}</Text>
          </Pressable>
        ))}
      </View>
      {cerrados.length > 0 && (
        <Text style={styles.ayuda}>
          {cerrados.filter((t) => t.diferenciaCentavos !== 0).length} de {cerrados.length} cierres con diferencia · en
          total {textoDiferencia(neto).toLowerCase()}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {!turnos && !error && <EstadoCargando texto="Cargando cajas…" />}
      {turnos?.length === 0 && <Text style={styles.ayuda}>No hubo cajas abiertas en este período.</Text>}
      {turnos?.map((t) => (
        <TarjetaTurno
          key={t.id}
          turno={t}
          propio={t.usuarioId === usuarioId}
          onCambio={() => setRecarga((n) => n + 1)}
        />
      ))}
    </View>
  );
}

export function CajaScreen() {
  const { token, usuario } = useAuth();
  // Ventas cobradas sin conexión que todavía no llegaron: con la caja
  // cerrada, al llegar ya no tendrían turno y el arqueo no cuadraría.
  const { pendientes } = useSinConexion();
  const sinEnviar = pendientes.length;
  const esAdmin = usuario?.rol === 'admin';
  const [turno, setTurno] = useState<TurnoCaja | null | undefined>(undefined);
  const [cierre, setCierre] = useState<TurnoCaja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<'movimiento' | 'cerrar' | null>(null);
  const [version, setVersion] = useState(0);

  const cargar = useCallback(() => {
    if (!token) return;
    setError(null);
    obtenerCajaActual(token)
      .then(setTurno)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la caja'));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  function actualizar(t: TurnoCaja) {
    setTurno(t);
    setVersion((v) => v + 1);
  }

  const abierta = turno?.estado === 'abierto';

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Banda
          eyebrow={abierta ? `Abierta a las ${horaDe(turno!.abiertoEn)}` : 'Arqueo'}
          titulo="Caja"
          valor={
            abierta
              ? esAdmin
                ? formatearCentavos(turno!.efectivoEsperadoCentavos ?? 0)
                : `${turno!.cantidadVentas} venta${turno!.cantidadVentas === 1 ? '' : 's'}`
              : cierre
                ? textoDiferencia(cierre.diferenciaCentavos ?? 0)
                : turno === null
                  ? 'Cerrada'
                  : undefined
          }
          detalle={
            abierta
              ? esAdmin
                ? 'Efectivo que debería haber en el cajón ahora. Abajo, de dónde sale.'
                : `Empezaste con ${formatearCentavos(turno!.fondoInicialCentavos)}. Lo que debería haber lo ves al cerrar.`
              : cierre
                ? 'Caja cerrada. Abre otra cuando vuelvas a vender.'
                : 'Abre la caja con el cambio del cajón para empezar a vender.'
          }
        />
        <Hoja style={styles.hoja}>
          {error && <EstadoError mensaje={error} onReintentar={cargar} />}
          {turno === undefined && !error && <EstadoCargando texto="Cargando caja…" />}

          {cierre && (
            <Tarjeta>
              <Text style={styles.seccion}>Resultado del cierre</Text>
              <View style={{ marginTop: espaciado.sm }}>
                <ResultadoArqueo turno={cierre} />
              </View>
            </Tarjeta>
          )}

          {turno === null && (
            <FormularioAbrirCaja
              onAbierta={(t) => {
                setCierre(null);
                actualizar(t);
              }}
            />
          )}

          {abierta && (
            <>
              <CuentaDelCajon turno={turno!} />

              <Tarjeta>
                <Text style={styles.seccion}>Movimientos de efectivo</Text>
                {turno!.movimientos.length === 0 && (
                  <Text style={styles.ayuda}>
                    Si pagas algo con dinero del cajón o traes más cambio, regístralo aquí para que la caja cuadre.
                  </Text>
                )}
                <ListaMovimientos movimientos={turno!.movimientos} />
                <Boton variante="secondary" onPress={() => setAccion('movimiento')} style={{ marginTop: espaciado.sm }}>
                  Sacar o poner efectivo
                </Boton>
              </Tarjeta>

              {sinEnviar > 0 && (
                <Text style={styles.ayuda}>
                  {`Antes de cerrar hay que enviar ${sinEnviar === 1 ? 'la venta cobrada' : `las ${sinEnviar} ventas cobradas`} sin conexión (se envían solas al volver internet; las que tengan problema, revísalas en Vender).`}
                </Text>
              )}
              <Boton onPress={() => setAccion('cerrar')} disabled={sinEnviar > 0}>
                Cerrar la caja
              </Boton>
            </>
          )}


          {esAdmin && usuario && <CajasDelEquipo usuarioId={usuario.sub} version={version} />}
        </Hoja>
      </ScrollView>

      {/* Afuera del bloque de la caja abierta: al cerrarla, la hoja se va
          con su animación aunque la caja ya no esté abierta. */}
      {accion === 'movimiento' && (
        <HojaModal
          titulo="Sacar o poner efectivo"
          descripcion="Queda registrado y se tiene en cuenta al cerrar la caja."
          icono="cash-outline"
          onCerrar={() => setAccion(null)}
        >
          <FormularioMovimiento onRegistrado={actualizar} />
        </HojaModal>
      )}
      {accion === 'cerrar' && (
        <HojaModal
          titulo="Cerrar la caja"
          descripcion="Cuenta todo el efectivo del cajón, incluido el cambio con el que abriste. Después de cerrar vas a ver si cuadra."
          icono="lock-closed-outline"
          onCerrar={() => setAccion(null)}
        >
          <FormularioCierre
            onCerrado={(t) => {
              setCierre(t);
              setTurno(null);
              setVersion((v) => v + 1);
            }}
          />
        </HojaModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pildoraAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(28,43,58,0.06)',
  },
  pildoraAccionTexto: { fontSize: 12, fontWeight: '700', color: colores.tinta },
  contenedor: { flex: 1, backgroundColor: colores.papel },
  hoja: { paddingHorizontal: espaciado.lg, paddingBottom: espaciado.xxl, gap: espaciado.md },
  seccion: { fontSize: 16, fontWeight: '800', color: colores.tinta },
  ayuda: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18, marginTop: 4 },
  error: { color: colores.rojoPerdida, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  chipActivo: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  chipTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  chipTextoActivo: { color: colores.papel },
  paso: { flexDirection: 'row', alignItems: 'center', gap: espaciado.md },
  signo: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,43,58,0.07)',
  },
  signoTexto: { fontSize: 14, fontWeight: '800', color: colores.tintaSuave },
  signoTotal: { backgroundColor: 'rgba(255,208,138,0.18)' },
  pasoEtiqueta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colores.tintaSuave,
  },
  pasoNota: { marginTop: 1, fontSize: 11, color: colores.tintaSuave },
  pasoValor: { fontSize: 17, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.md,
    borderRadius: radios.md,
    backgroundColor: '#1d3041',
    padding: espaciado.md,
  },
  totalSuave: { color: 'rgba(246,243,236,0.68)' },
  totalValor: { color: '#ffd08a', fontSize: 20 },
  aparte: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: espaciado.md,
    paddingTop: espaciado.sm,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
    borderStyle: 'dashed',
  },
  aparteTexto: { fontSize: 12, fontWeight: '600', color: colores.tintaSuave },
  aparteChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  aparteChipTexto: { fontSize: 11, fontWeight: '700' },
  turno: { borderLeftWidth: 4 },
  turnoCabecera: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm },
  turnoCajero: { fontSize: 15, fontWeight: '700', color: colores.tinta },
  turnoFecha: { fontSize: 12, color: colores.tintaSuave, marginTop: 2 },
  pildora: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radios.full,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  pildoraAbierta: { backgroundColor: 'rgba(47,143,176,0.13)', color: '#1f6a85' },
  turnoDatos: {
    flexDirection: 'row',
    gap: espaciado.sm,
    marginTop: espaciado.md,
    borderRadius: radios.md,
    backgroundColor: 'rgba(28,43,58,0.035)',
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
  },
  turnoEtiqueta: { fontSize: 11, color: colores.tintaSuave },
  turnoValor: { fontSize: 14, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  enlaces: { flexDirection: 'row', gap: espaciado.lg, marginTop: espaciado.md },
  enlace: { fontSize: 13, fontWeight: '600', color: colores.tinta, textDecorationLine: 'underline' },
});
