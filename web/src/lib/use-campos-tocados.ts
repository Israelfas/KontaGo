import { useCallback, useState } from 'react';

/**
 * De qué campos ya salió el usuario. Un email a medio escribir no es un
 * error: el aviso aparece al salir del campo y desde ahí se actualiza con
 * cada tecla, así se ve cuándo quedó bien. Copia en
 * mobile/src/lib/use-campos-tocados.ts.
 */
export function useCamposTocados<Campo extends string>() {
  const [tocados, setTocados] = useState<ReadonlySet<Campo>>(new Set());
  const [intentoEnviar, setIntentoEnviar] = useState(false);

  const salir = useCallback(
    (campo: Campo) => () =>
      setTocados((previos) => (previos.has(campo) ? previos : new Set(previos).add(campo))),
    [],
  );

  /** Al intentar enviar con algo mal: se muestran todos los avisos. */
  const tocarTodos = useCallback((campos: Campo[]) => {
    setTocados(new Set(campos));
    setIntentoEnviar(true);
  }, []);

  /**
   * El error de un campo: su problema si ya se salió de él, o que falta
   * completarlo si se intentó enviar vacío (pasar por un campo vacío sin
   * escribir no es un error).
   */
  function error(campo: Campo, valor: string, problema: string | null): string | null {
    if (!tocados.has(campo)) return null;
    return problema ?? (intentoEnviar && !valor.trim() ? 'Falta completar este dato.' : null);
  }

  return { tocado: (campo: Campo) => tocados.has(campo), salir, tocarTodos, error };
}
