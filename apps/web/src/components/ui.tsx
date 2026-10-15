'use client';

import Link from 'next/link';

export function StatCard({
  label,
  value,
  description,
  icon,
  href,
  loading,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <div className="flex items-start gap-4">
      <div
        className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-2xl"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <dt className="text-sm font-medium text-surface-500 dark:text-surface-400">{label}</dt>
        <dd className="text-3xl font-bold text-surface-900 dark:text-surface-50 mt-1 tabular-nums">
          {loading ? <span className="inline-block h-8 w-16 rounded bg-surface-200 dark:bg-surface-700 animate-pulse" aria-label="Carregando" /> : value}
        </dd>
        <dd className="text-sm text-surface-500 dark:text-surface-400 mt-1">{description}</dd>
      </div>
    </div>
  );

  if (href && !loading) {
    return (
      <Link
        href={href}
        className="card p-6 block transition-colors hover:border-primary-300 dark:hover:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label={`${label}: ${value}. ${description}`}
      >
        {body}
      </Link>
    );
  }
  return <div className="card p-6">{body}</div>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-surface-200 dark:bg-surface-700 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-6" aria-label="Carregando conteúdo">
      <Skeleton className="h-5 w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full mb-2" />
      ))}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'badge-success',
  ready: 'badge-success',
  ok: 'badge-success',
  pass: 'badge-success',
  running: 'badge-warning',
  processing: 'badge-warning',
  pending: 'badge-warning',
  queued: 'badge-info',
  active: 'badge-info',
  cancel_requested: 'badge-warning',
  failed: 'badge-error',
  fail: 'badge-error',
  down: 'badge-error',
  cancelled: 'badge-neutral',
  uploaded: 'badge-info',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'badge-neutral';
  return <span className={`badge ${style}`}>{status}</span>;
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Navegação estrutural">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <span className="text-surface-400 dark:text-surface-500" aria-hidden="true">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-primary-600 dark:text-primary-400 hover:underline truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="text-surface-600 dark:text-surface-400 truncate max-w-[240px]"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="btn-ghost text-sm"
      >
        ← Previous
      </button>
      <span className="text-sm text-surface-500" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="btn-ghost text-sm"
      >
        Next →
      </button>
    </div>
  );
}

export function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      role="alert"
    >
      <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost text-sm mt-2">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
