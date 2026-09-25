import { useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import {
  ApiError,
  activarDosPasos,
  desactivarDosPasos,
  iniciarDosPasos,
  obtenerDosPasos,
  type EstadoDosPasos,
} from '../lib/api';
import { Boton, EstadoCargando, Etiqueta, estilosCampo } from './ui';
import { HojaPie, useHoja } from './hoja-modal';
import { vibrar } from './movimiento';
import { colores, espaciado, radios } from '../theme/colores';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Activar o desactivar la verificación en dos pasos (va en una HojaModal).
 * En el celular no se puede escanear un QR de la misma pantalla: el enlace
 * otpauth:// abre la app autenticadora con la cuenta ya cargada, y la
 * clave queda a mano por si hay que escribirla.
 */
export function ConfiguracionDosPasos({ onCambio }: { onCambio: () => void }) {
  const { token } = useAuth();
  const { cerrar } = useHoja();
  const [estado, setEstado] = useState<EstadoDosPasos | null>(null);
  const [configurando, setConfigurando] = useState<{ secreto: string; enlace: string } | null>(
    null,
  );
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) return;
    obtenerDosPasos(token)
      .then(setEstado)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar.'));
  }, [token]);

  const fallo = (err: unknown, porDefecto: string) => {
    vibrar.error();
    setError(err instanceof ApiError ? err.message : porDefecto);
  };

  async function empezar() {
    if (!token) return;
    setError(null);
    setEnviando(true);
    try {
      setConfigurando(await iniciarDosPasos(token));
    } catch (err) {
      fallo(err, 'No se pudo empezar. Prueba de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  async function abrirApp() {
    if (!configurando) return;
    try {
      await Linking.openURL(configurando.enlace);
    } catch {
      setError(
        'No encontramos una app autenticadora. Instala Google Authenticator o Microsoft Authenticator y vuelve a tocar el botón, o escribe la clave a mano.',
      );
    }
  }

  async function confirmar() {
    if (!token || codigo.length !== 6) return;
    setError(null);
    setEnviando(true);
    try {
      const { codigosRecuperacion } = await activarDosPasos(token, codigo);
      vibrar.exito();
      setCodigos(codigosRecuperacion);
      setConfigurando(null);
      setCodigo('');
      onCambio();
    } catch (err) {
      fallo(err, 'No se pudo activar.');
      setCodigo('');
    } finally {
      setEnviando(false);
    }
  }

  async function desactivar() {
    if (!token || !codigo.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      await desactivarDosPasos(token, codigo);
      vibrar.exito();
      setEstado({ activa: false, desde: null, codigosRestantes: 0 });
      setCodigo('');
      onCambio();
    } catch (err) {
      fallo(err, 'No se pudo desactivar.');
    } finally {
      setEnviando(false);
    }
  }

  function guardarCodigos() {
    if (!codigos) return;
    void Share.share({
      message: `Códigos de recuperación de KontaGo (cada uno sirve una sola vez para entrar sin el celular):\n\n${codigos.join('\n')}`,
    });
  }

  const campo = (soloDigitos: boolean) => (
    <TextInput
      value={codigo}
      onChangeText={(v) =>
        setCodigo(soloDigitos ? v.replace(/\D/g, '').slice(0, 6) : v.slice(0, 12))
      }
      style={[estilosCampo.input, styles.campoCodigo]}
      keyboardType={soloDigitos ? 'number-pad' : 'default'}
      textContentType="oneTimeCode"
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={soloDigitos ? '000000' : '000000 o xxxx-xxxx'}
      placeholderTextColor={colores.tintaSuave}
    />
  );
  const mensajeError = error && <Text style={styles.error}>{error}</Text>;

  // 3. Recién activada: los códigos de recuperación, una sola vez.
  if (codigos) {
    return (
      <View>
        <Text style={styles.exito}>
          Listo: desde ahora, al entrar se te pide también el código de la app.
        </Text>
        <Text style={styles.texto}>
          <Text style={styles.fuerte}>Guarda estos códigos</Text> en un lugar seguro. Si pierdes
          el celular, cada uno te deja entrar una vez.{' '}
          <Text style={styles.fuerte}>No se vuelven a mostrar.</Text>
        </Text>
        <View style={styles.codigos}>
          {codigos.map((c) => (
            <Text key={c} style={styles.codigo} selectable>
              {c}
            </Text>
          ))}
        </View>
        <HojaPie>
          <Boton variante="secondary" onPress={guardarCodigos} style={{ flex: 1 }}>
            Guardar o enviar
          </Boton>
          <Boton onPress={cerrar} style={{ flex: 1 }}>
            Ya los guardé
          </Boton>
        </HojaPie>
      </View>
    );
  }

  // 2. Cargar en la app y confirmar.
  if (configurando) {
    return (
      <View>
        <Text style={styles.texto}>
          1. Instala Google Authenticator o Microsoft Authenticator (son gratis).{'\n'}2. Toca
          el botón de abajo: la app se abre con KontaGo ya cargado.{'\n'}3. Vuelve y escribe el
          código de 6 dígitos que aparece.
        </Text>
        <Boton variante="secondary" onPress={abrirApp}>
          Abrir en la app autenticadora
        </Boton>
        <Text style={[styles.texto, { marginTop: espaciado.md }]}>
          ¿No se abre? Agrega una cuenta con esta clave:
        </Text>
        <Text style={styles.clave} selectable>
          {configurando.secreto}
        </Text>
        <Etiqueta>Código de la app</Etiqueta>
        {campo(true)}
        {mensajeError}
        <HojaPie>
          <Boton
            onPress={confirmar}
            cargando={enviando}
            disabled={codigo.length !== 6}
            style={{ flex: 1 }}
          >
            Activar
          </Boton>
          <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
            Cancelar
          </Boton>
        </HojaPie>
      </View>
    );
  }

  if (!estado) {
    return mensajeError || <EstadoCargando texto="Cargando…" />;
  }

  // Activada: se puede desactivar con un código.
  if (estado.activa) {
    return (
      <View>
        <Text style={styles.exito}>
          Activada{estado.desde ? ` desde el ${fecha(estado.desde)}` : ''}. Te quedan{' '}
          {estado.codigosRestantes} código{estado.codigosRestantes === 1 ? '' : 's'} de
          recuperación sin usar.
        </Text>
        <Text style={styles.texto}>
          Para desactivarla, escribe un código de la app (o uno de recuperación). Sin ella, a tu
          cuenta se entra solo con la contraseña.
        </Text>
        <Etiqueta>Código</Etiqueta>
        {campo(false)}
        {mensajeError}
        <HojaPie>
          <Boton
            variante="danger"
            onPress={desactivar}
            cargando={enviando}
            disabled={!codigo.trim()}
            style={{ flex: 1 }}
          >
            Desactivar
          </Boton>
          <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
            Cerrar
          </Boton>
        </HojaPie>
      </View>
    );
  }

  // 1. Todavía no la usa.
  return (
    <View>
      <Text style={styles.texto}>
        Además de la contraseña, al entrar se te pide un código de 6 dígitos que cambia cada 30
        segundos en una app de tu celular. Así, aunque alguien sepa tu contraseña, no puede entrar
        sin tu celular.
      </Text>
      <Text style={[styles.texto, { color: colores.tintaSuave }]}>
        Recomendada para el administrador: es quien ve las ganancias y maneja el equipo.
      </Text>
      {mensajeError}
      <HojaPie>
        <Boton onPress={empezar} cargando={enviando} style={{ flex: 1 }}>
          Activar
        </Boton>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Ahora no
        </Boton>
      </HojaPie>
    </View>
  );
}

const styles = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 21, color: colores.tinta, marginBottom: espaciado.md },
  fuerte: { fontWeight: '700' },
  exito: {
    fontSize: 14,
    lineHeight: 20,
    color: colores.verdeGanancia,
    backgroundColor: 'rgba(47,111,79,0.08)',
    borderRadius: radios.md,
    padding: espaciado.sm + 2,
    marginBottom: espaciado.md,
  },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  campoCodigo: { textAlign: 'center', fontSize: 20, letterSpacing: 6, fontWeight: '700' },
  clave: {
    fontFamily: 'monospace',
    fontSize: 15,
    letterSpacing: 1.5,
    color: colores.tinta,
    backgroundColor: colores.superficieSuave,
    borderRadius: radios.md,
    padding: espaciado.sm + 2,
    marginBottom: espaciado.md,
  },
  codigos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: colores.papelLinea,
    borderRadius: radios.md,
    padding: espaciado.sm,
    marginBottom: espaciado.sm,
  },
  codigo: {
    width: '50%',
    textAlign: 'center',
    paddingVertical: 6,
    fontFamily: 'monospace',
    fontSize: 16,
    letterSpacing: 1,
    color: colores.tinta,
  },
});
