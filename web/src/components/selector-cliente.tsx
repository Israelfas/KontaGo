'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiError, crearCliente, listarClientes } from '@/lib/api';
import { textoDelSaldo } from '@/lib/fiado';
import { normalizar } from '@/lib/filtro-productos';
import type { ClienteFiado } from '@/lib/tipos';

/**
 * A quién se le fía: se busca por nombre y, si no está, se anota ahí
 * mismo (con el nombre alcanza; el teléfono se agrega después en Fiados).
 */
export function SelectorCliente({
  elegido,
  onElegir,
}: {
  elegido: ClienteFiado | null;
  onElegir: (cliente: ClienteFiado | null) => void;
}) {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<ClienteFiado[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    listarClientes(token)
      .then((lista) => vigente && setClientes(lista))
      .catch(
        () =>
          vigente &&
          setError(
            'No se pudo cargar la lista de clientes. Revisa la conexión y vuelve a elegir Fiado.',
          ),
      );
    return () => {
      vigente = false;
    };
  }, [token]);

  if (elegido) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-papel px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-tinta">{elegido.nombre}</p>
          <p className="text-xs text-tinta-suave">{textoDelSaldo(elegido.saldoCentavos)}</p>
        </div>
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="shrink-0 text-xs font-semibold text-tinta underline"
        >
          Cambiar
        </button>
      </div>
    );
  }

  const q = normalizar(busqueda);
  const encontrados = (clientes ?? [])
    .filter((c) => !q || normalizar(c.nombre).includes(q))
    .slice(0, 6);
  const existeExacto = (clientes ?? []).some((c) => normalizar(c.nombre) === q);

  async function anotarNuevo() {
    if (!token || busqueda.trim().length < 2) return;
    setError(null);
    setCreando(true);
    try {
      const nuevo = await crearCliente(token, { nombre: busqueda.trim() });
      onElegir({ ...nuevo, saldoCentavos: 0, ultimoMovimiento: null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo anotar el cliente');
    } finally {
      setCreando(false);
    }
  }

  return (
    <div>
      <label className="field-label" htmlFor="cliente-fiado">
        ¿A quién se le fía?
      </label>
      <input
        id="cliente-fiado"
        autoComplete="off"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="field !mb-0"
        placeholder="Nombre del cliente"
      />
      {clientes === null && !error && (
        <p className="mt-2 text-xs text-tinta-suave">Cargando clientes…</p>
      )}
      {encontrados.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-papel-linea bg-white">
          {encontrados.map((c) => (
            <li key={c.id} className="border-t border-papel-linea first:border-t-0">
              <button
                type="button"
                onClick={() => onElegir(c)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-papel"
              >
                <span className="truncate text-tinta">{c.nombre}</span>
                <span className="shrink-0 font-ticket text-xs text-tinta-suave">
                  {textoDelSaldo(c.saldoCentavos)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {busqueda.trim().length >= 2 && !existeExacto && clientes !== null && (
        <button
          type="button"
          onClick={anotarNuevo}
          disabled={creando}
          className="mt-2 w-full rounded-xl border border-dashed border-papel-linea px-3.5 py-2.5 text-left text-sm text-tinta transition-colors hover:border-tinta disabled:opacity-50"
        >
          {creando ? 'Anotando…' : `+ Anotar a “${busqueda.trim()}” como cliente nuevo`}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-rojo-perdida">
          {error}
        </p>
      )}
    </div>
  );
}
