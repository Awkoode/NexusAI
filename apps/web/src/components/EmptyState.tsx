'use client';

import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: string;
  variant?: 'default' | 'centered';
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon = '📭',
  variant = 'centered',
}: EmptyStateProps) {
  if (variant === 'centered') {
    return (
      <div className="card p-12 sm:p-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-100 dark:bg-surface-800 text-4xl mb-6" aria-hidden="true">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-3">{title}</h3>
        <p className="text-surface-600 dark:text-surface-400 mb-6 max-w-md mx-auto">{description}</p>
        {actionLabel && (actionHref || onAction) && (
          <button
            onClick={onAction}
            className={actionHref ? 'btn-primary inline-flex' : 'btn-primary inline-flex'}
            style={{ display: 'inline-flex' }}
          >
            {actionLabel}
          </button>
        )}
        {actionHref && !onAction && actionLabel && (
          <Link href={actionHref} className="btn-primary inline-flex">
            {actionLabel}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="card p-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-2xl" aria-hidden="true">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">{title}</h3>
          <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">{description}</p>
          {actionLabel && (actionHref || onAction) && (
            <button
              onClick={onAction}
              className="btn-secondary text-sm"
            >
              {actionLabel}
            </button>
          )}
          {actionHref && !onAction && actionLabel && (
            <Link href={actionHref} className="btn-secondary text-sm">
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}