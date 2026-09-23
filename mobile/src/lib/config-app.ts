/**
 * Datos que cambian por instalación y no van en el código (ver
 * mobile/.env.example). Expo reemplaza cada process.env.EXPO_PUBLIC_*
 * al armar la app, así que hay que nombrarlas enteras, una por una.
 */

const limpio = (valor: string | undefined) => valor?.trim() || null;

export const SOPORTE = {
  correo: limpio(process.env.EXPO_PUBLIC_SOPORTE_CORREO),
  // Con código de país, ej. +593991234567.
  whatsapp: limpio(process.env.EXPO_PUBLIC_SOPORTE_WHATSAPP),
};

// Sin ningún dato de contacto cargado, la opción "Contacto y soporte" no
// se muestra (antes mostraba datos inventados).
export const HAY_SOPORTE = SOPORTE.correo !== null || SOPORTE.whatsapp !== null;

// Suscripción oculta hasta que se empiece a cobrar: mostrar planes que no
// se pueden contratar confunde.
export const MOSTRAR_SUSCRIPCION = process.env.EXPO_PUBLIC_MOSTRAR_SUSCRIPCION === 'true';
