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
import type { UsuarioEquipo } from '../lib/tipos';
import { Banda, LabioHoja } from '../components/banda';
import { useCamposTocados } from '../lib/use-campos-tocados';
import {
  ayudaDeLaContrasena,
  faltanALaContrasena,
  problemaDeLaContrasena,
  problemaDelEmail,
  problemaDelNombre,
} from '../lib/validacion';

const ETIQUETA_ROL: Record<UsuarioEquipo['rol'], string> = {
  admin: 'Admin',
  cajero: 'Cajero',
};

function FormularioNuevaPersona({
  onCreado,
  onCerrar,
}: {
  onCreado: (u: UsuarioEquipo) => void;
  onCerrar: () => void;
}) {
  const { token } = useAuth();
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
    faltanALaContrasena(password) === 0;
  const { salir, error: errorDe } = useCamposTocados<'nombre' | 'email' | 'password'>();
  const errores = {
    nombre: errorDe('nombre', nombre, problemaDelNombre(nombre)),
    email: errorDe('email', email, problemaDelEmail(email)),
    password: errorDe('password', password, problemaDeLaContrasena(password)),
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
    <Tarjeta style={styles.formulario}>
      <View style={styles.formularioTituloFila}>
        <Ionicons name="person-add-outline" size={18} color={colores.tinta} />
        <Text style={styles.formularioTitulo}>Agregar persona</Text>
      </View>

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
      <Etiqueta>Contraseña inicial (mínimo 6)</Etiqueta>
      <TextInput
        value={password}
        onChangeText={setPassword}
        onBlur={salir('password')}
        style={[estilosCampo.input, errores.password && estilosCampo.inputInvalido]}
        placeholder="Pasásela a la persona"
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
          : 'Acceso completo, igual que vos.'}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
        <Boton onPress={manejarSubmit} cargando={enviando} disabled={!valido} style={{ flex: 1 }}>
          Crear cuenta
        </Boton>
        <Boton variante="ghost" onPress={onCerrar} style={{ flex: 1 }}>
          Cancelar
        </Boton>
      </View>
    </Tarjeta>
  );
}

function FilaPersona({
  persona,
  esVos,
  procesando,
  onAlternarActivo,
  onPasswordCambiada,
}: {
  persona: UsuarioEquipo;
  esVos: boolean;
  procesando: boolean;
  onAlternarActivo: () => void;
  onPasswordCambiada: () => void;
}) {
  const { token } = useAuth();
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarPassword() {
    if (!token || password.length < 6) return;
    setError(null);
    setGuardando(true);
    try {
      await cambiarPasswordUsuario(token, persona.id, password);
      setCambiandoPassword(false);
      setPassword('');
      onPasswordCambiada();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta style={[styles.filaTarjeta, !persona.activo && { opacity: 0.6 }]}>
      <View style={styles.filaCabecera}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filaNombre} numberOfLines={1}>
            {persona.nombre}
            {esVos ? ' (vos)' : ''}
          </Text>
          <Text style={styles.filaEmail} numberOfLines={1}>
            {persona.email}
          </Text>
          {!persona.activo && <Text style={styles.filaDesactivado}>Desactivado</Text>}
        </View>
        <View style={styles.rolPill}>
          <Text style={styles.rolPillTexto}>{ETIQUETA_ROL[persona.rol]}</Text>
        </View>
      </View>

      {cambiandoPassword ? (
        <View style={{ marginTop: espaciado.sm }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={estilosCampo.input}
            placeholder="Nueva contraseña (mínimo 6)"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <AvisoDeCampo ayuda={ayudaDeLaContrasena(password)} />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: espaciado.sm }}>
            <Boton
              onPress={guardarPassword}
              cargando={guardando}
              disabled={password.length < 6}
              style={{ flex: 1 }}
            >
              Guardar
            </Boton>
            <Boton variante="ghost" onPress={() => setCambiandoPassword(false)} style={{ flex: 1 }}>
              Cancelar
            </Boton>
          </View>
        </View>
      ) : (
        <View style={styles.acciones}>
          <Pressable onPress={() => setCambiandoPassword(true)} hitSlop={8}>
            <Text style={styles.accionTexto}>Cambiar contraseña</Text>
          </Pressable>
          {/* Uno no puede desactivarse a sí mismo: la tienda podría quedar
              sin nadie que la administre. */}
          {!esVos && (
            <Pressable onPress={onAlternarActivo} disabled={procesando} hitSlop={8}>
              <Text style={[styles.accionTexto, procesando && { opacity: 0.5 }]}>
                {procesando ? 'Guardando…' : persona.activo ? 'Desactivar' : 'Reactivar'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </Tarjeta>
  );
}

export function EquipoScreen() {
  const { token, usuario } = useAuth();
  const [equipo, setEquipo] = useState<UsuarioEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
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
      setEquipo((prev) => prev.map((u) => (u.id === actualizado.id ? actualizado : u)));
    } catch (err) {
      setErrorAccion(err instanceof ApiError ? err.message : 'No se pudo actualizar la cuenta');
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
            onPasswordCambiada={() => setAviso(`Contraseña de ${item.nombre} actualizada.`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: espaciado.sm }} />}
        contentContainerStyle={styles.listaContenido}
        ListHeaderComponent={
          <View style={{ gap: espaciado.md, marginBottom: espaciado.md }}>
            {formularioAbierto ? (
              <FormularioNuevaPersona
                onCreado={(u) => setEquipo((prev) => [...prev, u])}
                onCerrar={() => setFormularioAbierto(false)}
              />
            ) : (
              <Boton onPress={() => setFormularioAbierto(true)}>+ Agregar persona</Boton>
            )}
            {errorAccion && <Text style={styles.error}>{errorAccion}</Text>}
            {aviso && <Text style={styles.aviso}>{aviso}</Text>}
          </View>
        }
      />

      {cargando && <EstadoCargando texto="Cargando equipo…" />}
      {error && !cargando && <EstadoError mensaje={error} onReintentar={cargar} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  listaContenido: { padding: espaciado.lg, flexGrow: 1 },
  descripcion: { fontSize: 13, color: colores.tintaSuave, lineHeight: 18 },
  formulario: { marginHorizontal: 0 },
  formularioTituloFila: { flexDirection: 'row', alignItems: 'center', gap: espaciado.xs, marginBottom: espaciado.md },
  formularioTitulo: { fontSize: 16, fontWeight: '700', color: colores.tinta },
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
  filaDesactivado: { fontSize: 11, color: colores.rojoPerdida, marginTop: 2, fontWeight: '600' },
  rolPill: {
    backgroundColor: 'rgba(217,140,43,0.14)',
    paddingHorizontal: espaciado.sm,
    paddingVertical: 3,
    borderRadius: radios.full,
  },
  rolPillTexto: { fontSize: 11, fontWeight: '700', color: '#9a5b08', textTransform: 'uppercase' },
  acciones: { flexDirection: 'row', gap: espaciado.lg, marginTop: espaciado.sm },
  accionTexto: { fontSize: 13, color: colores.tintaSuave, fontWeight: '600', textDecorationLine: 'underline' },
});
