import { registerDecorator, type ValidationArguments } from 'class-validator';
import { nombreDelCampo } from './mensajes-en-espanol';

const MAXIMO = 999_999_999;

/**
 * Una cantidad: entera, o con hasta 3 decimales si el producto se vende
 * por peso (que sea entera para los que van por unidad lo revisa el
 * servicio, que sabe de qué producto se trata).
 *
 * `positiva`: mayor que cero (lo que se vende o entra); si no, puede ser 0
 * (un stock, un mínimo).
 */
export function EsCantidad({ positiva }: { positiva: boolean }) {
  return (objeto: object, propiedad: string) =>
    registerDecorator({
      name: 'esCantidad',
      target: objeto.constructor,
      propertyName: propiedad,
      validator: {
        validate(valor: unknown) {
          if (typeof valor !== 'number' || !Number.isFinite(valor)) {
            return false;
          }
          if (positiva ? valor <= 0 : valor < 0) return false;
          if (valor > MAXIMO) return false;
          // Hasta milésimas (lo que guarda la base).
          return Math.abs(valor * 1000 - Math.round(valor * 1000)) < 1e-6;
        },
        defaultMessage(args: ValidationArguments) {
          const nombre = nombreDelCampo(args.property);
          return positiva
            ? `${nombre} tiene que ser mayor que 0, con hasta 3 decimales.`
            : `${nombre} no puede ser menor que 0, y va con hasta 3 decimales.`;
        },
      },
    });
}
