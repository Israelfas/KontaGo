import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { estilosCampo } from './ui';
import { EscanerCamara } from './escaner-camara';
import { colores, espaciado, radios } from '../theme/colores';
import type { Producto } from '../lib/tipos';
import { textoDelCodigo } from '../lib/filtro-productos';
import { formatearCantidad } from '../lib/cantidad';

// Sin tildes ni mayúsculas: "yogur" encuentra "Yogurt Toni", "limon" a "Limón".
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Campo para elegir un producto del catálogo: abre un buscador (por
 * nombre o código) con opción de escanear. Reemplaza a la lista de un
 * botón por producto, que con un catálogo real ocupaba pantallas enteras.
 */
export function SelectorProducto({
  productos,
  seleccionadoId,
  onSeleccionar,
}: {
  productos: Producto[];
  seleccionadoId: string;
  onSeleccionar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const seleccionado = productos.find((p) => p.id === seleccionadoId);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return productos;
    return productos.filter(
      (p) => normalizar(p.nombre).includes(q) || p.codigoBarras.startsWith(q),
    );
  }, [busqueda, productos]);

  function abrir() {
    setBusqueda('');
    setAviso(null);
    setEscaneando(false);
    setAbierto(true);
  }

  function elegir(id: string) {
    onSeleccionar(id);
    setAbierto(false);
  }

  function manejarEscaneo(codigo: string) {
    const producto = productos.find((p) => p.codigoBarras === codigo);
    if (producto) {
      elegir(producto.id);
    } else {
      setEscaneando(false);
      setAviso(`No hay ningún producto con el código ${codigo}.`);
    }
  }

  return (
    <>
      <Pressable onPress={abrir} style={styles.campo}>
        <View style={{ flex: 1 }}>
          {seleccionado ? (
            <>
              <Text style={styles.campoNombre} numberOfLines={1}>
                {seleccionado.nombre}
              </Text>
              <Text style={styles.campoDetalle}>
                Stock actual: {formatearCantidad(seleccionado.stock, seleccionado.unidad)}
              </Text>
            </>
          ) : (
            <Text style={styles.campoPlaceholder}>Elige un producto…</Text>
          )}
        </View>
        <Ionicons name="search" size={18} color={colores.tintaSuave} />
      </Pressable>

      <Modal
        visible={abierto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierto(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalCabecera}>
            <Text style={styles.modalTitulo}>Elige un producto</Text>
            <Pressable onPress={() => setAbierto(false)} hitSlop={10}>
              <Ionicons name="close" size={24} color={colores.tinta} />
            </Pressable>
          </View>

          {escaneando ? (
            <EscanerCamara
              onDetectado={manejarEscaneo}
              onCerrar={() => setEscaneando(false)}
              estilo={{ marginHorizontal: 0 }}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
              <TextInput
                value={busqueda}
                onChangeText={(t) => {
                  setBusqueda(t);
                  setAviso(null);
                }}
                placeholder="Busca por nombre o código"
                autoFocus
                autoCorrect={false}
                style={[estilosCampo.input, { flex: 1, marginBottom: 0 }]}
              />
              <Pressable
                onPress={() => setEscaneando(true)}
                style={styles.botonEscanear}
                accessibilityLabel="Escanear código de barras"
              >
                <Ionicons name="barcode-outline" size={22} color={colores.tinta} />
              </Pressable>
            </View>
          )}

          {aviso && <Text style={styles.aviso}>{aviso}</Text>}

          <FlatList
            data={resultados}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            style={{ marginTop: espaciado.md }}
            ItemSeparatorComponent={() => <View style={styles.separador} />}
            renderItem={({ item }) => {
              const activo = item.id === seleccionadoId;
              return (
                <Pressable
                  onPress={() => elegir(item.id)}
                  style={[styles.fila, activo && styles.filaActiva]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filaNombre} numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text style={styles.filaDetalle}>
                      {textoDelCodigo(item.codigoBarras)} · stock {formatearCantidad(item.stock, item.unidad)}
                    </Text>
                  </View>
                  {activo && (
                    <Ionicons name="checkmark-circle" size={20} color={colores.verdeGanancia} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.vacio}>Ningún producto coincide con “{busqueda}”.</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    minHeight: 48,
    paddingHorizontal: espaciado.md,
    paddingVertical: espaciado.sm,
    marginBottom: espaciado.md,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: colores.blanco,
  },
  campoNombre: { fontSize: 14, fontWeight: '600', color: colores.tinta },
  campoDetalle: { fontSize: 12, color: colores.tintaSuave, marginTop: 1 },
  campoPlaceholder: { fontSize: 14, color: colores.tintaSuave },
  modal: { flex: 1, backgroundColor: colores.papel, padding: espaciado.lg },
  modalCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: espaciado.md,
  },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: colores.tinta },
  botonEscanear: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: colores.superficie,
  },
  aviso: { marginTop: espaciado.sm, fontSize: 13, color: colores.rojoPerdida },
  separador: { height: 1, backgroundColor: colores.papelLinea },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    paddingVertical: espaciado.md,
    paddingHorizontal: espaciado.sm,
  },
  filaActiva: { backgroundColor: 'rgba(47,111,79,0.06)' },
  filaNombre: { fontSize: 15, fontWeight: '600', color: colores.tinta },
  filaDetalle: { fontSize: 12, color: colores.tintaSuave, marginTop: 2, fontVariant: ['tabular-nums'] },
  vacio: { textAlign: 'center', color: colores.tintaSuave, marginTop: espaciado.xl },
});
