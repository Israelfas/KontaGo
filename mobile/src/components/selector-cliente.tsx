import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { ApiError, crearCliente, listarClientes } from '../lib/api';
import { normalizar } from '../lib/filtro-productos';
import { textoDelSaldo } from '../lib/fiado';
import { AvisoDeCampo, Etiqueta, estilosCampo } from './ui';
import { colores, espaciado, radios } from '../theme/colores';
import type { ClienteFiado } from '../lib/tipos';

/**
 * A quién se le fía: se busca por nombre y, si no está, se anota ahí
 * mismo (con el nombre alcanza; el celular se agrega después en Fiados).
 */
export function SelectorCliente({
  elegido,
  onElegir,
}: {
  elegido: ClienteFiado | null;
  onElegir: (cliente: ClienteFiado | null) => void;
}) {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteFiado[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    listarClientes(token)
      .then((lista) => vigente && setClientes(lista))
      .catch(
        () =>
          vigente && setError('No se pudo cargar la lista de clientes. Revisa la conexión y vuelve a elegir Fiado.'),
      );
    return () => {
      vigente = false;
    };
  }, [token]);

  if (elegido) {
    return (
      <View style={styles.elegido}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre} numberOfLines={1}>
            {elegido.nombre}
          </Text>
          <Text style={styles.detalle}>{textoDelSaldo(elegido.saldoCentavos)}</Text>
        </View>
        <Pressable onPress={() => onElegir(null)} hitSlop={8} accessibilityRole="button">
          <Text style={styles.enlace}>Cambiar</Text>
        </Pressable>
      </View>
    );
  }

  const q = normalizar(busqueda);
  const encontrados = (clientes ?? []).filter((c) => !q || normalizar(c.nombre).includes(q)).slice(0, 5);
  const existeExacto = (clientes ?? []).some((c) => normalizar(c.nombre) === q);

  async function anotarNuevo() {
    if (!token || busqueda.trim().length < 2) return;
    setError(null);
    setCreando(true);
    try {
      const nuevo = await crearCliente(token, { nombre: busqueda.trim() });
      onElegir({ ...nuevo, saldoCentavos: 0, ultimoMovimiento: null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anotar el cliente');
    } finally {
      setCreando(false);
    }
  }

  return (
    <View>
      <Etiqueta>¿A quién se le fía?</Etiqueta>
      <TextInput
        value={busqueda}
        onChangeText={setBusqueda}
        style={estilosCampo.input}
        placeholder="Nombre del cliente"
        placeholderTextColor={colores.tintaSuave}
        autoCorrect={false}
      />
      {clientes === null && !error && <ActivityIndicator color={colores.tintaSuave} />}
      {encontrados.length > 0 && (
        <View style={styles.lista}>
          {encontrados.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => onElegir(c)}
              style={({ pressed }) => [styles.fila, i > 0 && styles.filaBorde, pressed && { backgroundColor: colores.papel }]}
              accessibilityRole="button"
            >
              <Text style={styles.nombre} numberOfLines={1}>
                {c.nombre}
              </Text>
              <Text style={styles.detalle}>{textoDelSaldo(c.saldoCentavos)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {busqueda.trim().length >= 2 && !existeExacto && clientes !== null && (
        <Pressable onPress={anotarNuevo} disabled={creando} style={styles.nuevo} accessibilityRole="button">
          <Text style={styles.nuevoTexto}>
            {creando ? 'Anotando…' : `+ Anotar a “${busqueda.trim()}” como cliente nuevo`}
          </Text>
        </Pressable>
      )}
      <AvisoDeCampo error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  elegido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaciado.sm,
    backgroundColor: colores.papel,
    borderRadius: radios.md,
    padding: espaciado.md,
  },
  nombre: { flex: 1, fontSize: 14, fontWeight: '700', color: colores.tinta },
  detalle: { fontSize: 12, color: colores.tintaSuave },
  enlace: { fontSize: 13, fontWeight: '700', color: colores.tinta, textDecorationLine: 'underline' },
  lista: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginBottom: espaciado.sm,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm, padding: espaciado.md },
  filaBorde: { borderTopWidth: 1, borderTopColor: colores.papelLinea },
  nuevo: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    padding: espaciado.md,
  },
  nuevoTexto: { fontSize: 13, color: colores.tinta, fontWeight: '600' },
});
