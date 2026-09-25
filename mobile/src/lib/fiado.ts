import { formatearCentavos } from './formato';

/** "debe $5,00", "al día", "a favor $1,00". */
export function textoDelSaldo(saldoCentavos: number): string {
  if (saldoCentavos > 0) return `debe ${formatearCentavos(saldoCentavos)}`;
  if (saldoCentavos < 0) return `a favor ${formatearCentavos(-saldoCentavos)}`;
  return 'al día';
}

/**
 * wa.me con el número en formato internacional: "099 123 4567" (Ecuador)
 * pasa a 593991234567. null si no parece un celular.
 */
export function enlaceWhatsApp(telefono: string, mensaje: string): string | null {
  const conMas = telefono.trim().startsWith('+');
  let digitos = telefono.replace(/\D/g, '');
  if (!conMas) {
    if (digitos.startsWith('0')) digitos = `593${digitos.slice(1)}`;
    else if (digitos.length === 9) digitos = `593${digitos}`;
  }
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

/** "25 sept · 14:30" (o con el año si no es de este año). */
export function fechaYHora(iso: string): string {
  const fecha = new Date(iso);
  const esteAno = fecha.getFullYear() === new Date().getFullYear();
  const dia = fecha.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
    ...(esteAno ? {} : { year: 'numeric' }),
  });
  const hora = fecha.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return `${dia.replace('.', '')} · ${hora}`;
}
