/**
 * RUC de Ecuador: la misma validación que el backend
 * (backend/src/modules/tenants/ruc.ts), para avisar mientras se escribe y
 * no recién al guardar. Copia en web/src/lib/ruc.ts.
 *
 * Devuelve qué está mal, o null si está bien (o vacío: es opcional).
 */
export function problemaDelRuc(ruc: string): string | null {
  const limpio = ruc.replace(/[\s-]/g, '');
  if (!limpio) return null;
  if (!/^\d+$/.test(limpio)) return 'Solo números.';
  if (limpio.length !== 13) return `Tiene ${limpio.length} números: el RUC lleva 13.`;
  const provincia = Number(limpio.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30))
    return 'Los dos primeros números no son de una provincia.';
  const tipo = Number(limpio[2]);
  if (!(tipo <= 6 || tipo === 9)) return 'El tercer número no corresponde a un RUC.';
  if (limpio.endsWith('000')) return 'Termina en 000: el establecimiento es 001 o más.';
  return null;
}
