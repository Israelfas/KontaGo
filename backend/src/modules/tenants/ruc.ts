/**
 * RUC de Ecuador: 13 dígitos.
 * - Los dos primeros, la provincia (01 a 24, o 30 para quienes se
 *   inscribieron en el exterior).
 * - El tercero, el tipo: 0 a 5 persona natural (el RUC es su cédula +
 *   001), 6 entidad pública, 9 sociedad privada.
 * - Los tres últimos, el establecimiento: 001 en adelante (nunca 000).
 *
 * No se valida el dígito verificador: el algoritmo cambia según el tipo y
 * el SRI emitió RUCs que no lo cumplen; rechazar un RUC real por eso sería
 * peor que aceptar uno mal tipeado (la factura electrónica lo va a validar
 * contra el SRI de todas formas).
 */
export function esRucValido(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  const provincia = Number(ruc.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  const tipo = Number(ruc[2]);
  if (!(tipo <= 6 || tipo === 9)) return false;
  return ruc.slice(10) !== '000';
}
