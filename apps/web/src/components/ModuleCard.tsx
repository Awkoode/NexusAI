'use client';

import Link from 'next/link';

interface ModuleCardProps {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'planned' | 'in-progress' | 'done';
  href: string;
}

const statusConfig = {
  planned: {
    label: 'Planejado',
    className: 'badge-info',
    description: 'Não implementado ainda',
  },
  'in-progress': {
    label: 'Em desenvolvimento',
    className: 'badge-warning',
    description: 'Em andamento',
  },
  done: {
    label: 'Disponível',
    className: 'badge-success',
    description: 'Pronto para uso',
  },
};

export function ModuleCard({ name, description, icon, status, href }: ModuleCardProps) {
  const config = statusConfig[status];

  return (
    <article className="card p-6 hover:border-primary-300 dark:hover:border-primary-700/50 transition-colors">
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-2xl"
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">{name}</h3>
            <span className={config.className}>{config.label}</span>
          </div>
          <p className="text-surface-600 dark:text-surface-400 text-sm mb-3 leading-relaxed">{description}</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-surface-500 dark:text-surface-400">{config.description}</span>
            <Link
              href={href}
              className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
            >
              Saiba mais →
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}