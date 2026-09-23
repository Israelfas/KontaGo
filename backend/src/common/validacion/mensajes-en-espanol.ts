import type { ValidationError } from 'class-validator';

/**
 * class-validator responde en inglés ("password must be longer than or
 * equal to 6 characters") y ese texto llegaba tal cual a la pantalla del
 * cajero. Acá se traduce cada regla a un mensaje en español, con el
 * nombre del campo como lo conoce la persona.
 *
 * Los validadores propios (RUC, contraseña, fechas) ya traen su mensaje
 * en español y se respetan.
 */

const NOMBRES: Record<string, string> = {
  email: 'El email',
  password: 'La contraseña',
  nombre: 'El nombre',
  nombreTienda: 'El nombre de la tienda',
  nombreAdmin: 'Tu nombre',
  codigoBarras: 'El código de barras',
  precioVentaCentavos: 'El precio de venta',
  costoUnitarioCentavos: 'El costo',
  stockInicial: 'El stock inicial',
  stockMinimo: 'El stock mínimo',
  cantidad: 'La cantidad',
  motivo: 'El motivo',
  proveedor: 'El proveedor',
  fechaVencimiento: 'La fecha de vencimiento',
  montoCentavos: 'El monto',
  montoRecibidoCentavos: 'El monto recibido',
  fondoInicialCentavos: 'El cambio inicial',
  efectivoContadoCentavos: 'El efectivo contado',
  nota: 'La nota',
  token: 'El enlace',
  desde: 'La fecha desde',
  hasta: 'La fecha hasta',
};

const numero = (mensaje: string) => /(\d+)/.exec(mensaje)?.[1];

// "La contraseña" → "Falta la contraseña." (sin pelear con el género).
const faltaEl = (nombre: string) =>
  `Falta ${nombre.charAt(0).toLowerCase()}${nombre.slice(1)}.`;

function traducir(regla: string, campo: string, original: string): string {
  const nombre = NOMBRES[campo] ?? `El campo "${campo}"`;
  switch (regla) {
    case 'isEmail':
      return 'Revisá el email: no tiene un formato válido.';
    case 'isNotEmpty':
    case 'isDefined':
      return faltaEl(nombre);
    case 'isString':
      return `${nombre} tiene que ser un texto.`;
    case 'minLength':
      return numero(original) === '1'
        ? faltaEl(nombre)
        : `${nombre} debe tener al menos ${numero(original)} caracteres.`;
    case 'maxLength':
      return `${nombre} puede tener hasta ${numero(original)} caracteres.`;
    case 'isInt':
      return `${nombre} tiene que ser un número entero.`;
    case 'isNumber':
      return `${nombre} tiene que ser un número.`;
    case 'min':
      return `${nombre} no puede ser menor que ${numero(original)}.`;
    case 'max':
      return `${nombre} no puede ser mayor que ${numero(original)}.`;
    case 'isUuid':
      return `${nombre} no es un identificador válido.`;
    case 'isEnum':
    case 'isIn':
      return `${nombre} no tiene un valor permitido.`;
    case 'isBoolean':
      return `${nombre} tiene que ser sí o no.`;
    case 'isDateString':
      return `${nombre} no es una fecha válida.`;
    case 'isArray':
      return `${nombre} tiene que ser una lista.`;
    case 'arrayMinSize':
      return `${nombre} tiene que tener al menos ${numero(original)} elemento(s).`;
    case 'whitelistValidation':
      return `No se esperaba el dato "${campo}".`;
    default:
      // Validadores propios: ya vienen en español.
      return original;
  }
}

/** Todos los mensajes de un pedido inválido, en español y sin repetir. */
export function mensajesEnEspanol(
  errores: ValidationError[],
  prefijo = '',
): string[] {
  const mensajes: string[] = [];
  for (const error of errores) {
    for (const [regla, original] of Object.entries(error.constraints ?? {})) {
      mensajes.push(traducir(regla, error.property, original));
    }
    if (error.children?.length) {
      mensajes.push(
        ...mensajesEnEspanol(error.children, `${prefijo}${error.property}.`),
      );
    }
  }
  return [...new Set(mensajes)];
}
