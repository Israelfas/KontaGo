import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import {
  ApiError,
  abonarCliente,
  actualizarCliente,
  crearCliente,
  listarClientes,
  obtenerCliente,
} from '../lib/api';
import { formatearCentavos, numeroDeTicket } from '../lib/formato';
import { formatearCantidad } from '../lib/cantidad';
import { normalizar } from '../lib/filtro-productos';
import { enlaceWhatsApp, fechaYHora, textoDelSaldo } from '../lib/fiado';
import { AvisoDeCampo, Boton, Etiqueta, EstadoCargando, EstadoError, EstadoVacio, estilosCampo } from '../components/ui';
import { Banda, DatosBanda, Hoja } from '../components/banda';
import { Ficha } from '../components/ficha';
import { BarraFina, Pildora, TituloGrupo } from '../components/estado';
import { haceCuanto } from '../lib/vencimiento';
import { HojaModal, HojaPie, useHoja } from '../components/hoja-modal';
import { vibrar } from '../components/movimiento';
import { colores, espaciado, radios } from '../theme/colores';
import type { ClienteFiado, DetalleClienteFiado, MetodoDeAbono, MovimientoDeFiado } from '../lib/tipos';

function FormularioNuevoCliente({ onCreado }: { onCreado: () => void }) {
  const { token } = useAuth();
  const { cerrar } = useHoja();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      await crearCliente(token, { nombre: nombre.trim(), telefono: telefono.trim() || undefined });
      onCreado();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anotar el cliente');
      setEnviando(false);
    }
  }

  return (
    <View>
      <Etiqueta>Nombre</Etiqueta>
      <TextInput value={nombre} onChangeText={setNombre} style={estilosCampo.input} placeholder="Doña Rosa" />
      <Etiqueta>Celular (opcional)</Etiqueta>
      <TextInput
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        style={estilosCampo.input}
        placeholder="099 123 4567"
      />
      <Text style={styles.ayuda}>Para recordarle por WhatsApp lo que debe, con un toque.</Text>
      <AvisoDeCampo error={error} />
      <HojaPie>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
        <Boton onPress={guardar} cargando={enviando} disabled={nombre.trim().length < 2} style={{ flex: 1 }}>
          Anotar
        </Boton>
      </HojaPie>
    </View>
  );
}

function FormularioAbono({ cliente, onAbonado }: { cliente: DetalleClienteFiado; onAbonado: () => void }) {
  const { token } = useAuth();
  const [monto, setMonto] = useState((cliente.saldoCentavos / 100).toFixed(2));
  const [metodo, setMetodo] = useState<MetodoDeAbono>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function registrar() {
    if (!token) return;
    const centavos = Math.round(parseFloat(monto.replace(',', '.')) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) {
      setError('Pon cuánto paga.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await abonarCliente(token, cliente.id, { montoCentavos: centavos, metodoPago: metodo });
      vibrar.exito();
      onAbonado();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el abono');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.abono}>
      <Text style={styles.abonoTitulo}>Registrar un abono</Text>
      <Etiqueta>Cuánto paga</Etiqueta>
      <TextInput value={monto} onChangeText={setMonto} keyboardType="decimal-pad" style={estilosCampo.input} />
      <View style={styles.metodos} accessibilityRole="radiogroup">
        {(
          [
            ['efectivo', 'Efectivo'],
            ['transferencia', 'Transferencia'],
          ] as const
        ).map(([valor, texto]) => (
          <Pressable
            key={valor}
            onPress={() => setMetodo(valor)}
            accessibilityRole="radio"
            accessibilityState={{ checked: metodo === valor }}
            style={[styles.metodo, metodo === valor && styles.metodoActivo]}
          >
            <Text style={[styles.metodoTexto, metodo === valor && styles.metodoTextoActivo]}>{texto}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.ayuda}>
        {metodo === 'efectivo'
          ? 'Entra a tu caja (tiene que estar abierta).'
          : 'Confirma en el celular que llegó la transferencia.'}
      </Text>
      <AvisoDeCampo error={error} />
      <Boton variante="success" onPress={registrar} cargando={enviando}>
        Registrar abono
      </Boton>
    </View>
  );
}

function FilaMovimiento({ movimiento }: { movimiento: MovimientoDeFiado }) {
  if (movimiento.tipo === 'abono') {
    return (
      <View style={styles.movimiento}>
        <View style={{ flex: 1 }}>
          <Text style={styles.movimientoTitulo}>
            Abono en {movimiento.metodoPago === 'efectivo' ? 'efectivo' : 'transferencia'}
          </Text>
          <Text style={styles.movimientoDetalle}>
            {fechaYHora(movimiento.fecha)} · recibió {movimiento.registradoPor}
          </Text>
        </View>
        <Text style={[styles.movimientoMonto, { color: colores.verdeGanancia }]}>
          −{formatearCentavos(movimiento.montoCentavos)}
        </Text>
      </View>
    );
  }
  const neto = movimiento.totalCentavos - movimiento.anuladoCentavos;
  return (
    <View style={styles.movimiento}>
      <View style={{ flex: 1 }}>
        <Text style={styles.movimientoTitulo}>
          Ticket {numeroDeTicket(movimiento.numero)}
          {movimiento.anuladoCentavos > 0 && (
            <Text style={{ color: colores.rojoPerdida }}>
              {neto === 0 ? ' (anulado)' : ` (anulado ${formatearCentavos(movimiento.anuladoCentavos)})`}
            </Text>
          )}
        </Text>
        <Text style={styles.movimientoDetalle} numberOfLines={2}>
          {fechaYHora(movimiento.fecha)} ·{' '}
          {movimiento.items.map((i) => `${formatearCantidad(i.cantidad, i.unidad)} ${i.nombre}`).join(', ')}
        </Text>
      </View>
      <Text style={styles.movimientoMonto}>+{formatearCentavos(neto)}</Text>
    </View>
  );
}

function DetalleCliente({ clienteId, onCambio }: { clienteId: string; onCambio: () => void }) {
  const { token, usuario } = useAuth();
  const { cerrar } = useHoja();
  const [cliente, setCliente] = useState<DetalleClienteFiado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    obtenerCliente(token, clienteId)
      .then(setCliente)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el cliente'));
  }, [token, clienteId]);

  useEffect(cargar, [cargar]);

  async function archivar() {
    if (!token || !cliente) return;
    try {
      await actualizarCliente(token, cliente.id, { activo: false });
      onCambio();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo archivar');
    }
  }

  if (error) return <EstadoError mensaje={error} />;
  if (!cliente) return <EstadoCargando texto="Cargando su cuenta…" />;

  const whatsapp =
    cliente.telefono && cliente.saldoCentavos > 0
      ? enlaceWhatsApp(
          cliente.telefono,
          `Hola ${cliente.nombre}, te saludamos de la tienda. Tu cuenta del fiado está en ${formatearCentavos(cliente.saldoCentavos)}. ¡Gracias!`,
        )
      : null;

  return (
    <View>
      <Text style={styles.saldoEtiqueta}>
        {cliente.saldoCentavos > 0 ? 'DEBE' : cliente.saldoCentavos < 0 ? 'A FAVOR' : 'AL DÍA'}
      </Text>
      <Text style={styles.saldo}>{formatearCentavos(Math.abs(cliente.saldoCentavos))}</Text>
      {cliente.telefono && <Text style={styles.movimientoDetalle}>{cliente.telefono}</Text>}
      {whatsapp && (
        <Boton variante="secondary" onPress={() => void Linking.openURL(whatsapp)} style={{ marginTop: espaciado.sm }}>
          Recordarle por WhatsApp
        </Boton>
      )}
      {aviso && <Text style={styles.aviso}>{aviso}</Text>}

      {cliente.saldoCentavos > 0 && (
        <FormularioAbono
          key={cliente.saldoCentavos}
          cliente={cliente}
          onAbonado={() => {
            setAviso('Abono registrado.');
            cargar();
            onCambio();
          }}
        />
      )}

      <Text style={styles.seccion}>Movimientos</Text>
      {cliente.movimientos.length === 0 ? (
        <Text style={styles.ayuda}>Todavía no tiene compras al fiado.</Text>
      ) : (
        cliente.movimientos.map((m) => <FilaMovimiento key={`${m.tipo}-${m.id}`} movimiento={m} />)
      )}

      {usuario?.rol === 'admin' && cliente.saldoCentavos === 0 && (
        <Pressable onPress={archivar} style={{ marginTop: espaciado.md }} accessibilityRole="button">
          <Text style={styles.enlace}>Archivar (ya no se le fía)</Text>
        </Pressable>
      )}
    </View>
  );
}

export function FiadosScreen() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteFiado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<ClienteFiado | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setError(null);
    listarClientes(token)
      .then(setClientes)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el fiado'));
  }, [token]);
  useFocusEffect(cargar);

  const deudores = (clientes ?? []).filter((c) => c.saldoCentavos > 0);
  const porCobrar = deudores.reduce((acc, c) => acc + c.saldoCentavos, 0);
  const q = normalizar(busqueda);
  const visibles = (clientes ?? []).filter((c) => !q || normalizar(c.nombre).includes(q));
  // Primero los que deben (de más a menos), después los que están al día.
  const conDeuda = visibles.filter((c) => c.saldoCentavos > 0).sort((a, b) => b.saldoCentavos - a.saldoCentavos);
  const alDia = visibles.filter((c) => c.saldoCentavos <= 0);
  const deudaMayor = Math.max(1, ...deudores.map((c) => c.saldoCentavos));
  // La deuda que lleva más tiempo sin moverse: la primera a cobrar.
  const masQuieta = [...deudores]
    .filter((c) => c.ultimoMovimiento)
    .sort((a, b) => a.ultimoMovimiento!.localeCompare(b.ultimoMovimiento!))[0];

  const filaDeCliente = (c: ClienteFiado, i: number) => (
    <Pressable
      key={c.id}
      onPress={() => setAbierto(c)}
      style={({ pressed }) => [styles.fila, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      accessibilityRole="button"
    >
      <Ficha nombre={c.nombre} redonda />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.filaNombre} numberOfLines={1}>
          {c.nombre}
        </Text>
        <Text style={styles.movimientoDetalle} numberOfLines={1}>
          {c.ultimoMovimiento ? `Último movimiento ${haceCuanto(c.ultimoMovimiento)}` : 'Sin movimientos todavía'}
          {c.telefono ? ' · con WhatsApp' : ''}
        </Text>
        {c.saldoCentavos > 0 && (
          <View style={{ marginTop: 6, maxWidth: 180 }}>
            <BarraFina
              fraccion={c.saldoCentavos / deudaMayor}
              color={colores.rojoPerdida}
              fondo="rgba(182,70,47,0.1)"
              orden={i}
            />
          </View>
        )}
      </View>
      <Pildora
        texto={textoDelSaldo(c.saldoCentavos).replace(/^./, (l) => l.toUpperCase())}
        tono={c.saldoCentavos > 0 ? 'danger' : c.saldoCentavos < 0 ? 'info' : 'ok'}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Banda
          eyebrow="Fiados"
          titulo="Por cobrar"
          valor={clientes ? formatearCentavos(porCobrar) : undefined}
          detalle={
            clientes ? (deudores.length === 0 ? 'Nadie debe nada.' : 'Lo que te deben entre todos los clientes.') : undefined
          }
        >
          {clientes && clientes.length > 0 && (
            <DatosBanda
              datos={[
                {
                  etiqueta: 'Con deuda',
                  valor: String(deudores.length),
                  nota: `de ${clientes.length} cliente${clientes.length === 1 ? '' : 's'}`,
                  alerta: deudores.length > 0,
                },
                ...(deudores.length > 0
                  ? [{ etiqueta: 'Debe más', valor: formatearCentavos(deudaMayor) }]
                  : []),
                ...(masQuieta && haceCuanto(masQuieta.ultimoMovimiento!) !== 'hoy'
                  ? [{ etiqueta: 'Sin moverse', valor: haceCuanto(masQuieta.ultimoMovimiento!) }]
                  : []),
              ]}
            />
          )}
        </Banda>
        <Hoja style={styles.hoja}>
          <Boton onPress={() => setCreando(true)}>Nuevo cliente</Boton>
          {error && <EstadoError mensaje={error} onReintentar={cargar} />}
          {!clientes && !error && <EstadoCargando texto="Cargando el fiado…" />}
          {clientes && clientes.length === 0 && (
            <EstadoVacio
              icono="book-outline"
              titulo="Todavía no le fías a nadie"
              descripcion="Al vender, elige Fiado y anota al cliente: aquí vas a ver cuánto debe cada uno y sus abonos."
            />
          )}
          {clientes && clientes.length > 0 && (
            <>
              <TextInput
                value={busqueda}
                onChangeText={setBusqueda}
                style={[estilosCampo.input, { marginBottom: 0 }]}
                placeholder="Buscar cliente"
                placeholderTextColor={colores.tintaSuave}
              />
              {visibles.length === 0 && <Text style={styles.ayuda}>Ningún cliente con ese nombre.</Text>}
              {conDeuda.length > 0 && (
                <View style={{ marginTop: espaciado.sm, gap: espaciado.sm }}>
                  <TituloGrupo texto="Te deben" cantidad={conDeuda.length} />
                  {conDeuda.map(filaDeCliente)}
                </View>
              )}
              {alDia.length > 0 && (
                <View style={{ marginTop: espaciado.md, gap: espaciado.sm }}>
                  <TituloGrupo texto="Al día" cantidad={alDia.length} />
                  {alDia.map(filaDeCliente)}
                </View>
              )}
            </>
          )}
        </Hoja>
      </ScrollView>

      {creando && (
        <HojaModal
          titulo="Nuevo cliente"
          descripcion="Alguien de confianza a quien le fías."
          icono="person-add-outline"
          onCerrar={() => setCreando(false)}
        >
          <FormularioNuevoCliente onCreado={cargar} />
        </HojaModal>
      )}
      {abierto && (
        <HojaModal titulo={abierto.nombre} icono="book-outline" onCerrar={() => setAbierto(null)}>
          <DetalleCliente clienteId={abierto.id} onCambio={cargar} />
        </HojaModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  hoja: { paddingHorizontal: espaciado.lg, paddingBottom: espaciado.xxl, gap: espaciado.sm },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.md,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.lg,
    padding: espaciado.md,
  },
  filaNombre: { fontSize: 15, fontWeight: '700', color: colores.tinta },
  filaSaldo: { fontSize: 13, fontWeight: '700', color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  ayuda: { fontSize: 12, color: colores.tintaSuave, marginBottom: espaciado.sm },
  aviso: { fontSize: 13, color: colores.verdeGanancia, fontWeight: '700', marginTop: espaciado.sm },
  saldoEtiqueta: { fontSize: 11, fontWeight: '700', color: colores.tintaSuave, letterSpacing: 0.6 },
  saldo: { fontSize: 30, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  abono: { backgroundColor: colores.papel, borderRadius: radios.md, padding: espaciado.md, marginTop: espaciado.md },
  abonoTitulo: { fontSize: 14, fontWeight: '800', color: colores.tinta, marginBottom: espaciado.sm },
  metodos: { flexDirection: 'row', gap: espaciado.sm, marginBottom: espaciado.sm },
  metodo: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: '#fff',
    paddingVertical: espaciado.sm + 2,
  },
  metodoActivo: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  metodoTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  metodoTextoActivo: { color: colores.papel },
  seccion: { fontSize: 12, fontWeight: '800', color: colores.tintaSuave, marginTop: espaciado.lg, marginBottom: 4 },
  movimiento: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaciado.sm,
    paddingVertical: espaciado.sm,
    borderBottomWidth: 1,
    borderBottomColor: colores.papelLinea,
  },
  movimientoTitulo: { fontSize: 14, color: colores.tinta, fontWeight: '600' },
  movimientoDetalle: { fontSize: 12, color: colores.tintaSuave, marginTop: 2 },
  movimientoMonto: { fontSize: 14, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  enlace: { fontSize: 12, color: colores.tintaSuave, textDecorationLine: 'underline' },
});
