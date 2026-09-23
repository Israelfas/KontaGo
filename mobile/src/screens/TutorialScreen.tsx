import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Tarjeta } from '../components/ui';
import { colores, espaciado, radios } from '../theme/colores';

const PASOS: {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descripcion: string;
}[] = [
  {
    icono: 'cube-outline',
    titulo: '1. Cargá tu catálogo',
    descripcion:
      'Andá a Productos y agregá lo que vendés: código de barras, nombre, precio y costo. Podés escribir el código a mano o escanearlo con la cámara.',
  },
  {
    icono: 'cart-outline',
    titulo: '2. Vendé',
    descripcion:
      'En Vender, escaneá o escribí el código de cada producto. Para cobrar, tocá "Exacto" o el billete con el que te pagan (o escribí el monto) y confirmá: la app calcula el vuelto sola.',
  },
  {
    icono: 'add-circle-outline',
    titulo: '3. Producto nuevo al vuelo',
    descripcion:
      'Si escaneás algo que todavía no está en tu catálogo, la app te ofrece darlo de alta ahí mismo, sin cortar la venta. (Solo el administrador; al cajero le avisa que se lo pida.)',
  },
  {
    icono: 'receipt-outline',
    titulo: '4. Ventas de hoy',
    descripcion:
      'Desde Vender, tocá "Ventas de hoy" para ver cada venta del día. Si hubo un error, el administrador puede anular la venta completa o solo algunos productos: el stock vuelve al inventario y queda registrado el motivo.',
  },
  {
    icono: 'clipboard-outline',
    titulo: '5. Controlá tu inventario',
    descripcion:
      'En Inventario ves primero las alertas de stock bajo y productos por vencer (tocá "Abastecer" para reponer). Abajo registrás entradas de mercadería (abastecimiento) y pérdidas (merma).',
  },
  {
    icono: 'bar-chart-outline',
    titulo: '6. Mirá tu resumen',
    descripcion:
      'En Resumen ves cuánto vendiste hoy, tu ganancia real (el margen de cada venta, no solo el ingreso bruto), el ticket promedio y el IVA incluido para tu declaración.',
  },
  {
    icono: 'people-outline',
    titulo: '7. Tu equipo',
    descripcion:
      'Si sos administrador, en Perfil → Equipo das de alta a tus cajeros. Ellos venden y consultan productos, pero no ven ganancias ni inventario. Si alguien deja de trabajar con vos, lo desactivás y pierde el acceso al instante.',
  },
  {
    icono: 'person-circle-outline',
    titulo: '8. Tu cuenta',
    descripcion:
      'Desde el ícono de perfil (arriba a la derecha) accedés a esta ayuda, los términos, el contacto, y podés cerrar sesión.',
  },
];

export function TutorialScreen() {
  return (
    <SafeAreaView style={styles.contenedor} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Un repaso rápido de cómo usar KontaGo día a día.
        </Text>
        {PASOS.map((paso) => (
          <Tarjeta key={paso.titulo} style={styles.paso}>
            <View style={styles.iconoFondo}>
              <Ionicons name={paso.icono} size={20} color={colores.tinta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pasoTitulo}>{paso.titulo}</Text>
              <Text style={styles.pasoDescripcion}>{paso.descripcion}</Text>
            </View>
          </Tarjeta>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colores.papel },
  scroll: { padding: espaciado.lg, gap: espaciado.md },
  intro: { fontSize: 13, color: colores.tintaSuave, marginBottom: espaciado.xs },
  paso: { flexDirection: 'row', gap: espaciado.md, alignItems: 'flex-start' },
  iconoFondo: {
    width: 40,
    height: 40,
    borderRadius: radios.md,
    backgroundColor: colores.superficieSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasoTitulo: { fontSize: 14, fontWeight: '700', color: colores.tinta, marginBottom: 4 },
  pasoDescripcion: { fontSize: 13, color: colores.tintaSuave, lineHeight: 19 },
});