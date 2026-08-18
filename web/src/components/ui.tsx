import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { StoreIcon } from './icons';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  success: 'button-success',
  danger: 'button-danger',
  ghost: 'button-ghost',
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
      {detail && <p className="metric-detail mt-3">{detail}</p>}
    </article>
  );
}

export function LoadingState({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <span className="loading-mark" />
      <p className="font-ticket text-sm text-tinta-suave">{label}</p>
    </div>
  );
}

export function ErrorState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
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
