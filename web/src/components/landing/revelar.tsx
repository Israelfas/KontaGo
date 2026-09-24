'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Lo que envuelve aparece (sube y se aclara) la primera vez que entra en
 * pantalla, y se queda. Con retraso se escalonan varios seguidos. Sin
 * JavaScript o con menos movimiento se ve directamente.
 */
export function Revelar({
  children,
  className = '',
  retraso = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** En ms. */
  retraso?: number;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVisible(true);
        observador.disconnect();
      },
      // Un poco antes del borde inferior: llega apareciendo, no aparece tarde.
      { rootMargin: '0px 0px -12% 0px' },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={`revelar ${className}`}
      data-visible={visible}
      style={{ '--retraso': `${retraso}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
