import { Rol } from '../../common/enums/rol.enum';

// Datos del dueño: cuánto le cuesta cada producto y a quién se lo compra.
// El cajero vende con el precio de venta; el costo y el proveedor no le
// hacen falta (y con ellos sabría el margen de toda la tienda).
const DATOS_DEL_DUENO = ['costoUnitarioCentavos', 'proveedor'] as const;

/** Un producto (o una línea de venta) tal como lo puede ver ese rol. */
export function paraElRol<T extends object>(rol: Rol, dato: T): T {
  if (rol === Rol.ADMIN) return dato;
  const copia = { ...dato } as Record<string, unknown>;
  for (const campo of DATOS_DEL_DUENO) delete copia[campo];
  return copia as T;
}
