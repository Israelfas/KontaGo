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
import { Banda, Hoja, Mosaico, Pieza } from '../components/banda';
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

const PERIODOS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'semana', texto: '7 días' },
  { clave: 'mes', texto: 'Este mes' },
] as const;

const TONO = {
  ok: { fondo: 'rgba(47,111,79,0.1)', texto: colores.verdeGanancia },
  falta: { fondo: 'rgba(182,70,47,0.1)', texto: colores.rojoPerdida },
  sobra: { fondo: 'rgba(217,140,43,0.15)', texto: '#9a5b08' },
} as const;

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
    <Tarjeta>
      <View style={styles.turnoCabecera}>
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
        <View>
          <Text style={styles.turnoEtiqueta}>Ventas</Text>
          <Text style={styles.turnoValor}>{turno.cantidadVentas}</Text>
        </View>
        <View>
          <Text style={styles.turnoEtiqueta}>{turno.estado === 'abierto' ? 'Debería haber' : 'Debía haber'}</Text>
          <Text style={styles.turnoValor}>{formatearCentavos(turno.efectivoEsperadoCentavos ?? 0)}</Text>
        </View>
        <View>
          <Text style={styles.turnoEtiqueta}>Transferencias</Text>
          <Text style={styles.turnoValor}>{formatearCentavos(turno.ventasTransferenciaCentavos)}</Text>
        </View>
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
                ? `Efectivo que debería haber · empezaste con ${formatearCentavos(turno!.fondoInicialCentavos)}.`
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
              <Mosaico>
                <Pieza
                  etiqueta="Cambio inicial"
                  valor={formatearCentavos(turno!.fondoInicialCentavos)}
                  detalle={`Desde las ${horaDe(turno!.abiertoEn)}`}
                />
                <Pieza
                  etiqueta="Ventas"
                  valor={String(turno!.cantidadVentas)}
                  detalle={
                    esAdmin ? `${formatearCentavos(turno!.ventasEfectivoCentavos ?? 0)} en efectivo` : 'En esta caja'
                  }
                />
                <Pieza
                  etiqueta="Transferencias"
                  valor={formatearCentavos(turno!.ventasTransferenciaCentavos)}
                  detalle="No entran al cajón"
                />
                <Pieza
                  etiqueta="Efectivo sacado"
                  valor={formatearCentavos(turno!.retirosCentavos)}
                  tono={turno!.retirosCentavos > 0 ? 'rojo' : 'neutro'}
                  detalle={
                    turno!.ingresosCentavos > 0 ? `${formatearCentavos(turno!.ingresosCentavos)} puesto` : 'Pagos, depósitos'
                  }
                />
              </Mosaico>

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

              <Boton onPress={() => setAccion('cerrar')}>Cerrar la caja</Boton>
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
  turnoCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm },
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
  pildoraAbierta: { backgroundColor: colores.papel, color: colores.tintaSuave },
  turnoDatos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: espaciado.md },
  turnoEtiqueta: { fontSize: 11, color: colores.tintaSuave },
  turnoValor: { fontSize: 14, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  enlaces: { flexDirection: 'row', gap: espaciado.lg, marginTop: espaciado.md },
  enlace: { fontSize: 13, fontWeight: '600', color: colores.tinta, textDecorationLine: 'underline' },
});
