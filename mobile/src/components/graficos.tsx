import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarraQueCrece } from './movimiento';
import { colores, espaciado } from '../theme/colores';
import { formatearCentavos } from '../lib/formato';
import { aFecha, fechaLarga } from '../lib/periodo';
import type { ProductoVendido, PuntoSerie } from '../lib/tipos';

/**
 * Gráficos del resumen, armados con Views (sin librería de SVG: son barras
 * simples). Mismas reglas que en la web: una sola serie → un solo color,
 * sin leyenda; la rejilla por detrás; los textos en colores de texto; y
 * cada barra se puede tocar para leer su valor exacto.
 */

// Ámbar un paso más oscuro que el de la marca: contraste 4:1 sobre la tarjeta.
const SERIE = '#b06f1c';
const ALTO = 140;

function textos(punto: PuntoSerie, agrupadoPor: 'hora' | 'dia', muchos: boolean) {
  if (agrupadoPor === 'hora') {
    return { eje: `${punto.etiqueta}h`, detalle: `${punto.etiqueta}:00 a ${punto.etiqueta}:59` };
  }
  const fecha = aFecha(punto.etiqueta);
  return {
    eje: muchos
      ? String(fecha.getDate())
      : `${fecha.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '')} ${fecha.getDate()}`,
    detalle: fechaLarga(punto.etiqueta),
  };
}

export function GraficoIngreso({
  datos,
  agrupadoPor,
}: {
  datos: PuntoSerie[];
  agrupadoPor: 'hora' | 'dia';
}) {
  const [activo, setActivo] = useState<number | null>(null);

  // Un rango sin ventas llega con todos los días en 0.
  if (datos.every((d) => d.centavos === 0)) {
    return <Text style={styles.vacio}>Todavía no hay ventas para graficar.</Text>;
  }

  const maximo = Math.max(...datos.map((d) => d.centavos));
  const indiceMaximo = datos.findIndex((d) => d.centavos === maximo);
  const muchos = datos.length > 10;
  const etiquetas = datos.map((d) => textos(d, agrupadoPor, muchos));
  // Con muchos puntos, una etiqueta cada tanto: si no, se pisan.
  const salto = Math.ceil(datos.length / (agrupadoPor === 'dia' && !muchos ? 7 : 6));
  // La barra tocada puede no existir más si cambió el período (se tocó el
  // día 25 de "Este mes" y se pasó a "Hoy"): entonces, la más alta.
  const elegido = activo !== null && activo < datos.length ? activo : indiceMaximo;

  return (
    <View>
      {/* Lo que dice la barra tocada (o la más alta, de entrada). */}
      <Text style={styles.lectura}>
        <Text style={styles.lecturaValor}>{formatearCentavos(datos[elegido].centavos)}</Text>
        {'  '}
        {etiquetas[elegido].detalle}
        {activo === null ? ' · el más alto' : ''}
      </Text>

      <View style={styles.trazado}>
        <View style={[styles.rejilla, { top: 0 }]} />
        <View style={[styles.rejilla, { top: ALTO / 2 }]} />
        <View style={styles.barras}>
          {datos.map((d, i) => (
            <Pressable
              key={d.etiqueta}
              onPress={() => setActivo(i === activo ? null : i)}
              style={styles.columna}
              accessibilityRole="button"
              accessibilityLabel={`${etiquetas[i].detalle}: ${formatearCentavos(d.centavos)}`}
            >
              {d.centavos > 0 && (
                // Crecen desde la base, una detrás de otra.
                <BarraQueCrece
                  orden={i}
                  style={[
                    styles.barra,
                    {
                      height: Math.max(2, (d.centavos / maximo) * ALTO),
                      opacity: activo === null || activo === i ? 1 : 0.5,
                      marginHorizontal: datos.length > 20 ? 0.5 : datos.length > 10 ? 1.5 : 4,
                    },
                  ]}
                />
              )}
            </Pressable>
          ))}
        </View>
        <View style={[styles.rejilla, { top: ALTO }]} />
      </View>

      {/* Las etiquetas se posicionan sueltas: con 30 días cada columna mide
          unos 10px y un texto adentro se cortaría. Las del final se anclan
          por la derecha para no salirse de la tarjeta. */}
      <View style={styles.eje}>
        {datos.map((d, i) => {
          if (i % salto !== 0) return null;
          const inicio = (i / datos.length) * 100;
          const alFinal = inicio > 80;
          return (
            <Text
              key={d.etiqueta}
              style={[
                styles.ejeTexto,
                alFinal
                  ? { right: `${100 - ((i + 1) / datos.length) * 100}%`, textAlign: 'right' }
                  : { left: `${inicio}%` },
              ]}
              numberOfLines={1}
            >
              {etiquetas[i].eje}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export function GraficoTopProductos({ datos }: { datos: ProductoVendido[] }) {
  if (datos.length === 0) {
    return <Text style={styles.vacio}>Todavía no hay ventas para graficar.</Text>;
  }
  const maximo = Math.max(...datos.map((d) => d.unidades));
  return (
    <View style={{ gap: espaciado.sm }}>
      {datos.map((d, i) => (
        <View
          key={d.nombre}
          accessible
          accessibilityLabel={`${d.nombre}: ${d.unidades} unidades, ${formatearCentavos(d.centavos)}`}
        >
          <View style={styles.productoFila}>
            <Text style={styles.productoNombre} numberOfLines={1}>
              {d.nombre}
            </Text>
            <Text style={styles.productoUnidades}>{d.unidades}</Text>
          </View>
          <BarraQueCrece
            horizontal
            orden={i}
            style={[styles.productoBarra, { width: `${Math.max(2, (d.unidades / maximo) * 100)}%` }]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { fontSize: 13, color: colores.tintaSuave },
  lectura: { fontSize: 12, color: colores.tintaSuave, marginBottom: espaciado.sm },
  lecturaValor: { fontSize: 15, fontWeight: '800', color: colores.tinta, fontVariant: ['tabular-nums'] },
  trazado: { height: ALTO, position: 'relative' },
  rejilla: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colores.papelLinea },
  barras: { flexDirection: 'row', alignItems: 'flex-end', height: ALTO },
  columna: { flex: 1, height: ALTO, justifyContent: 'flex-end' },
  barra: { backgroundColor: SERIE, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  eje: { height: 16, marginTop: 4 },
  ejeTexto: { position: 'absolute', width: 48, fontSize: 10, color: colores.tintaSuave },
  productoFila: { flexDirection: 'row', justifyContent: 'space-between', gap: espaciado.sm },
  productoNombre: { flex: 1, fontSize: 13, color: colores.tinta },
  productoUnidades: { fontSize: 13, fontWeight: '700', color: colores.tinta, fontVariant: ['tabular-nums'] },
  productoBarra: { height: 8, marginTop: 4, borderRadius: 4, backgroundColor: SERIE },
});
