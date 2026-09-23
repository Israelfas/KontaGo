import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { StoreIcon } from './icons';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'claro';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  success: 'button-success',
  danger: 'button-danger',
  ghost: 'button-ghost',
  // Sobre la franja oscura del encabezado.
  claro: 'button-claro',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={`button ${BUTTON_STYLES[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ambar text-tinta shadow-[0_6px_16px_rgba(217,140,43,0.25)]">
        <StoreIcon className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="font-display text-xl font-bold tracking-[-0.05em] text-tinta">
          Konta<span className="text-ambar">Go</span>
        </span>
      )}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="metric-label">{label}</p>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <p className="metric-value">{value}</p>
      {detail && <p className="metric-detail mt-auto pt-2">{detail}</p>}
    </article>
  );
}

/**
 * Mientras carga, la forma de lo que viene (un esqueleto con brillo) en
 * vez de un círculo girando: el contenido llega a un lugar que ya existía.
 */
export function LoadingState({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <div className="app-card p-5" role="status">
      <span className="sr-only">{label}</span>
      <div className="esqueleto h-2.5 w-1/4" />
      <div className="esqueleto mt-4 h-7 w-2/5" />
      <div className="mt-5 space-y-2.5">
        <div className="esqueleto h-2.5 w-full" />
        <div className="esqueleto h-2.5 w-11/12" />
        <div className="esqueleto h-2.5 w-3/4" />
      </div>
    </div>
  );
}

export function ErrorState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="error-state" role="alert">
      <div>
        <p className="font-medium text-rojo-perdida">No pudimos cargar esta sección</p>
        <p className="mt-1 text-sm text-rojo-perdida/80">{children}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state-icon">{icon}</span>}
      <h2 className="font-display text-lg font-bold tracking-tight text-tinta">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-tinta-suave">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Lo que se dice bajo un campo mientras se escribe: `error` en rojo (así no
 * se puede enviar), `advertencia` en ámbar (se puede, pero ojo) o `ayuda`
 * neutra. Se anuncia sin interrumpir (aria-live polite), porque cambia con
 * cada tecla.
 */
export function AvisoDeCampo({
  id,
  error,
  advertencia,
  ayuda,
}: {
  id: string;
  error?: string | null;
  advertencia?: string | null;
  ayuda?: string | null;
}) {
  const texto = error || advertencia || ayuda;
  const tono = error ? 'text-rojo-perdida' : advertencia ? 'aviso-advertencia' : 'text-tinta-suave';
  return (
    <p id={id} className={`mt-1 min-h-4 text-xs ${tono}`} aria-live="polite">
      {texto}
    </p>
  );
}
