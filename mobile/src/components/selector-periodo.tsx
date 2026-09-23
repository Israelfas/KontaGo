import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Boton } from './ui';
import { HojaModal, useHoja } from './hoja-modal';
import { colores, espaciado, radios } from '../theme/colores';
import {
  OPCIONES_PERIODO,
  aFecha,
  diasDelPeriodo,
  fechaISO,
  hoyISO,
  periodoElegido,
  periodoPredefinido,
  problemaDelRango,
  rangoLegible,
  type Periodo,
} from '../lib/periodo';

/**
 * Botones de período para la franja oscura (van como children de Banda).
 * "Elegir fechas" abre un calendario propio en vez de un selector nativo:
 * así no se suma una dependencia nativa, y se elige el rango entero en
 * una sola vista (primer toque: desde; segundo: hasta).
 */
export function SelectorPeriodo({
  periodo,
  onCambiar,
}: {
  periodo: Periodo;
  onCambiar: (p: Periodo) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.fila}
        contentContainerStyle={styles.filaContenido}
        accessibilityLabel="Período"
      >
        {OPCIONES_PERIODO.map((opcion) => (
          <Chip
            key={opcion.clave}
            texto={opcion.texto}
            activo={periodo.clave === opcion.clave}
            onPress={() => onCambiar(periodoPredefinido(opcion.clave))}
          />
        ))}
        <Chip
          texto={periodo.clave === 'elegido' ? rangoLegible(periodo) : 'Elegir fechas'}
          icono="calendar-outline"
          activo={periodo.clave === 'elegido'}
          onPress={() => setEligiendo(true)}
        />
      </ScrollView>

      {eligiendo && (
        <CalendarioRango
          inicial={periodo}
          onCerrar={() => setEligiendo(false)}
          // La hoja se cierra sola (con su animación) después de elegir.
          onElegir={onCambiar}
        />
      )}
    </>
  );
}

function Chip({
  texto,
  activo,
  icono,
  onPress,
}: {
  texto: string;
  activo: boolean;
  icono?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        pressed && (activo ? styles.chipActivoPresionado : styles.chipPresionado),
      ]}
    >
      {icono && (
        <Ionicons name={icono} size={14} color={activo ? colores.tinta : 'rgba(246,243,236,0.84)'} />
      )}
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{texto}</Text>
    </Pressable>
  );
}

// La semana arranca el lunes, como en los calendarios de Ecuador.
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function CalendarioRango({
  inicial,
  onCerrar,
  onElegir,
}: {
  inicial: Periodo;
  onCerrar: () => void;
  onElegir: (p: Periodo) => void;
}) {
  const hoy = hoyISO();
  const [desde, setDesde] = useState<string | null>(inicial.desde);
  const [hasta, setHasta] = useState<string | null>(inicial.hasta);
  const [mes, setMes] = useState(() => {
    const d = aFecha(inicial.hasta);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const esMesActual =
    mes.getFullYear() === new Date().getFullYear() && mes.getMonth() === new Date().getMonth();
  const diasDelMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  // getDay(): 0 = domingo. Huecos antes del día 1 con la semana desde el lunes.
  const huecos = (mes.getDay() + 6) % 7;
  const celdas: (string | null)[] = [
    ...Array.from({ length: huecos }, () => null),
    ...Array.from({ length: diasDelMes }, (_, i) =>
      fechaISO(new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
    ),
  ];
  const tituloMes = mes.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });

  function tocar(dia: string) {
    // Primer toque (o después de un rango completo): empieza uno nuevo.
    if (!desde || hasta) {
      setDesde(dia);
      setHasta(null);
    } else if (dia < desde) {
      setDesde(dia);
    } else {
      setHasta(dia);
    }
  }

  const fin = hasta ?? desde;
  const problema = desde && fin ? problemaDelRango(desde, fin) : null;
  const resumen =
    desde && fin
      ? `${rangoLegible({ clave: 'elegido', desde, hasta: fin })} · ${diasDelPeriodo(desde, fin)} día${
          diasDelPeriodo(desde, fin) === 1 ? '' : 's'
        }`
      : 'Tocá el primer día';

  return (
    <HojaModal
      titulo="Elegir fechas"
      descripcion={
        desde && !hasta
          ? 'Ahora tocá el último día (o Ver, para un solo día).'
          : 'Tocá el primer día y después el último.'
      }
      icono="calendar-outline"
      onCerrar={onCerrar}
    >
      <View style={{ gap: espaciado.sm }}>
        <View style={styles.navMes}>
          <Pressable
            onPress={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            hitSlop={10}
            style={({ pressed }) => [styles.flecha, pressed && styles.flechaPresionada]}
            accessibilityLabel="Mes anterior"
          >
            <Ionicons name="chevron-back" size={22} color={colores.tinta} />
          </Pressable>
          <Text style={styles.tituloMes}>{tituloMes[0].toUpperCase() + tituloMes.slice(1)}</Text>
          <Pressable
            onPress={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            disabled={esMesActual}
            hitSlop={10}
            style={({ pressed }) => [styles.flecha, pressed && styles.flechaPresionada]}
            accessibilityLabel="Mes siguiente"
            accessibilityState={{ disabled: esMesActual }}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={esMesActual ? colores.papelLinea : colores.tinta}
            />
          </Pressable>
        </View>

        <View style={styles.grilla}>
          {DIAS_SEMANA.map((d, i) => (
            <Text key={i} style={[styles.celda, styles.diaSemana]}>
              {d}
            </Text>
          ))}
          {celdas.map((dia, i) => {
            if (!dia) return <View key={`h${i}`} style={styles.celda} />;
            const futuro = dia > hoy;
            const extremo = dia === desde || dia === fin;
            const dentro = !!desde && !!fin && dia > desde && dia < fin;
            return (
              <Pressable
                key={dia}
                onPress={() => tocar(dia)}
                disabled={futuro}
                style={[styles.celda, dentro && styles.celdaDentro]}
                accessibilityRole="button"
                accessibilityLabel={aFecha(dia).toLocaleDateString('es-EC', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                accessibilityState={{ selected: extremo || dentro, disabled: futuro }}
              >
                {({ pressed }) => (
                <View style={[styles.numero, extremo && styles.numeroExtremo, pressed && !extremo && styles.numeroPresionado]}>
                  <Text
                    style={[
                      styles.numeroTexto,
                      dia === hoy && styles.numeroHoy,
                      extremo && styles.numeroTextoExtremo,
                      futuro && styles.numeroFuturo,
                    ]}
                  >
                    {aFecha(dia).getDate()}
                  </Text>
                </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.resumen}>{resumen}</Text>
        {problema && <Text style={styles.problema}>{problema}</Text>}
        <BotonVer
          disabled={!desde || !!problema}
          onVer={() => desde && fin && onElegir(periodoElegido(desde, fin))}
        />
      </View>
    </HojaModal>
  );
}

/** Aplica el rango y cierra la hoja con su animación. */
function BotonVer({ disabled, onVer }: { disabled: boolean; onVer: () => void }) {
  const { cerrar } = useHoja();
  return (
    <Boton
      onPress={() => {
        onVer();
        cerrar();
      }}
      disabled={disabled}
    >
      Ver
    </Boton>
  );
}

const styles = StyleSheet.create({
  // Llega hasta los bordes de la pantalla: se ve que la fila se desliza.
  fila: { marginTop: espaciado.md, marginHorizontal: -espaciado.lg },
  filaContenido: { gap: 6, paddingHorizontal: espaciado.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radios.full,
    borderWidth: 1,
    borderColor: 'rgba(246,243,236,0.22)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActivo: { backgroundColor: colores.papel, borderColor: colores.papel },
  chipPresionado: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(246,243,236,0.6)' },
  chipActivoPresionado: { opacity: 0.85 },
  chipTexto: { color: 'rgba(246,243,236,0.84)', fontSize: 13, fontWeight: '700' },
  chipTextoActivo: { color: colores.tinta },

  navMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: espaciado.xs,
  },
  flecha: { width: 36, height: 36, borderRadius: radios.full, alignItems: 'center', justifyContent: 'center' },
  flechaPresionada: { backgroundColor: 'rgba(28,43,58,0.08)' },
  tituloMes: { fontSize: 15, fontWeight: '700', color: colores.tinta },
  grilla: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  celdaDentro: { backgroundColor: 'rgba(217,140,43,0.16)' },
  diaSemana: { height: 28, fontSize: 12, fontWeight: '700', color: colores.tintaSuave, textAlign: 'center' },
  numero: { width: 36, height: 36, borderRadius: radios.full, alignItems: 'center', justifyContent: 'center' },
  numeroExtremo: { backgroundColor: colores.tinta },
  numeroPresionado: { backgroundColor: 'rgba(28,43,58,0.12)' },
  numeroTexto: { fontSize: 14, color: colores.tinta, fontVariant: ['tabular-nums'] },
  numeroHoy: { fontWeight: '800', textDecorationLine: 'underline' },
  numeroTextoExtremo: { color: colores.papel, fontWeight: '700' },
  numeroFuturo: { color: colores.papelLinea },
  resumen: { fontSize: 14, fontWeight: '600', color: colores.tinta, marginTop: espaciado.xs },
  problema: { fontSize: 13, color: colores.rojoPerdida },
});
