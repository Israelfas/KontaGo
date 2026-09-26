import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  darDeBajaProducto,
  reactivarProducto,
  listarProductosDadosDeBaja,
  ApiError,
} from '../lib/api';
import {
  esFechaValida,
  escribirFecha,
  formatearCentavos,
  formatearFechaCorta,
} from '../lib/formato';
import { resumenDeLotes, tieneVariosLotes } from '../lib/lotes';
import { aCentavos, avisoDelMargen, avisoDelVencimiento } from '../lib/validacion';
import {
  AvisoDeCampo,
  Boton,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Etiqueta,
  Tarjeta,
  estilosCampo,
} from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import { HojaModal, HojaPie, useHoja } from '../components/hoja-modal';
import { Banda, DatosBanda, LabioHoja } from '../components/banda';
import { Ficha } from '../components/ficha';
import { NivelStock, Pildora } from '../components/estado';
import { estadoDelVencimiento } from '../lib/vencimiento';
import type { Producto } from '../lib/tipos';
import {
  UNIDADES,
  formatearCantidad,
  leerCantidad,
  porPeso,
  precioPor,
  type UnidadDeVenta,
} from '../lib/cantidad';
import {
  esCodigoInterno,
  estaPorVencer,
  filtrarProductos,
  porReponer,
  textoDelCodigo,
  type FiltroProductos,
} from '../lib/filtro-productos';

// El backend exige exactamente "AAAA-MM-DD" (una fecha de calendario,
// sin hora ni zona horaria). Sin librería de selector de fecha (para no
// meter una dependencia nativa nueva): los guiones se ponen solos al
// tipear (escribirFecha) y se valida que la fecha exista.

// Editar la fecha desde acá evita el rodeo de tocar "editar" → abrir el
// formulario completo → buscar el campo → guardar → volver — pensado
// para cuando hay que cargar la fecha de varios productos seguidos.
function ChipFechaVencimiento({
  producto,
  onActualizado,
  soloLectura,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
  soloLectura: boolean;
}) {
  const { token } = useAuth();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(producto.fechaVencimiento ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaValida = !valor || esFechaValida(valor);

  async function guardar() {
    if (!token || !fechaValida) return;
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        fechaVencimiento: valor || undefined,
        quitarFechaVencimiento: !valor,
      });
      onActualizado(actualizado);
      setEditando(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la fecha');
    } finally {
      setGuardando(false);
    }
  }

  // Varias fechas: no hay "una" fecha que editar acá (se corrigen en
  // Inventario → Lotes).
  if (tieneVariosLotes(producto)) {
    const estado = estadoDelVencimiento(producto.fechaVencimiento!);
    return (
      <View accessible accessibilityLabel={resumenDeLotes(producto)}>
        <Pildora
          texto={`${producto.lotes!.length} fechas · ${estado.texto.toLowerCase()}`}
          tono={estado.tono}
        />
      </View>
    );
  }

  if (editando) {
    return (
      <View>
      <View style={styles.chipFechaEdicion}>
        <TextInput
          value={valor}
          onChangeText={(t) => setValor(escribirFecha(t))}
          maxLength={10}
          placeholder="AAAA-MM-DD"
          keyboardType="number-pad"
          autoFocus
          style={styles.chipFechaInput}
          onSubmitEditing={guardar}
        />
        <Pressable onPress={guardar} disabled={guardando || !fechaValida} hitSlop={8}>
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={fechaValida ? colores.verdeGanancia : colores.papelLinea}
          />
        </Pressable>
        <Pressable onPress={() => setEditando(false)} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={colores.tintaSuave} />
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  const estado = producto.fechaVencimiento ? estadoDelVencimiento(producto.fechaVencimiento) : null;

  if (soloLectura) {
    return estado ? (
      <Pildora texto={estado.texto} tono={estado.tono} />
    ) : (
      <Text style={styles.noVence}>No vence</Text>
    );
  }

  const abrir = () => {
    setValor(producto.fechaVencimiento ?? '');
    setEditando(true);
  };

  // Sin fecha: un botón discreto (antes, "Poner fecha de vencimiento" en
  // cada producto parecía un error de todos).
  if (!estado) {
    return (
      <Pressable
        onPress={abrir}
        hitSlop={6}
        style={styles.botonFecha}
        accessibilityRole="button"
        accessibilityLabel={`Poner fecha de vencimiento a ${producto.nombre}`}
      >
        <Ionicons name="add" size={12} color={colores.tintaSuave} />
        <Text style={styles.botonFechaTexto}>Fecha</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={abrir} hitSlop={6} accessibilityRole="button" accessibilityHint="Cambiar la fecha">
      <Pildora texto={estado.texto} tono={estado.tono} />
    </Pressable>
  );
}

function FilaProducto({
  producto,
  onEditar,
  onActualizado,
  soloLectura,
}: {
  producto: Producto;
  onEditar: () => void;
  onActualizado: (p: Producto) => void;
  soloLectura: boolean;
}) {
  const { stock, stockMinimo, unidad } = producto;
  const estadoStock =
    stock <= 0 ? 'agotado' : stockMinimo > 0 && stock <= stockMinimo ? 'bajo' : 'bien';
  // El cajero no recibe el costo: solo ve el precio.
  const costo = producto.costoUnitarioCentavos ?? 0;
  const pierde = costo > 0 && producto.precioVentaCentavos < costo;
  const sinCodigo = esCodigoInterno(producto.codigoBarras);

  const tarjeta = (
    <Tarjeta style={styles.filaTarjeta}>
      <View style={styles.filaArriba}>
        <Ficha nombre={producto.nombre} semilla={producto.categoria} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.filaNombre} numberOfLines={1}>
            {producto.nombre}
          </Text>
          <View style={styles.filaMeta}>
            {producto.categoria ? <Text style={styles.filaCodigo}>{producto.categoria}</Text> : null}
            {sinCodigo ? (
              <View style={styles.etiquetaDato}>
                <Text style={styles.etiquetaDatoTexto}>Sin código</Text>
              </View>
            ) : (
              <Text style={styles.filaCodigo}>{producto.codigoBarras}</Text>
            )}
            {porPeso(unidad) && (
              <View style={[styles.etiquetaDato, styles.etiquetaDatoAmbar]}>
                <Text style={[styles.etiquetaDatoTexto, { color: '#9a5f14' }]}>
                  Por {unidad === 'libra' ? 'libra' : 'kilo'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.filaPrecio}>
            {formatearCentavos(producto.precioVentaCentavos)}
            <Text style={styles.filaPrecioPor}>{precioPor(unidad)}</Text>
          </Text>
          {costo > 0 &&
            (pierde ? (
              <View style={{ marginTop: 3 }}>
                <Pildora texto="Bajo el costo" tono="danger" />
              </View>
            ) : (
              <Text style={styles.filaCosto}>costo {formatearCentavos(costo)}</Text>
            ))}
        </View>
      </View>

      <View style={styles.filaAbajo}>
        <View style={{ flexShrink: 1 }}>
          <View style={styles.filaStockFila}>
            {estadoStock !== 'bien' && (
              <Pildora
                texto={estadoStock === 'agotado' ? 'Agotado' : 'Bajo'}
                tono={estadoStock === 'agotado' ? 'danger' : 'warning'}
              />
            )}
            <Text style={styles.filaStock}>
              {formatearCantidad(stock, unidad)}
              <Text style={styles.filaStockNota}> en stock</Text>
            </Text>
          </View>
          <NivelStock
            stock={stock}
            minimo={stockMinimo}
            nota={`mín ${formatearCantidad(stockMinimo, unidad)}`}
          />
        </View>
        <View style={styles.filaAcciones}>
          <ChipFechaVencimiento
            producto={producto}
            onActualizado={onActualizado}
            soloLectura={soloLectura}
          />
          {!soloLectura && (
            <View style={styles.editarBoton}>
              <Ionicons name="pencil-outline" size={14} color={colores.tinta} />
            </View>
          )}
        </View>
      </View>
    </Tarjeta>
  );

  if (soloLectura) return tarjeta;
  // Toda la tarjeta abre la edición (la fecha se sigue editando en su lugar).
  return (
    <Pressable
      onPress={onEditar}
      accessibilityRole="button"
      accessibilityLabel={`Editar ${producto.nombre}`}
      style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }}
    >
      {tarjeta}
    </Pressable>
  );
}

/** Cómo se vende: por unidad o por peso (el precio y el stock van en esa unidad). */
function SelectorUnidad({ valor, onCambio }: { valor: UnidadDeVenta; onCambio: (u: UnidadDeVenta) => void }) {
  return (
    <View style={styles.selectorUnidad} accessibilityRole="radiogroup" accessibilityLabel="Cómo se vende">
      {UNIDADES.map((u) => {
        const activa = valor === u.valor;
        return (
          <Pressable
            key={u.valor}
            onPress={() => onCambio(u.valor)}
            style={[styles.opcionUnidad, activa && styles.opcionUnidadActiva]}
            accessibilityRole="radio"
            accessibilityState={{ checked: activa }}
          >
            <Text style={[styles.opcionUnidadTexto, activa && styles.opcionUnidadTextoActiva]}>{u.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Precio de venta" o "Precio de venta por libra". */
function etiquetaPor(base: string, unidad: UnidadDeVenta): string {
  if (unidad === 'libra') return `${base} por libra`;
  if (unidad === 'kilo') return `${base} por kilo`;
  return base;
}

/** " (lb)" en las etiquetas de stock si va por peso. */
function enUnidad(unidad: UnidadDeVenta): string {
  return unidad === 'libra' ? ' (lb)' : unidad === 'kilo' ? ' (kg)' : '';
}

function FormularioNuevoProducto({ onCreado }: { onCreado: (p: Producto) => void }) {
  const { cerrar: onCerrar } = useHoja();
  const { token } = useAuth();
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [costoUnitario, setCostoUnitario] = useState('');
  const [stockInicial, setStockInicial] = useState('');
  const [stockMinimo, setStockMinimo] = useState('');
  const [unidad, setUnidad] = useState<UnidadDeVenta>('unidad');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // La fecha es del stock inicial: sin unidades no hay qué venza.
  const sinStockInicial = !((leerCantidad(stockInicial, unidad) ?? 0) > 0);
  const fechaValida = sinStockInicial || !fechaVencimiento || esFechaValida(fechaVencimiento);
  const avisoMargen = avisoDelMargen(aCentavos(precioVenta), aCentavos(costoUnitario));

  async function manejarSubmit() {
    if (!token || !fechaValida) return;
    setError(null);
    const stock = stockInicial.trim() ? leerCantidad(stockInicial, unidad, true) : undefined;
    const minimo = stockMinimo.trim() ? leerCantidad(stockMinimo, unidad, true) : undefined;
    if (stock === null || minimo === null) {
      setError(
        porPeso(unidad)
          ? 'Revisa el stock: un número con hasta 3 decimales (por ejemplo 12,5).'
          : 'Revisa el stock: va en unidades enteras. Si se vende por peso, elige "Por libra" o "Por kilo".',
      );
      return;
    }
    setEnviando(true);
    try {
      const producto = await crearProducto(token, {
        codigoBarras: codigoBarras.trim() || undefined,
        nombre: nombre.trim(),
        precioVentaCentavos: Math.round(parseFloat(precioVenta || '0') * 100),
        costoUnitarioCentavos: costoUnitario
          ? Math.round(parseFloat(costoUnitario) * 100)
          : undefined,
        stockInicial: stock,
        stockMinimo: minimo,
        unidad,
        fechaVencimiento: (!sinStockInicial && fechaVencimiento) || undefined,
      });
      onCreado(producto);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View>
      <Etiqueta>Código de barras (opcional)</Etiqueta>
      <TextInput
        value={codigoBarras}
        onChangeText={setCodigoBarras}
        style={estilosCampo.input}
        placeholder="7791234567890"
      />
      <Text style={styles.ayudaCampo}>
        Si no tiene (pan, huevos, lo suelto), déjalo vacío: al vender lo buscas por su nombre.
      </Text>
      <Etiqueta>Nombre</Etiqueta>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        style={estilosCampo.input}
        placeholder="Coca Cola 500ml"
      />
      <Etiqueta>Cómo se vende</Etiqueta>
      <SelectorUnidad valor={unidad} onCambio={setUnidad} />
      {porPeso(unidad) && (
        <Text style={styles.ayudaCampo}>
          Arroz, azúcar, queso: al vender se pone cuánto (media libra, 2 libras) o por cuánto dinero.
        </Text>
      )}
      <Etiqueta>{etiquetaPor('Precio de venta', unidad)}</Etiqueta>
      <TextInput
        value={precioVenta}
        onChangeText={setPrecioVenta}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="1.50"
      />
      <Etiqueta>{`${unidad === 'unidad' ? 'Costo unitario' : etiquetaPor('Costo', unidad)} (opcional)`}</Etiqueta>
      <TextInput
        value={costoUnitario}
        onChangeText={setCostoUnitario}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
        placeholder="0.90"
      />
      <AvisoDeCampo advertencia={avisoMargen} />
      <Etiqueta>{`Stock inicial${enUnidad(unidad)} (opcional)`}</Etiqueta>
      <TextInput
        value={stockInicial}
        onChangeText={setStockInicial}
        keyboardType={porPeso(unidad) ? 'decimal-pad' : 'number-pad'}
        style={estilosCampo.input}
        placeholder="20"
      />
      <Etiqueta>{`Stock mínimo${enUnidad(unidad)} (opcional)`}</Etiqueta>
      <TextInput
        value={stockMinimo}
        onChangeText={setStockMinimo}
        keyboardType={porPeso(unidad) ? 'decimal-pad' : 'number-pad'}
        style={estilosCampo.input}
        placeholder="5"
      />
      <Etiqueta>Vence el (opcional)</Etiqueta>
      <TextInput
        value={sinStockInicial ? '' : fechaVencimiento}
        onChangeText={(t) => setFechaVencimiento(escribirFecha(t))}
        editable={!sinStockInicial}
        style={[estilosCampo.input, sinStockInicial && { opacity: 0.5 }]}
        placeholder={sinStockInicial ? 'Primero carga el stock inicial' : 'AAAA-MM-DD'}
        keyboardType="number-pad"
        maxLength={10}
      />
      <AvisoDeCampo
        error={!fechaValida && fechaVencimiento.length === 10 ? 'Esa fecha no existe.' : null}
        advertencia={
          sinStockInicial || !fechaValida ? null : avisoDelVencimiento(fechaVencimiento)
        }
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <HojaPie>
        <Boton
          onPress={manejarSubmit}
          cargando={enviando}
          disabled={!nombre || !precioVenta || !fechaValida}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </HojaPie>
    </View>
  );
}

function FormularioEditarProducto({
  producto,
  onActualizado,
  onDadoDeBaja,
}: {
  producto: Producto;
  onActualizado: (p: Producto) => void;
  onDadoDeBaja: (p: Producto) => void;
}) {
  const { cerrar: onCerrar } = useHoja();
  const { token } = useAuth();
  const [precioVenta, setPrecioVenta] = useState((producto.precioVentaCentavos / 100).toFixed(2));
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo.toString());
  const [unidad, setUnidad] = useState<UnidadDeVenta>(producto.unidad);
  const [fechaVencimiento, setFechaVencimiento] = useState(producto.fechaVencimiento ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const variosLotes = tieneVariosLotes(producto);
  const cambioLaFecha = !variosLotes && fechaVencimiento !== (producto.fechaVencimiento ?? '');
  const fechaValida = !cambioLaFecha || !fechaVencimiento || esFechaValida(fechaVencimiento);
  const avisoMargen = avisoDelMargen(aCentavos(precioVenta), producto.costoUnitarioCentavos);

  async function darDeBaja() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      onDadoDeBaja(await darDeBajaProducto(token, producto.id));
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo dar de baja el producto');
      setConfirmandoBaja(false);
    } finally {
      setEnviando(false);
    }
  }

  async function manejarSubmit() {
    if (!token || !fechaValida) return;
    setError(null);
    const minimo = stockMinimo.trim() ? leerCantidad(stockMinimo, unidad, true) : 0;
    if (minimo === null) {
      setError(
        porPeso(unidad)
          ? 'Revisa el stock mínimo: un número con hasta 3 decimales.'
          : 'Revisa el stock mínimo: va en unidades enteras.',
      );
      return;
    }
    setEnviando(true);
    try {
      const actualizado = await actualizarProducto(token, producto.id, {
        precioVentaCentavos: Math.round(parseFloat(precioVenta || '0') * 100),
        stockMinimo: minimo,
        ...(unidad !== producto.unidad ? { unidad } : {}),
        // Solo si se tocó: con varios lotes la fecha no se edita acá.
        ...(cambioLaFecha
          ? {
              fechaVencimiento: fechaVencimiento || undefined,
              quitarFechaVencimiento: !fechaVencimiento,
            }
          : {}),
      });
      onActualizado(actualizado);
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el producto');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View>
      {/* Qué se está tocando, a la vista mientras se edita. */}
      <View style={styles.ficha}>
        <View style={{ flex: 1.4 }}>
          <Text style={styles.fichaEtiqueta}>CÓDIGO</Text>
          <Text style={styles.fichaValor} numberOfLines={1}>
            {textoDelCodigo(producto.codigoBarras)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fichaEtiqueta}>STOCK</Text>
          <Text style={styles.fichaValor}>{formatearCantidad(producto.stock, producto.unidad)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fichaEtiqueta}>COSTO</Text>
          <Text style={styles.fichaValor}>
            {producto.costoUnitarioCentavos > 0
              ? formatearCentavos(producto.costoUnitarioCentavos)
              : '—'}
          </Text>
        </View>
      </View>

      <Etiqueta>Cómo se vende</Etiqueta>
      <SelectorUnidad valor={unidad} onCambio={setUnidad} />
      <Etiqueta>{etiquetaPor('Precio de venta', unidad)}</Etiqueta>
      <TextInput
        value={precioVenta}
        onChangeText={setPrecioVenta}
        keyboardType="decimal-pad"
        style={estilosCampo.input}
      />
      <AvisoDeCampo
        advertencia={avisoMargen}
        ayuda={
          producto.costoUnitarioCentavos > 0
            ? `Costo: ${formatearCentavos(producto.costoUnitarioCentavos)}`
            : null
        }
      />
      <Etiqueta>{`Stock mínimo${enUnidad(unidad)}`}</Etiqueta>
      <TextInput
        value={stockMinimo}
        onChangeText={setStockMinimo}
        keyboardType={porPeso(unidad) ? 'decimal-pad' : 'number-pad'}
        style={estilosCampo.input}
      />
      <Etiqueta>Fecha de vencimiento</Etiqueta>
      {variosLotes ? (
        <Text style={styles.notaLotes}>
          {resumenDeLotes(producto)}.{'\n'}Tiene varias fechas: se corrigen en Inventario → Lotes.
        </Text>
      ) : (
        <TextInput
          value={fechaVencimiento}
          onChangeText={(t) => setFechaVencimiento(escribirFecha(t))}
          style={estilosCampo.input}
          placeholder="AAAA-MM-DD (vacío = sin vencimiento)"
          keyboardType="number-pad"
          maxLength={10}
        />
      )}
      <AvisoDeCampo
        error={!fechaValida && fechaVencimiento.length === 10 ? 'Esa fecha no existe.' : null}
        advertencia={cambioLaFecha && fechaValida ? avisoDelVencimiento(fechaVencimiento) : null}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Confirmación en dos pasos: la baja saca el producto de la caja,
          no conviene que un toque perdido lo haga. */}
      {confirmandoBaja ? (
        <View style={styles.confirmacionBaja}>
          <Text style={styles.confirmacionTexto}>
            <Text style={{ fontWeight: '700' }}>{producto.nombre}</Text> dejará de aparecer en el
            catálogo y no se podrá vender. Sus ventas pasadas se conservan, y puedes reactivarlo
            después.
          </Text>
          <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
            <Boton variante="danger" onPress={darDeBaja} cargando={enviando} style={{ flex: 1 }}>
              Sí, dar de baja
            </Boton>
            <Boton variante="ghost" onPress={() => setConfirmandoBaja(false)} style={{ flex: 1 }}>
              No
            </Boton>
          </View>
        </View>
      ) : (
        <>
          <HojaPie>
            <Boton
              onPress={manejarSubmit}
              cargando={enviando}
              disabled={!precioVenta || !fechaValida}
              style={{ flex: 1 }}
            >
              Guardar cambios
            </Boton>
            <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
              Cancelar
            </Boton>
          </HojaPie>
          <Pressable
            onPress={() => setConfirmandoBaja(true)}
            disabled={enviando}
            hitSlop={8}
            style={styles.botonBaja}
          >
            <Ionicons name="archive-outline" size={16} color={colores.rojoPerdida} />
            <Text style={styles.botonBajaTexto}>Dar de baja</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// Plegada por defecto y cargada recién al abrirla: es algo que se mira
// de vez en cuando, no en cada visita al catálogo.
function SeccionDadosDeBaja({
  dadosDeBaja,
  abierta,
  onAlternar,
  onReactivado,
}: {
  dadosDeBaja: Producto[] | null;
  abierta: boolean;
  onAlternar: () => void;
  onReactivado: (p: Producto) => void;
}) {
  const { token } = useAuth();
  const [reactivandoId, setReactivandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reactivar(producto: Producto) {
    if (!token) return;
    setError(null);
    setReactivandoId(producto.id);
    try {
      onReactivado(await reactivarProducto(token, producto.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reactivar el producto');
    } finally {
      setReactivandoId(null);
    }
  }

  return (
    <View style={styles.seccionBaja}>
      <Pressable onPress={onAlternar} hitSlop={8} style={styles.seccionBajaToggle}>
        <Ionicons
          name={abierta ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colores.tintaSuave}
        />
        <Text style={styles.seccionBajaToggleTexto}>
          {abierta ? 'Ocultar productos dados de baja' : 'Ver productos dados de baja'}
        </Text>
      </Pressable>

      {abierta && (
        <View style={{ gap: espaciado.sm, marginTop: espaciado.sm }}>
          {error && <Text style={styles.error}>{error}</Text>}
          {dadosDeBaja === null && <Text style={styles.filaCodigo}>Cargando…</Text>}
          {dadosDeBaja?.length === 0 && (
            <Text style={styles.filaCodigo}>No hay productos dados de baja.</Text>
          )}
          {dadosDeBaja?.map((p) => (
            <Tarjeta key={p.id} style={styles.filaTarjeta}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filaNombre, { color: colores.tintaSuave }]} numberOfLines={1}>
                  {p.nombre}
                </Text>
                <Text style={styles.filaCodigo}>
                  {textoDelCodigo(p.codigoBarras)} · Stock {formatearCantidad(p.stock, p.unidad)}
                </Text>
              </View>
              <Boton
                variante="secondary"
                onPress={() => reactivar(p)}
                cargando={reactivandoId === p.id}
                disabled={reactivandoId !== null}
                style={styles.botonReactivar}
              >
                Reactivar
              </Boton>
            </Tarjeta>
          ))}
        </View>
      )}
    </View>
  );
}

function BarraBusqueda({
  productos,
  busqueda,
  onBusqueda,
  filtro,
  onFiltro,
}: {
  productos: Producto[];
  busqueda: string;
  onBusqueda: (v: string) => void;
  filtro: FiltroProductos;
  onFiltro: (f: FiltroProductos) => void;
}) {
  const opciones: { id: FiltroProductos; texto: string; cantidad?: number }[] = [
    { id: 'todos', texto: 'Todos' },
    { id: 'stock_bajo', texto: 'Por reponer', cantidad: productos.filter(porReponer).length },
    { id: 'por_vencer', texto: 'Por vencer', cantidad: productos.filter(estaPorVencer).length },
  ];
  return (
    <View style={{ gap: espaciado.sm, marginBottom: espaciado.md }}>
      <View style={styles.busquedaCampo}>
        <Ionicons name="search" size={16} color={colores.tintaSuave} />
        <TextInput
          value={busqueda}
          onChangeText={onBusqueda}
          placeholder="Buscar por nombre o código"
          autoCorrect={false}
          style={styles.busquedaInput}
        />
        {busqueda ? (
          <Pressable onPress={() => onBusqueda('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colores.tintaSuave} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: espaciado.xs }}>
        {opciones.map((o) => {
          const activo = filtro === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onFiltro(o.id)}
              style={[styles.chip, activo && styles.chipActivo]}
            >
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                {o.texto}
                {o.cantidad ? ` ${o.cantidad}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Los números del catálogo que importan, en la franja de arriba. */
function DatosDelCatalogo({ productos, esAdmin }: { productos: Producto[]; esAdmin: boolean }) {
  const agotados = productos.filter((p) => p.stock <= 0).length;
  const aReponer = productos.filter(porReponer).length;
  const porVencer = productos.filter(estaPorVencer).length;
  const valorACosto = productos.reduce(
    (acc, p) => acc + Math.round((p.costoUnitarioCentavos ?? 0) * Math.max(0, p.stock)),
    0,
  );
  const valorAPrecio = productos.reduce(
    (acc, p) => acc + Math.round(p.precioVentaCentavos * Math.max(0, p.stock)),
    0,
  );
  return (
    <DatosBanda
      datos={[
        ...(esAdmin && valorACosto > 0
          ? [{ etiqueta: 'Inventario a costo', valor: formatearCentavos(valorACosto) }]
          : []),
        { etiqueta: 'Si vendes todo', valor: formatearCentavos(valorAPrecio) },
        {
          etiqueta: 'Por reponer',
          valor: String(aReponer),
          nota: agotados > 0 ? `· ${agotados} agotado${agotados === 1 ? '' : 's'}` : undefined,
          alerta: aReponer > 0,
        },
        { etiqueta: 'Vencen en 7 días', valor: String(porVencer), alerta: porVencer > 0 },
      ]}
    />
  );
}

export function ProductosScreen() {
  const { token, usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  // null = todavía no se pidió (la sección arranca plegada).
  const [dadosDeBaja, setDadosDeBaja] = useState<Producto[] | null>(null);
  const [dadosDeBajaAbierta, setDadosDeBajaAbierta] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  // Una copia del producto (no su id): si se da de baja, la hoja puede irse
  // con su animación aunque ya no esté en la lista.
  const [editando, setEditando] = useState<Producto | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroProductos>('todos');
  const productosVisibles = filtrarProductos(productos, busqueda, filtro);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    setError(null);
    listarProductos(token)
      .then(setProductos)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo'))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  function alternarDadosDeBaja() {
    const abrir = !dadosDeBajaAbierta;
    setDadosDeBajaAbierta(abrir);
    if (abrir && dadosDeBaja === null && token) {
      listarProductosDadosDeBaja(token)
        .then(setDadosDeBaja)
        .catch(() => setDadosDeBaja([]));
    }
  }

  function manejarDadoDeBaja(producto: Producto) {
    setProductos((prev) => prev.filter((p) => p.id !== producto.id));
    setDadosDeBaja((prev) => (prev ? [producto, ...prev] : prev));
  }

  function manejarReactivado(producto: Producto) {
    setDadosDeBaja((prev) => prev?.filter((p) => p.id !== producto.id) ?? prev);
    setProductos((prev) =>
      [...prev, producto].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
  }

  return (
    <SafeAreaView style={styles.contenedor} edges={[]}>
      <Banda
        eyebrow="Catálogo"
        titulo="Productos"
        valor={productos.length > 0 ? String(productos.length) : undefined}
        detalle={
          productos.length > 0
            ? `${productos.length === 1 ? 'producto activo' : 'productos activos'} en el catálogo${
                esAdmin ? '' : ' · solo consulta'
              }`
            : undefined
        }
        accion={
          esAdmin ? (
            <Pressable onPress={() => setNuevoAbierto(true)} style={styles.botonNuevo} hitSlop={8}>
              <Ionicons name="add" size={18} color={colores.tinta} />
              <Text style={styles.botonNuevoTexto}>Nuevo</Text>
            </Pressable>
          ) : undefined
        }
      >
        {productos.length > 0 && <DatosDelCatalogo productos={productos} esAdmin={esAdmin} />}
      </Banda>
      <LabioHoja />

      <FlatList
        data={productosVisibles}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <FilaProducto
            producto={item}
            soloLectura={!esAdmin}
            onEditar={() => setEditando(item)}
            onActualizado={(actualizado) =>
              setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)))
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: espaciado.sm }} />}
        contentContainerStyle={styles.listaContenido}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {!cargando && !error && productos.length > 0 && (
              <BarraBusqueda
                productos={productos}
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                filtro={filtro}
                onFiltro={setFiltro}
              />
            )}
          </View>
        }
        ListFooterComponent={
          !cargando && !error && esAdmin ? (
            <SeccionDadosDeBaja
              dadosDeBaja={dadosDeBaja}
              abierta={dadosDeBajaAbierta}
              onAlternar={alternarDadosDeBaja}
              onReactivado={manejarReactivado}
            />
          ) : null
        }
        ListEmptyComponent={
          !cargando && !error && productos.length > 0 ? (
            <EstadoVacio
              icono="search-outline"
              titulo="Ningún producto coincide"
              descripcion="Prueba con otro nombre o código, o quita el filtro."
            />
          ) : !cargando && !error ? (
            <EstadoVacio
              icono="cube-outline"
              titulo="Todavía no hay productos"
              descripcion='Usa "+ Nuevo" para empezar a cargar tu catálogo.'
            />
          ) : null
        }
      />

      {cargando && <EstadoCargando texto="Cargando catálogo…" />}
      {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}
      {nuevoAbierto && (
        <HojaModal
          titulo="Nuevo producto"
          descripcion="Se suma al catálogo y ya se puede vender."
          icono="add"
          onCerrar={() => setNuevoAbierto(false)}
        >
          <FormularioNuevoProducto onCreado={(p) => setProductos((prev) => [p, ...prev])} />
        </HojaModal>
      )}
      {editando && (
        <HojaModal
          titulo={editando.nombre}
          descripcion="Precio, stock mínimo y vencimiento."
          icono="pencil-outline"
          onCerrar={() => setEditando(null)}
        >
          <FormularioEditarProducto
            producto={editando}
            onActualizado={(actualizado) =>
              setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)))
            }
            onDadoDeBaja={manejarDadoDeBaja}
          />
        </HojaModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ficha: {
    flexDirection: 'row',
    gap: espaciado.sm,
    backgroundColor: colores.papel,
    borderRadius: radios.md,
    padding: espaciado.md,
    marginBottom: espaciado.md,
  },
  fichaEtiqueta: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: colores.tintaSuave },
  fichaValor: { marginTop: 2, fontSize: 15, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  notaLotes: { fontSize: 13, color: colores.tinta, lineHeight: 19, marginBottom: espaciado.md },
  contenedor: { flex: 1, backgroundColor: colores.papel },
  // Va sobre la franja oscura: borde claro en vez de fondo oscuro.
  botonNuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.xs,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.xs,
    borderRadius: radios.full,
    backgroundColor: colores.papel,
  },
  botonNuevoTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  busquedaCampo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    paddingHorizontal: espaciado.md,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: colores.blanco,
  },
  busquedaInput: { flex: 1, paddingVertical: espaciado.md, fontSize: 15, color: colores.tinta },
  chip: {
    paddingHorizontal: espaciado.md,
    paddingVertical: 6,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    backgroundColor: colores.superficie,
  },
  chipActivo: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  chipTexto: { fontSize: 12, fontWeight: '600', color: colores.tintaSuave },
  chipTextoActivo: { color: colores.papel },
  listaContenido: { padding: espaciado.lg, paddingTop: 0, flexGrow: 1 },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  filaTarjeta: { paddingVertical: espaciado.md, gap: espaciado.sm },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: espaciado.md },
  filaMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  etiquetaDato: {
    borderRadius: 6,
    backgroundColor: 'rgba(28,43,58,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  etiquetaDatoAmbar: { backgroundColor: 'rgba(217,140,43,0.14)' },
  etiquetaDatoTexto: { fontSize: 10.5, fontWeight: '700', color: colores.tintaSuave },
  filaAbajo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaciado.sm,
    borderTopWidth: 1,
    borderTopColor: colores.papelLinea,
    paddingTop: espaciado.sm,
  },
  filaStockFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaStockNota: { fontSize: 11, fontWeight: '400', color: colores.tintaSuave },
  filaAcciones: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm },
  filaPrecioPor: { fontSize: 11, fontWeight: '400', color: colores.tintaSuave },
  filaCosto: { marginTop: 2, fontSize: 11, color: colores.tintaSuave, fontVariant: ['tabular-nums'] },
  noVence: { fontSize: 11, color: colores.tintaSuave },
  botonFecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.papelLinea,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  botonFechaTexto: { fontSize: 11, fontWeight: '700', color: colores.tintaSuave },
  filaIconoFondo: {
    width: 38,
    height: 38,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaNombre: { fontSize: 14, color: colores.tinta, fontWeight: '600' },
  selectorUnidad: { flexDirection: 'row', gap: espaciado.sm, marginBottom: espaciado.sm },
  opcionUnidad: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: '#fff',
    paddingVertical: espaciado.sm + 2,
  },
  opcionUnidadActiva: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  opcionUnidadTexto: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  opcionUnidadTextoActiva: { color: colores.papel },
  ayudaCampo: { fontSize: 12, color: colores.tintaSuave, marginTop: -4, marginBottom: espaciado.sm },
  filaCodigo: { fontSize: 11, color: colores.tintaSuave, marginTop: 2, fontVariant: ['tabular-nums'] },
  filaVencimiento: { fontSize: 11, color: colores.ambar, marginTop: 2, fontWeight: '600' },
  chipFechaEdicion: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs, marginTop: 4 },
  chipFechaInput: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.sm,
    paddingHorizontal: espaciado.sm,
    paddingVertical: 4,
    fontSize: 11,
    color: colores.tinta,
    backgroundColor: colores.blanco,
    width: 100,
  },
  editarBoton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,43,58,0.06)',
  },
  botonBaja: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaciado.xs,
    marginTop: espaciado.md,
    paddingVertical: espaciado.xs,
  },
  botonBajaTexto: { fontSize: 13, color: colores.rojoPerdida, fontWeight: '600' },
  confirmacionBaja: {
    marginTop: espaciado.md,
    padding: espaciado.md,
    gap: espaciado.sm,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: 'rgba(182,70,47,0.3)',
    backgroundColor: 'rgba(182,70,47,0.05)',
  },
  confirmacionTexto: { fontSize: 13, color: colores.tinta, lineHeight: 18 },
  seccionBaja: { marginTop: espaciado.lg },
  seccionBajaToggle: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs },
  seccionBajaToggleTexto: { fontSize: 13, color: colores.tintaSuave, fontWeight: '600' },
  botonReactivar: { paddingHorizontal: espaciado.md, minHeight: 36 },
  filaPrecio: { fontSize: 14, color: colores.tinta, fontVariant: ['tabular-nums'], fontWeight: '600' },
  stockPill: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radios.full },
  stockPillBajo: { backgroundColor: 'rgba(217,140,43,0.14)' },
  filaStock: { fontSize: 14, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  filaStockBajo: { color: '#a8610b', fontWeight: '700' },
});