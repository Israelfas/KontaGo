import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AvisoDeCampo, Boton, Etiqueta, estilosCampo } from './ui';
import { HojaModal, HojaPie, useHoja } from './hoja-modal';
import { formatearCentavos } from '../lib/formato';
import { formatearCantidad, importeCentavos, leerCantidad, precioPor, redondear } from '../lib/cantidad';
import { colores, espaciado, radios } from '../theme/colores';
import type { Producto } from '../lib/tipos';

// Lo que más se pide en una tienda: un cuarto, media, una, dos.
const RAPIDAS = [0.25, 0.5, 1, 2];

/**
 * Cuánto se lleva de algo que va por peso: con un toque (media libra), el
 * peso exacto de la balanza, o por cuánto dinero ("un dólar de queso").
 */
export function HojaPeso({
  producto,
  inicial,
  maximo,
  onListo,
  onCerrar,
}: {
  producto: Producto;
  // Cambiando lo que ya está en el carrito.
  inicial?: number;
  // Sin conexión: lo que queda según el último stock guardado.
  maximo?: number;
  onListo: (cantidad: number) => void;
  onCerrar: () => void;
}) {
  return (
    <HojaModal
      titulo={`¿Cuánto de ${producto.nombre}?`}
      descripcion={`${formatearCentavos(producto.precioVentaCentavos)}${precioPor(producto.unidad)}`}
      icono="scale-outline"
      onCerrar={onCerrar}
    >
      <FormularioPeso producto={producto} inicial={inicial} maximo={maximo} onListo={onListo} />
    </HojaModal>
  );
}

function FormularioPeso({
  producto,
  inicial,
  maximo,
  onListo,
}: {
  producto: Producto;
  inicial?: number;
  maximo?: number;
  onListo: (cantidad: number) => void;
}) {
  const { cerrar } = useHoja();
  const unidad = producto.unidad === 'kilo' ? 'kilo' : 'libra';
  const corta = unidad === 'kilo' ? 'kg' : 'lb';
  const [texto, setTexto] = useState(inicial !== undefined ? String(inicial) : '');
  const [dinero, setDinero] = useState('');
  const [error, setError] = useState<string | null>(null);

  const centavos = dinero.trim() ? Math.round(parseFloat(dinero.replace(',', '.')) * 100) : NaN;
  const porDinero =
    Number.isFinite(centavos) && centavos > 0 && producto.precioVentaCentavos > 0
      ? redondear(centavos / producto.precioVentaCentavos)
      : null;
  const cantidad = porDinero ?? leerCantidad(texto, unidad);

  function elegir(valor: number | null) {
    if (valor === null || valor <= 0) {
      setError(`Pon cuánto: por ejemplo 0,5 (media ${unidad}) o 1,25.`);
      return;
    }
    if (maximo !== undefined && valor > maximo) {
      setError(
        maximo <= 0
          ? `Según el último stock guardado, no queda ${producto.nombre}.`
          : `Según el último stock guardado, quedan ${formatearCantidad(maximo, unidad)}.`,
      );
      return;
    }
    onListo(valor);
  }

  return (
    <View>
      <View style={styles.rapidas}>
        {RAPIDAS.map((valor) => (
          <Pressable
            key={valor}
            onPress={() => elegir(valor)}
            style={({ pressed }) => [styles.rapida, pressed && { borderColor: colores.tinta }]}
            accessibilityRole="button"
          >
            <Text style={styles.rapidaCantidad}>{formatearCantidad(valor, unidad)}</Text>
            <Text style={styles.rapidaPrecio}>
              {formatearCentavos(importeCentavos(producto.precioVentaCentavos, valor))}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <View style={{ flex: 1 }}>
          <Etiqueta>{`Cantidad (${corta})`}</Etiqueta>
          <TextInput
            value={porDinero !== null ? String(porDinero) : texto}
            onChangeText={(t) => {
              setTexto(t);
              setDinero('');
              setError(null);
            }}
            keyboardType="decimal-pad"
            style={estilosCampo.input}
            placeholder="0,5"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Etiqueta>O por dinero ($)</Etiqueta>
          <TextInput
            value={dinero}
            onChangeText={(t) => {
              setDinero(t);
              setError(null);
            }}
            keyboardType="decimal-pad"
            style={estilosCampo.input}
            placeholder="1.00"
          />
        </View>
      </View>

      {cantidad !== null && cantidad > 0 && (
        <Text style={styles.resumen}>
          {formatearCantidad(cantidad, unidad)} ·{' '}
          <Text style={{ fontWeight: '800' }}>
            {formatearCentavos(importeCentavos(producto.precioVentaCentavos, cantidad))}
          </Text>
        </Text>
      )}
      <AvisoDeCampo error={error} />

      <HojaPie>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
        <Boton onPress={() => elegir(cantidad)} style={{ flex: 1 }}>
          {inicial !== undefined ? 'Cambiar' : 'Agregar'}
        </Boton>
      </HojaPie>
    </View>
  );
}

const styles = StyleSheet.create({
  rapidas: { flexDirection: 'row', gap: espaciado.sm, marginBottom: espaciado.md },
  rapida: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    backgroundColor: '#fff',
    paddingVertical: espaciado.md,
  },
  rapidaCantidad: { fontSize: 14, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  rapidaPrecio: { fontSize: 12, color: colores.tintaSuave, marginTop: 2, fontVariant: ['tabular-nums'] },
  resumen: { fontSize: 14, color: colores.tinta, marginTop: espaciado.sm },
});
