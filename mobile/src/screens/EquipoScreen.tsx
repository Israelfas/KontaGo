import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import {
  listarEquipo,
  crearUsuario,
  desactivarUsuario,
  reactivarUsuario,
  cambiarPasswordUsuario,
  desbloquearUsuario,
  ApiError,
} from '../lib/api';
import {
  AvisoDeCampo,
  Boton,
  EstadoCargando,
  EstadoError,
  Etiqueta,
  Tarjeta,
  estilosCampo,
} from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';
import { HojaModal, HojaPie, useHoja } from '../components/hoja-modal';
import { vibrar } from '../components/movimiento';
import type { UsuarioEquipo } from '../lib/tipos';
import { Banda, LabioHoja } from '../components/banda';
import { useCamposTocados } from '../lib/use-campos-tocados';
import { ActividadDeLaCuenta } from '../components/actividad-cuenta';
import { haceCuanto } from '../lib/actividad';
import {
  LARGO_MINIMO_CONTRASENA,
  ayudaDeLaContrasena,
  problemaDeLaContrasena,
  problemaDelEmail,
  problemaDelNombre,
} from '../lib/validacion';

const ETIQUETA_ROL: Record<UsuarioEquipo['rol'], string> = {
  admin: 'Admin',
  cajero: 'Cajero',
};

function FormularioNuevaPersona({ onCreado }: { onCreado: (u: UsuarioEquipo) => void }) {
  const { token } = useAuth();
  const { cerrar: onCerrar } = useHoja();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UsuarioEquipo['rol']>('cajero');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // El botón queda gris hasta que esté todo; los avisos dicen qué falta.
  const valido =
    !!nombre.trim() &&
    !!email.trim() &&
    !problemaDelNombre(nombre) &&
    !problemaDelEmail(email) &&
    !!password &&
    !problemaDeLaContrasena(password, email);
  const { salir, error: errorDe } = useCamposTocados<'nombre' | 'email' | 'password'>();
  const errores = {
    nombre: errorDe('nombre', nombre, problemaDelNombre(nombre)),
    email: errorDe('email', email, problemaDelEmail(email)),
    password: errorDe('password', password, problemaDeLaContrasena(password, email)),
  };

  async function manejarSubmit() {
    if (!token || !valido) return;
    setError(null);
    setEnviando(true);
    try {
      onCreado(
        await crearUsuario(token, { nombre: nombre.trim(), email: email.trim(), password, rol }),
      );
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View>
      <Etiqueta>Nombre</Etiqueta>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        onBlur={salir('nombre')}
        style={[estilosCampo.input, errores.nombre && estilosCampo.inputInvalido]}
        placeholder="Pedro Gómez"
      />
      <AvisoDeCampo error={errores.nombre} />
      <Etiqueta>Email (con este entra)</Etiqueta>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onBlur={salir('email')}
        style={[estilosCampo.input, errores.email && estilosCampo.inputInvalido]}
        placeholder="pedro@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AvisoDeCampo error={errores.email} />
      <Etiqueta>{`Contraseña inicial (mínimo ${LARGO_MINIMO_CONTRASENA})`}</Etiqueta>
      <TextInput
        value={password}
        onChangeText={setPassword}
        onBlur={salir('password')}
        style={[estilosCampo.input, errores.password && estilosCampo.inputInvalido]}
        placeholder="Pásasela a la persona"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AvisoDeCampo error={errores.password} ayuda={ayudaDeLaContrasena(password)} />

      <Etiqueta>Rol</Etiqueta>
      <View style={styles.selectorRol}>
        {(['cajero', 'admin'] as const).map((opcion) => (
          <Pressable
            key={opcion}
            onPress={() => setRol(opcion)}
            style={[styles.opcionRol, rol === opcion && styles.opcionRolActiva]}
          >
            <Text style={[styles.opcionRolTexto, rol === opcion && styles.opcionRolTextoActivo]}>
              {ETIQUETA_ROL[opcion]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.ayuda}>
        {rol === 'cajero'
          ? 'Vende y consulta productos. No ve ganancias ni inventario.'
          : 'Acceso completo, igual que tú.'}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <HojaPie>
        <Boton onPress={manejarSubmit} cargando={enviando} disabled={!valido} style={{ flex: 1 }}>
          Crear cuenta
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </HojaPie>
    </View>
  );
}

/** Bloqueada por intentos fallidos, y el bloqueo todavía no venció. */
const estaBloqueada = (p: UsuarioEquipo) =>
  !!p.bloqueadoHasta && new Date(p.bloqueadoHasta).getTime() > Date.now();

function FilaPersona({
  persona,
  esVos,
  procesando,
  onAlternarActivo,
  onCambiarPassword,
  onActividad,
  onDesbloquear,
}: {
  persona: UsuarioEquipo;
  esVos: boolean;
  procesando: boolean;
  onAlternarActivo: () => void;
  onCambiarPassword: () => void;
  onActividad: () => void;
  onDesbloquear: () => void;
}) {
  const bloqueada = estaBloqueada(persona);
  return (
    <Tarjeta style={[styles.filaTarjeta, !persona.activo && { opacity: 0.6 }]}>
      <View style={styles.filaCabecera}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filaNombre} numberOfLines={1}>
            {persona.nombre}
            {esVos ? ' (tú)' : ''}
          </Text>
          <Text style={styles.filaEmail} numberOfLines={1}>
            {persona.email}
          </Text>
          <Text style={styles.filaIngreso}>
            Último ingreso: {persona.ultimoIngreso ? haceCuanto(persona.ultimoIngreso) : 'nunca'}
          </Text>
          {!persona.activo && <Text style={styles.filaDesactivado}>Desactivado</Text>}
          {bloqueada && (
            <Text style={styles.filaDesactivado}>Bloqueada por intentos fallidos</Text>
          )}
        </View>
        <View style={styles.rolPill}>
          <Text style={styles.rolPillTexto}>{ETIQUETA_ROL[persona.rol]}</Text>
        </View>
      </View>

      <View style={styles.acciones}>
        {bloqueada && (
          <Pressable
            onPress={onDesbloquear}
            disabled={procesando}
            hitSlop={8}
            style={({ pressed }) => [
              styles.pildoraAccion,
              styles.pildoraDesbloquear,
              (pressed || procesando) && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="lock-open-outline" size={12} color={colores.papel} />
            <Text style={[styles.pildoraAccionTexto, { color: colores.papel }]}>Desbloquear</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onActividad}
          hitSlop={8}
          style={({ pressed }) => [styles.pildoraAccion, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="pulse-outline" size={12} color={colores.tinta} />
          <Text style={styles.pildoraAccionTexto}>Actividad</Text>
        </Pressable>
        <Pressable
          onPress={onCambiarPassword}
          hitSlop={8}
          style={({ pressed }) => [styles.pildoraAccion, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="key-outline" size={12} color={colores.tinta} />
          <Text style={styles.pildoraAccionTexto}>Contraseña</Text>
        </Pressable>
        {/* Uno no puede desactivarse a sí mismo: la tienda podría quedar
            sin nadie que la administre. */}
        {!esVos && (
          <Pressable
            onPress={onAlternarActivo}
            disabled={procesando}
            hitSlop={8}
            style={({ pressed }) => [
              styles.pildoraAccion,
              (pressed || procesando) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.pildoraAccionTexto}>
              {procesando ? 'Guardando…' : persona.activo ? 'Desactivar' : 'Reactivar'}
            </Text>
          </Pressable>
        )}
      </View>
    </Tarjeta>
  );
}

function FormularioCambiarPassword({
  persona,
  onListo,
}: {
  persona: UsuarioEquipo;
  onListo: () => void;
}) {
  const { token } = useAuth();
  const { cerrar } = useHoja();
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarPassword() {
    if (!token || !!problemaDeLaContrasena(password) || !password) return;
    setError(null);
    setGuardando(true);
    try {
      await cambiarPasswordUsuario(token, persona.id, password);
      vibrar.exito();
      onListo();
      cerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View>
      <Etiqueta>Nueva contraseña</Etiqueta>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={estilosCampo.input}
        placeholder={`Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      <AvisoDeCampo ayuda={ayudaDeLaContrasena(password)} />
      {error && <Text style={styles.error}>{error}</Text>}
      <HojaPie>
        <Boton
          onPress={guardarPassword}
          cargando={guardando}
          disabled={!!problemaDeLaContrasena(password) || !password}
          style={{ flex: 1 }}
        >
          Guardar
        </Boton>
        <Boton variante="ghost" onPress={cerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </HojaPie>
    </View>
  );
}

export function EquipoScreen() {
  const { token, usuario } = useAuth();
  const [equipo, setEquipo] = useState<UsuarioEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState<UsuarioEquipo | null>(null);
  const [viendoActividad, setViendoActividad] = useState<UsuarioEquipo | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!token) return;
    setCargando(true);
    setError(null);
    listarEquipo(token)
      .then(setEquipo)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el equipo'))
      .finally(() => setCargando(false));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function alternarActivo(persona: UsuarioEquipo) {
    if (!token) return;
    setErrorAccion(null);
    setAviso(null);
    setProcesandoId(persona.id);
    try {
      const actualizado = persona.activo
        ? await desactivarUsuario(token, persona.id)
        : await reactivarUsuario(token, persona.id);
      reemplazar(actualizado);
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo actualizar la cuenta');
    } finally {
      setProcesandoId(null);
    }
  }

  // La respuesta no trae el último ingreso: se conserva el que ya estaba.
  const reemplazar = (actualizado: UsuarioEquipo) =>
    setEquipo((prev) => prev.map((u) => (u.id === actualizado.id ? { ...u, ...actualizado } : u)));

  async function desbloquear(persona: UsuarioEquipo) {
    if (!token) return;
    setErrorAccion(null);
    setAviso(null);
    setProcesandoId(persona.id);
    try {
      reemplazar(await desbloquearUsuario(token, persona.id));
      vibrar.exito();
      setAviso(`${persona.nombre} ya puede volver a entrar.`);
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo desbloquear la cuenta');
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <Banda
        eyebrow="Tienda"
        titulo="Equipo"
        valor={equipo.length > 0 ? String(equipo.length) : undefined}
        detalle={
          equipo.length > 0
            ? `${equipo.filter((p) => p.activo).length} con acceso · los cajeros venden y consultan productos, no ven ganancias ni inventario`
            : undefined
        }
      />
      <LabioHoja />
      <FlatList
        data={cargando || error ? [] : equipo}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <FilaPersona
            persona={item}
            esVos={item.id === usuario?.sub}
            procesando={procesandoId === item.id}
            onAlternarActivo={() => alternarActivo(item)}
            onCambiarPassword={() => {
              setAviso(null);
              setCambiandoPassword(item);
            }}
            onActividad={() => {
              setAviso(null);
              setViendoActividad(item);
            }}
            onDesbloquear={() => desbloquear(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: espaciado.sm }} />}
        contentContainerStyle={styles.listaContenido}
        ListHeaderComponent={
          <View style={{ gap: espaciado.md, marginBottom: espaciado.md }}>
            <Boton onPress={() => setAgregando(true)}>+ Agregar persona</Boton>
            {errorAccion && <Text style={styles.error}>{errorAccion}</Text>}
            {aviso && <Text style={styles.aviso}>{aviso}</Text>}
          </View>
        }
      />

      {cargando && <EstadoCargando texto="Cargando equipo…" />}
      {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}

      {agregando && (
        <HojaModal
          titulo="Agregar persona"
          descripcion="Entra con su email y la contraseña que le pases."
          icono="person-add-outline"
          onCerrar={() => setAgregando(false)}
        >
          <FormularioNuevaPersona onCreado={(u) => setEquipo((prev) => [...prev, u])} />
        </HojaModal>
      )}
      {viendoActividad && (
        <HojaModal
          titulo={
            viendoActividad.id === usuario?.sub
              ? 'Tu actividad'
              : `Actividad de ${viendoActividad.nombre}`
          }
          descripcion="Dónde tiene la sesión abierta y lo último que pasó con la cuenta."
          icono="pulse-outline"
          onCerrar={() => setViendoActividad(null)}
        >
          <ActividadDeLaCuenta
            persona={viendoActividad}
            esVos={viendoActividad.id === usuario?.sub}
            onSesionesCerradas={() =>
              setAviso(`Se cerraron las sesiones de ${viendoActividad.nombre}.`)
            }
            onCambio={(actualizada) => {
              reemplazar(actualizada);
              setAviso(`${actualizada.nombre} ya puede entrar solo con su contraseña.`);
            }}
          />
        </HojaModal>
      )}
      {cambiandoPassword && (
        <HojaModal
          titulo="Cambiar contraseña"
          descripcion={
            // Cambiarla cierra las sesiones de esa persona, también la propia.
            cambiandoPassword.id === usuario?.sub
              ? 'Es la tuya: al guardarla se cierra tu sesión y entras de nuevo con la nueva.'
              : `De ${cambiandoPassword.nombre}. Pásasela en persona: la vieja deja de servir y se cierran sus sesiones.`
          }
          icono="key-outline"
          onCerrar={() => setCambiandoPassword(null)}
        >
          <FormularioCambiarPassword
            persona={cambiandoPassword}
            onListo={() => setAviso(`Contraseña de ${cambiandoPassword.nombre} actualizada.`)}
          />
        </HojaModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pildoraAccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radios.full,
    backgroundColor: 'rgba(28,43,58,0.06)',
  },
  pildoraAccionTexto: { fontSize: 12, fontWeight: '700', color: colores.tinta },
  contenedor: { flex: 1, backgroundColor: colores.papel },
  listaContenido: { padding: espaciado.lg, flexGrow: 1 },
  descripcion: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18 },
  error: { color: colores.rojoPerdida, fontSize: 13, marginBottom: espaciado.sm },
  aviso: { color: colores.verdeGanancia, fontSize: 13, fontWeight: '600' },
  ayuda: { fontSize: 12, color: colores.tintaSuave, marginBottom: espaciado.md },
  selectorRol: { flexDirection: 'row', gap: espaciado.sm, marginBottom: espaciado.xs },
  opcionRol: {
    flex: 1,
    paddingVertical: espaciado.sm,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.papelLinea,
    alignItems: 'center',
    backgroundColor: colores.blanco,
  },
  opcionRolActiva: { backgroundColor: colores.tinta, borderColor: colores.tinta },
  opcionRolTexto: { fontSize: 13, fontWeight: '600', color: colores.tinta },
  opcionRolTextoActivo: { color: colores.papel },
  filaTarjeta: { paddingVertical: espaciado.md },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', gap: espaciado.sm },
  filaNombre: { fontSize: 14, color: colores.tinta, fontWeight: '600' },
  filaEmail: { fontSize: 12, color: colores.tintaSuave, marginTop: 2 },
  filaIngreso: { fontSize: 11, color: colores.tintaSuave, marginTop: 2 },
  pildoraDesbloquear: { backgroundColor: colores.tinta },
  filaDesactivado: { fontSize: 11, color: colores.rojoPerdida, marginTop: 2, fontWeight: '600' },
  rolPill: {
    backgroundColor: 'rgba(217,140,43,0.14)',
    paddingHorizontal: espaciado.sm,
    paddingVertical: 3,
    borderRadius: radios.full,
  },
  rolPillTexto: { fontSize: 11, fontWeight: '700', color: '#9a5b08', textTransform: 'uppercase' },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espaciado.sm, marginTop: espaciado.sm },
  accionTexto: { fontSize: 13, color: colores.tintaSuave, fontWeight: '600', textDecorationLine: 'underline' },
});
