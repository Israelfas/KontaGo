import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AvisoDeCampo, Boton, Etiqueta, Tarjeta, estilosCampo } from './ui';
import { colores, espaciado, radios } from '../theme/colores';
import { useAuth } from '../lib/auth-context';
import { abrirCaja, cerrarCaja, registrarMovimientoCaja, ApiError } from '../lib/api';
import { formatearCentavos } from '../lib/formato';
import { aCentavos, problemaDelLargo } from '../lib/validacion';
import {
  DENOMINACIONES,
  FONDOS_RAPIDOS,
  horaDe,
  textoDiferencia,
  tonoDiferencia,
  totalDelConteo,
} from '../lib/caja';
import type { MovimientoCaja, TipoMovimientoCaja, TurnoCaja } from '../lib/tipos';

/**
 * Piezas de la caja para la app (misma lógica que web/src/components/caja.tsx).
 */

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={[styles.chip, activo && styles.chipActivo]}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

// --- Abrir ---

export function FormularioAbrirCaja({ onAbierta }: { onAbierta: (t: TurnoCaja) => void }) {
  const { token } = useAuth();
  const [fondo, setFondo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fondoCentavos = aCentavos(fondo);

  async function abrir() {
    if (!token || fondoCentavos === null) return;
    setEnviando(true);
    setError(null);
    try {
      onAbierta(await abrirCaja(token, fondoCentavos));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo abrir la caja');
      setEnviando(false);
    }
  }

  return (
    <Tarjeta>
      <Text style={styles.titulo}>Abrir la caja</Text>
      <Text style={styles.ayuda}>
        Contá el cambio que hay en el cajón antes de empezar. Al cerrar, se compara con lo que haya
        al final.
      </Text>
      <Etiqueta>Cambio inicial</Etiqueta>
      <TextInput
        value={fondo}
        onChangeText={setFondo}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="Ej: 20.00"
      />
      <View style={styles.chips}>
        {FONDOS_RAPIDOS.map((centavos) => (
          <Chip
            key={centavos}
            texto={formatearCentavos(centavos)}
            activo={fondoCentavos === centavos}
            onPress={() => setFondo((centavos / 100).toFixed(2))}
          />
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Boton variante="success" onPress={abrir} cargando={enviando} disabled={fondoCentavos === null}>
        Abrir caja
      </Boton>
    </Tarjeta>
  );
}

// --- Retiros e ingresos ---

export function FormularioMovimiento({
  onRegistrado,
  onCancelar,
}: {
  onRegistrado: (t: TurnoCaja) => void;
  onCancelar: () => void;
}) {
  const { token } = useAuth();
  const [tipo, setTipo] = useState<TipoMovimientoCaja>('retiro');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const montoCentavos = aCentavos(monto);

  async function registrar() {
    if (!token || !montoCentavos) return;
    setEnviando(true);
    setError(null);
    try {
      onRegistrado(await registrarMovimientoCaja(token, { tipo, montoCentavos, motivo: motivo.trim() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar');
      setEnviando(false);
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.chips}>
        <Chip texto="Sacar efectivo" activo={tipo === 'retiro'} onPress={() => setTipo('retiro')} />
        <Chip texto="Poner efectivo" activo={tipo === 'ingreso'} onPress={() => setTipo('ingreso')} />
      </View>
      <Etiqueta>Monto</Etiqueta>
      <TextInput
        value={monto}
        onChangeText={setMonto}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="0.00"
      />
      <Etiqueta>Motivo (queda registrado)</Etiqueta>
      <TextInput
        value={motivo}
        onChangeText={setMotivo}
        style={estilosCampo.input}
        maxLength={200}
        placeholder={tipo === 'retiro' ? 'Ej: pago al proveedor del pan' : 'Ej: monedas para cambio'}
      />
      {/* El botón queda gris hasta que alcance: acá se dice por qué. */}
      <AvisoDeCampo ayuda={problemaDelLargo(motivo, 3)} />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.fila}>
        <Boton
          onPress={registrar}
          cargando={enviando}
          disabled={!montoCentavos || motivo.trim().length < 3}
          style={{ flex: 1 }}
        >
          Registrar
        </Boton>
        <Boton variante="ghost" onPress={onCancelar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </View>
  );
}

export function ListaMovimientos({ movimientos }: { movimientos: MovimientoCaja[] }) {
  if (movimientos.length === 0) return null;
  return (
    <View style={{ marginTop: espaciado.sm }}>
      {movimientos.map((m) => (
        <View key={m.id} style={styles.movimiento}>
          <Text style={styles.movimientoTexto}>
            <Text style={styles.hora}>{horaDe(m.createdAt)}</Text> · {m.motivo}
            <Text style={styles.hora}> · {m.usuario}</Text>
          </Text>
          <Text
            style={[
              styles.movimientoMonto,
              { color: m.tipo === 'retiro' ? colores.rojoPerdida : colores.verdeGanancia },
            ]}
          >
            {m.tipo === 'retiro' ? '−' : '+'}
            {formatearCentavos(m.montoCentavos)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// --- Cerrar (conteo a ciegas) ---

export function FormularioCierre({
  turnoId,
  titulo = 'Cerrar la caja',
  onCerrado,
  onCancelar,
}: {
  // Otro turno (el admin cierra el de un cajero). Sin id: el propio.
  turnoId?: string;
  titulo?: string;
  onCerrado: (t: TurnoCaja) => void;
  onCancelar?: () => void;
}) {
  const { token } = useAuth();
  const [modo, setModo] = useState<'billetes' | 'total'>('billetes');
  const [conteo, setConteo] = useState<Record<number, number>>({});
  const [totalEscrito, setTotalEscrito] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const contado = modo === 'billetes' ? totalDelConteo(conteo) : aCentavos(totalEscrito);

  async function cerrar() {
    if (!token || contado === null) return;
    setEnviando(true);
    setError(null);
    try {
      onCerrado(
        await cerrarCaja(token, { efectivoContadoCentavos: contado, nota: nota.trim() || undefined }, turnoId),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cerrar la caja');
      setEnviando(false);
    }
  }

  function confirmar() {
    if (contado === null) return;
    Alert.alert(
      'Cerrar la caja',
      `¿Cerrar con ${formatearCentavos(contado)}? Después no se puede cambiar el conteo.`,
      [
        { text: 'Volver a contar', style: 'cancel' },
        { text: 'Cerrar', onPress: cerrar },
      ],
    );
  }

  return (
    <Tarjeta>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.ayuda}>
        Contá todo el efectivo del cajón, incluido el cambio con el que abriste. Después de cerrar
        vas a ver si cuadra.
      </Text>
      <View style={styles.chips}>
        <Chip texto="Por billetes y monedas" activo={modo === 'billetes'} onPress={() => setModo('billetes')} />
        <Chip texto="Escribir el total" activo={modo === 'total'} onPress={() => setModo('total')} />
      </View>

      {modo === 'billetes' ? (
        <View style={styles.denominaciones}>
          {DENOMINACIONES.map((d) => (
            <View key={d.centavos} style={styles.denominacion}>
              <Text style={styles.denominacionTexto}>
                {d.texto}
                <Text style={styles.hora}> {d.tipo}</Text>
              </Text>
              <TextInput
                value={conteo[d.centavos] ? String(conteo[d.centavos]) : ''}
                onChangeText={(t) =>
                  setConteo((prev) => ({ ...prev, [d.centavos]: parseInt(t.replace(/\D/g, ''), 10) || 0 }))
                }
                keyboardType="number-pad"
                style={styles.denominacionInput}
                placeholder="0"
                accessibilityLabel={`Cantidad de ${d.tipo === 'billete' ? 'billetes' : 'monedas'} de ${d.texto}`}
              />
            </View>
          ))}
        </View>
      ) : (
        <>
          <Etiqueta>Total contado</Etiqueta>
          <TextInput
            value={totalEscrito}
            onChangeText={setTotalEscrito}
            keyboardType="decimal-pad"
            style={estilosCampo.input}
            placeholder="0.00"
          />
        </>
      )}

      <View style={styles.contado}>
        <Text style={styles.contadoEtiqueta}>Contaste</Text>
        <Text style={styles.contadoValor}>{contado === null ? '—' : formatearCentavos(contado)}</Text>
      </View>

      <Etiqueta>Nota (opcional)</Etiqueta>
      <TextInput
        value={nota}
        onChangeText={setNota}
        style={estilosCampo.input}
        maxLength={300}
        placeholder="Ej: un cliente no esperó su vuelto"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.fila}>
        <Boton onPress={confirmar} cargando={enviando} disabled={contado === null} style={{ flex: 1 }}>
          Cerrar caja
        </Boton>
        {onCancelar && (
          <Boton variante="ghost" onPress={onCancelar} style={{ flex: 1 }}>
            Cancelar
          </Boton>
        )}
      </View>
    </Tarjeta>
  );
}

// --- Resultado ---

const COLOR_DIFERENCIA = {
  ok: { fondo: 'rgba(47,111,79,0.1)', texto: colores.verdeGanancia },
  falta: { fondo: 'rgba(182,70,47,0.1)', texto: colores.rojoPerdida },
  sobra: { fondo: 'rgba(217,140,43,0.15)', texto: '#9a5b08' },
} as const;

export function ResultadoArqueo({ turno }: { turno: TurnoCaja }) {
  if (turno.efectivoEsperadoCentavos === undefined) return null;
  const diferencia = turno.diferenciaCentavos;
  const filas: [string, number, string][] = [
    ['Cambio inicial', turno.fondoInicialCentavos, ''],
    ['Ventas en efectivo', turno.ventasEfectivoCentavos ?? 0, '+ '],
    ...(turno.ingresosCentavos > 0 ? [['Efectivo puesto', turno.ingresosCentavos, '+ '] as [string, number, string]] : []),
    ...(turno.retirosCentavos > 0 ? [['Efectivo sacado', turno.retirosCentavos, '− '] as [string, number, string]] : []),
  ];
  const color = diferencia !== undefined ? COLOR_DIFERENCIA[tonoDiferencia(diferencia)] : null;

  return (
    <View style={{ gap: espaciado.sm }}>
      {diferencia !== undefined && color && (
        <View style={[styles.diferencia, { backgroundColor: color.fondo }]} accessibilityLiveRegion="polite">
          <Text style={[styles.diferenciaTitulo, { color: color.texto }]}>{textoDiferencia(diferencia)}</Text>
          <Text style={[styles.diferenciaDetalle, { color: color.texto }]}>
            Contado {formatearCentavos(turno.efectivoContadoCentavos!)} · debía haber{' '}
            {formatearCentavos(turno.efectivoEsperadoCentavos)}
          </Text>
        </View>
      )}
      {filas.map(([texto, monto, signo]) => (
        <View key={texto} style={styles.desglose}>
          <Text style={styles.desgloseTexto}>{texto}</Text>
          <Text style={styles.desgloseMonto}>
            {signo}
            {formatearCentavos(monto)}
          </Text>
        </View>
      ))}
      <View style={[styles.desglose, styles.desgloseTotal]}>
        <Text style={[styles.desgloseTexto, { fontWeight: '700', color: colores.tinta }]}>
          Efectivo que debía haber
        </Text>
        <Text style={[styles.desgloseMonto, { fontWeight: '800' }]}>
          {formatearCentavos(turno.efectivoEsperadoCentavos)}
        </Text>
      </View>
      {turno.ventasTransferenciaCentavos > 0 && (
        <View style={styles.desglose}>
          <Text style={styles.desgloseTexto}>Por transferencia (no está en el cajón)</Text>
          <Text style={styles.desgloseMonto}>{formatearCentavos(turno.ventasTransferenciaCentavos)}</Text>
        </View>
      )}
      {turno.nota && <Text style={styles.ayuda}>Nota: “{turno.nota}”</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 17, fontWeight: '800', color: colores.tinta },
  ayuda: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18, marginTop: 2, marginBottom: espaciado.md },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: espaciado.md },
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
  fila: { flexDirection: 'row', gap: espaciado.sm, marginTop: espaciado.xs },
  panel: {
    marginTop: espaciado.sm,
    padding: espaciado.md,
    borderRadius: radios.md,
    backgroundColor: colores.papel,
  },
  movimiento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: espaciado.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
  },
  movimientoTexto: { flex: 1, fontSize: 13, color: colores.tinta },
  movimientoMonto: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hora: { fontSize: 12, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  denominaciones: { gap: 6, marginBottom: espaciado.md },
  denominacion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  denominacionTexto: { fontSize: 15, fontWeight: '600', color: colores.tinta, fontVariant: ['tabular-nums'] },
  denominacionInput: {
    width: 84,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.sm,
    backgroundColor: colores.blanco,
    paddingHorizontal: espaciado.sm,
    textAlign: 'right',
    fontSize: 15,
    color: colores.tinta,
    fontVariant: ['tabular-nums'],
  },
  contado: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: espaciado.md,
    borderRadius: radios.md,
    backgroundColor: colores.papel,
    marginBottom: espaciado.md,
  },
  contadoEtiqueta: { fontSize: 14, fontWeight: '600', color: colores.tinta },
  contadoValor: { fontSize: 24, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  diferencia: { borderRadius: radios.md, padding: espaciado.md },
  diferenciaTitulo: { fontSize: 20, fontWeight: '800' },
  diferenciaDetalle: { fontSize: 13, marginTop: 2 },
  desglose: { flexDirection: 'row', justifyContent: 'space-between', gap: espaciado.sm },
  desgloseTotal: { borderTopWidth: 1, borderTopColor: colores.papelLinea, paddingTop: 6 },
  desgloseTexto: { flex: 1, fontSize: 13, color: colores.tintaSuave },
  desgloseMonto: { fontSize: 13, color: colores.tinta, fontVariant: ['tabular-nums'] },
});
