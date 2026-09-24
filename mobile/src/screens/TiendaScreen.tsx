import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { actualizarTienda, obtenerTienda, ApiError } from '../lib/api';
import { problemaDelRuc } from '../lib/ruc';
import { Boton, EstadoCargando, EstadoError, Etiqueta, Tarjeta, estilosCampo } from '../components/ui';
import { colores, espaciado } from '../theme/colores';
import type { Tienda } from '../lib/tipos';

const CAMPOS = [
  { clave: 'nombre', etiqueta: 'Nombre de la tienda', ayuda: 'El del letrero. Sale arriba en el ticket.', max: 150, teclado: 'default' },
  { clave: 'razonSocial', etiqueta: 'Razón social (opcional)', ayuda: 'Como figura en el SRI, si es distinta del nombre.', max: 200, teclado: 'default' },
  { clave: 'ruc', etiqueta: 'RUC (opcional)', ayuda: '13 números: tu cédula seguida de 001, si eres persona natural.', max: 15, teclado: 'number-pad' },
  { clave: 'direccion', etiqueta: 'Dirección (opcional)', ayuda: null, max: 250, teclado: 'default' },
  { clave: 'telefono', etiqueta: 'Teléfono (opcional)', ayuda: null, max: 30, teclado: 'phone-pad' },
  { clave: 'mensajeTicket', etiqueta: 'Mensaje al pie del ticket (opcional)', ayuda: 'Horario, redes sociales, promociones…', max: 200, teclado: 'default' },
] as const;

type Clave = (typeof CAMPOS)[number]['clave'];
type Formulario = Record<Clave, string>;

function aFormulario(tienda: Tienda): Formulario {
  return {
    nombre: tienda.nombre,
    razonSocial: tienda.razonSocial ?? '',
    ruc: tienda.ruc ?? '',
    direccion: tienda.direccion ?? '',
    telefono: tienda.telefono ?? '',
    mensajeTicket: tienda.mensajeTicket ?? '',
  };
}

/** Datos de la tienda que salen en el ticket. Solo el admin llega acá. */
export function TiendaScreen() {
  const { token } = useAuth();
  const [guardada, setGuardada] = useState<Tienda | null>(null);
  const [datos, setDatos] = useState<Formulario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    setError(null);
    obtenerTienda(token)
      .then((t) => {
        setGuardada(t);
        setDatos(aFormulario(t));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los datos'));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const problemaRuc = datos ? problemaDelRuc(datos.ruc) : null;
  const cambios = !!guardada && !!datos && JSON.stringify(aFormulario(guardada)) !== JSON.stringify(datos);

  async function guardar() {
    if (!token || !datos || problemaRuc) return;
    setGuardando(true);
    setErrorGuardar(null);
    setListo(false);
    try {
      const t = await actualizarTienda(token, datos);
      setGuardada(t);
      setDatos(aFormulario(t));
      setListo(true);
    } catch (err) {
      setErrorGuardar(err instanceof ApiError ? err.message : 'No se pudieron guardar los datos');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Lo que sale en el ticket que imprimes o compartes: nombre, RUC, dirección y un mensaje al pie.
          </Text>
          {error && <EstadoError mensaje={error} onReintentar={cargar} />}
          {!datos && !error && <EstadoCargando texto="Cargando…" />}
          {datos && (
            <Tarjeta>
              {CAMPOS.map((campo) => {
                const esRuc = campo.clave === 'ruc';
                return (
                  <View key={campo.clave}>
                    <Etiqueta>{campo.etiqueta}</Etiqueta>
                    <TextInput
                      value={datos[campo.clave]}
                      onChangeText={(t) => {
                        setListo(false);
                        setDatos({ ...datos, [campo.clave]: t });
                      }}
                      maxLength={campo.max}
                      keyboardType={campo.teclado}
                      style={[estilosCampo.input, { marginBottom: 4 }, esRuc && problemaRuc ? styles.inputError : null]}
                      accessibilityLabel={campo.etiqueta}
                    />
                    {esRuc && problemaRuc ? (
                      <Text style={styles.error}>{problemaRuc}</Text>
                    ) : (
                      campo.ayuda && <Text style={styles.ayuda}>{campo.ayuda}</Text>
                    )}
                    <View style={{ height: espaciado.sm }} />
                  </View>
                );
              })}
              {errorGuardar && <Text style={styles.error}>{errorGuardar}</Text>}
              {listo && <Text style={styles.listo}>Guardado. Los próximos tickets salen así.</Text>}
              <Boton
                onPress={guardar}
                cargando={guardando}
                disabled={!cambios || !!problemaRuc || datos.nombre.trim().length < 2}
              >
                Guardar
              </Boton>
            </Tarjeta>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { padding: espaciado.lg, gap: espaciado.md },
  intro: { fontSize: 14, color: colores.tintaSuave, lineHeight: 20 },
  ayuda: { fontSize: 12, color: colores.tintaSuave, lineHeight: 16 },
  error: { fontSize: 13, color: colores.rojoPerdida, marginBottom: espaciado.sm },
  listo: { fontSize: 13, color: colores.verdeGanancia, marginBottom: espaciado.sm },
  inputError: { borderColor: colores.rojoPerdida },
});
