import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { estilosCampo } from './ui';
import { colores, espaciado, radios } from '../theme/colores';

/**
 * Campo de contraseña con un botón para verla: en el celular se tipea a
 * ciegas y la mayoría de los "contraseña incorrecta" son un error de
 * tipeo.
 */
export function CampoContrasena({
  value,
  onChangeText,
  onBlur,
  placeholder,
  nueva = false,
  invalido = false,
  onSubmitEditing,
  autoFocus,
}: {
  value: string;
  onChangeText: (valor: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Contraseña nueva (el teléfono puede sugerir una y guardarla). */
  nueva?: boolean;
  invalido?: boolean;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={nueva ? 'new-password' : 'password'}
        textContentType={nueva ? 'newPassword' : 'password'}
        autoFocus={autoFocus}
        style={[estilosCampo.input, styles.input, invalido && estilosCampo.inputInvalido]}
        placeholder={placeholder}
        placeholderTextColor={colores.tintaSuave}
        returnKeyType={onSubmitEditing ? 'go' : 'next'}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        style={({ pressed }) => [styles.ojo, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colores.tintaSuave} />
      </Pressable>
    </View>
  );
}

/** Barrita de fuerza de una contraseña nueva. */
export function MedidorDeFuerza({ nivel, texto }: { nivel: 0 | 1 | 2 | 3; texto: string }) {
  if (nivel === 0) return null;
  const color = nivel === 1 ? colores.rojoPerdida : nivel === 2 ? colores.ambar : colores.verdeGanancia;
  return (
    <View style={styles.medidor} accessible accessibilityLabel={`Seguridad de la contraseña: ${texto}`}>
      <View style={styles.barras}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.barra, { backgroundColor: n <= nivel ? color : colores.papelLinea }]} />
        ))}
      </View>
      <Text style={styles.medidorTexto}>Seguridad: {texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { paddingRight: 48 },
  ojo: {
    position: 'absolute',
    right: 0,
    top: 0,
    // El campo deja espaciado.md de margen abajo: el botón ocupa solo el campo.
    bottom: espaciado.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medidor: { marginTop: -espaciado.sm, marginBottom: espaciado.sm },
  barras: { flexDirection: 'row', gap: 4 },
  barra: { flex: 1, height: 4, borderRadius: radios.full },
  medidorTexto: { marginTop: 4, fontSize: 12, color: colores.tintaSuave },
});
