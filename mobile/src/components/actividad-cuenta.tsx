import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { ApiError, cerrarSesionesDe, obtenerActividad } from '../lib/api';
import { EVENTOS, haceCuanto, type ActividadDeCuenta } from '../lib/actividad';
import type { UsuarioEquipo } from '../lib/tipos';
import { Boton, EstadoCargando, Etiqueta } from './ui';
import { HojaPie, useHoja } from './hoja-modal';
import { vibrar } from './movimiento';
import { colores, espaciado, radios } from '../theme/colores';

/**
 * Dónde tiene la sesión abierta una persona del equipo y qué pasó con su
 * cuenta (ISO/IEC 27002:2022, 8.15 y 8.16). Desde acá se cierran todas
 * sus sesiones: si perdió el celular, o si hay un dispositivo que nadie
 * reconoce. Igual que web/src/components/actividad-cuenta.tsx.
 */
export function ActividadDeLaCuenta({
  persona,
  esVos,
  onSesionesCerradas,
}: {
  persona: UsuarioEquipo;
  esVos: boolean;
  onSesionesCerradas: () => void;
}) {
  const { token, cerrarSesion } = useAuth();
  const { cerrar } = useHoja();
  const [actividad, setActividad] = useState<ActividadDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  // Intentos sospechosos de la última semana, contados al llegar los datos.
  const [alertasRecientes, setAlertasRecientes] = useState(0);

  useEffect(() => {
    if (!token) return;
    obtenerActividad(token, persona.id)
      .then((a) => {
        const haceUnaSemana = Date.now() - 7 * 86_400_000;
        setAlertasRecientes(
          a.eventos.filter(
            (e) => EVENTOS[e.tipo]?.alerta && new Date(e.fecha).getTime() > haceUnaSemana,
          ).length,
        );
        setActividad(a);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la actividad'),
      );
  }, [token, persona.id]);

  async function cerrarTodas() {
    if (!token) return;
    setCerrando(true);
    try {
      await cerrarSesionesDe(token, persona.id);
      vibrar.exito();
      if (esVos) {
        // También se cerró esta: a volver a entrar.
        await cerrarSesion();
        return;
      }
      onSesionesCerradas();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cerrar las sesiones');
      setCerrando(false);
    }
  }

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!actividad) return <EstadoCargando texto="Cargando actividad…" />;

  return (
    <View>
      {alertasRecientes > 0 && (
        <Text style={styles.alerta}>
          {alertasRecientes === 1
            ? 'Hubo un intento fallido'
            : `Hubo ${alertasRecientes} intentos fallidos`}{' '}
          en la última semana. Si no {esVos ? 'fuiste tú' : `fue ${persona.nombre}`}, conviene cambiar la
          contraseña.
        </Text>
      )}

      <Etiqueta>Sesiones abiertas</Etiqueta>
      {actividad.sesiones.length === 0 ? (
        <Text style={styles.vacio}>No tiene la sesión abierta en ningún lado.</Text>
      ) : (
        <View style={styles.lista}>
          {actividad.sesiones.map((s, i) => (
            <View key={s.id} style={[styles.sesion, i > 0 && styles.separada]}>
              <View style={styles.sesionCabecera}>
                <Text style={styles.dispositivo} numberOfLines={1}>
                  {s.dispositivo}
                </Text>
                {s.esEsta && (
                  <View style={styles.pillEste}>
                    <Text style={styles.pillEsteTexto}>Este dispositivo</Text>
                  </View>
                )}
              </View>
              <Text style={styles.detalle}>
                {s.ip ? `IP ${s.ip} · ` : ''}desde {haceCuanto(s.abiertaEn)} · usó{' '}
                {haceCuanto(s.ultimoUso)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Etiqueta>Lo último que pasó</Etiqueta>
      {actividad.eventos.length === 0 ? (
        <Text style={styles.vacio}>Todavía no hay actividad registrada.</Text>
      ) : (
        <View style={{ gap: espaciado.sm }}>
          {actividad.eventos.map((e, i) => {
            const info = EVENTOS[e.tipo] ?? { texto: e.tipo };
            return (
              <View key={i} style={styles.evento}>
                <View
                  style={[
                    styles.punto,
                    { backgroundColor: info.alerta ? colores.rojoPerdida : colores.papelLinea },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventoTexto, info.alerta && styles.eventoAlerta]}>
                    {info.texto}
                  </Text>
                  <Text style={styles.detalle}>
                    {haceCuanto(e.fecha)}
                    {e.dispositivo ? ` · ${e.dispositivo}` : ''}
                    {e.ip ? ` · IP ${e.ip}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {confirmando && (
        <Text style={styles.confirmacion}>
          {esVos
            ? 'Se cierra tu sesión en todos lados, también en este celular: vas a tener que volver a entrar.'
            : `${persona.nombre} va a tener que volver a entrar en todos sus dispositivos.`}
        </Text>
      )}
      <HojaPie>
        {confirmando ? (
          <>
            <Boton
              variante="danger"
              onPress={cerrarTodas}
              cargando={cerrando}
              style={{ flex: 1 }}
            >
              Sí, cerrar todas
            </Boton>
            <Boton
              variante="ghost"
              onPress={() => setConfirmando(false)}
              disabled={cerrando}
              style={{ flex: 1 }}
            >
              No
            </Boton>
          </>
        ) : (
          <>
            <Boton
              variante="secondary"
              onPress={() => {
                vibrar.toque();
                setConfirmando(true);
              }}
              disabled={actividad.sesiones.length === 0}
              style={{ flex: 1 }}
            >
              {`Cerrar en todos ${esVos ? 'tus' : 'sus'} dispositivos`}
            </Boton>
            <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
              Listo
            </Boton>
          </>
        )}
      </HojaPie>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: colores.rojoPerdida, fontSize: 13, paddingBottom: espaciado.lg },
  alerta: {
    color: colores.rojoPerdida,
    fontSize: 13,
    lineHeight: 18,
    padding: espaciado.sm + 2,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: 'rgba(182,70,47,0.25)',
    backgroundColor: 'rgba(182,70,47,0.06)',
    marginBottom: espaciado.sm,
  },
  vacio: { fontSize: 13, color: colores.tintaSuave, marginBottom: espaciado.sm },
  lista: {
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    marginBottom: espaciado.sm,
  },
  sesion: { paddingHorizontal: espaciado.sm + 4, paddingVertical: espaciado.sm + 2 },
  separada: { borderTopWidth: 1, borderTopColor: colores.papelLinea },
  sesionCabecera: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs },
  dispositivo: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colores.tinta },
  pillEste: {
    backgroundColor: 'rgba(47,111,79,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radios.full,
  },
  pillEsteTexto: { fontSize: 10, fontWeight: '700', color: colores.verdeGanancia },
  detalle: { fontSize: 12, color: colores.tintaSuave, marginTop: 2 },
  evento: { flexDirection: 'row', alignItems: 'flex-start', gap: espaciado.sm },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  eventoTexto: { fontSize: 14, color: colores.tinta },
  eventoAlerta: { color: colores.rojoPerdida, fontWeight: '600' },
  confirmacion: {
    fontSize: 13,
    lineHeight: 18,
    color: colores.tinta,
    padding: espaciado.sm + 2,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: 'rgba(182,70,47,0.3)',
    backgroundColor: 'rgba(182,70,47,0.05)',
    marginTop: espaciado.md,
  },
});
