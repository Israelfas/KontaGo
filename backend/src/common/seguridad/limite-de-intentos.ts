/**
 * Límite de pedidos por IP para las rutas de acceso.
 *
 * Las pruebas de punta a punta de la web entran y salen muchas veces desde
 * la misma IP; con LIMITE_INTENTOS_AUTH se puede subir el límite en la PC
 * de desarrollo y en CI. Solo sube (nunca baja) y se ignora en producción y
 * en las pruebas del backend, que verifican justamente el 429.
 *
 * Devuelve una función porque los decoradores se evalúan al importar el
 * archivo, antes de que se cargue el .env; el throttler la llama en cada
 * pedido.
 */
export function limiteDeIntentos(base: number): () => number {
  return () => {
    const entorno = process.env.NODE_ENV;
    if (entorno === 'production' || entorno === 'test') return base;
    const elegido = Number(process.env.LIMITE_INTENTOS_AUTH);
    return Number.isInteger(elegido) && elegido > base ? elegido : base;
  };
}
