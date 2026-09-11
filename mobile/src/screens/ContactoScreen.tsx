import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Boton, Tarjeta } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';

// TODO(Isra): reemplazar por tus datos reales de contacto. Estos son
// placeholders a propósito — no hay forma de que Claude conozca tu
// correo, WhatsApp o dirección reales, así que no había que inventarlos.
const CORREO_SOPORTE = 'soporte@kontago.example';
const WHATSAPP_NUMERO = '+593000000000';

function FilaContacto({
  icono,
  titulo,
  valor,
  onPress,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  valor: string;
  onPress: () => void;
}) {
  return (
    <Tarjeta style={styles.filaContacto}>
      <View style={styles.iconoFondo}>
        <Ionicons name={icono} size={20} color={colores.tinta} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.filaTitulo}>{titulo}</Text>
        <Text style={styles.filaValor}>{valor}</Text>
      </View>
      <Boton variante="secondary" onPress={onPress} style={{ paddingHorizontal: espaciado.md }}>
        Abrir
      </Boton>
    </Tarjeta>
  );
}

export function ContactoScreen() {
  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avisoContenedor}>
          <Ionicons name="information-circle-outline" size={18} color={colores.ambar} />
          <Text style={styles.avisoTexto}>
            Estos son datos de ejemplo — hay que reemplazarlos por el correo y WhatsApp
            reales antes de publicar la app (buscá "CORREO_SOPORTE" y
            "WHATSAPP_NUMERO" en ContactoScreen.tsx).
          </Text>
        </View>

        <FilaContacto
          icono="mail-outline"
          titulo="Correo de soporte"
          valor={CORREO_SOPORTE}
          onPress={() => Linking.openURL(`mailto:${CORREO_SOPORTE}`)}
        />
        <FilaContacto
          icono="logo-whatsapp"
          titulo="WhatsApp"
          valor={WHATSAPP_NUMERO}
          onPress={() => Linking.openURL(`https://wa.me/${WHATSAPP_NUMERO.replace(/\D/g, '')}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { padding: espaciado.lg, gap: espaciado.md },
  avisoContenedor: {
    flexDirection: 'row',
    gap: espaciado.sm,
    backgroundColor: 'rgba(217,140,43,0.1)',
    borderRadius: radios.lg,
    padding: espaciado.md,
    marginBottom: espaciado.xs,
  },
  avisoTexto: { flex: 1, fontSize: 12, color: colores.tinta, lineHeight: 17 },
  filaContacto: { flexDirection: 'row', alignItems: 'center', gap: espaciado.md },
  iconoFondo: {
    width: 40,
    height: 40,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaTitulo: { fontSize: 13, fontWeight: '700', color: colores.tinta },
  filaValor: { fontSize: 12, color: colores.tintaSuave, marginTop: 2 },
});