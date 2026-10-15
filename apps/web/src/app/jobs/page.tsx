'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/AppShell';
import { JobsPanel } from '@/components/JobsPanel';
import { CardSkeleton, ErrorAlert } from '@/components/ui';
import * as api from '@/lib/api';

export default function JobsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<api.JobsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listJobs(page, 20);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  if (loading && !data) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold mb-8">Central de Execuções</h1>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} rows={1} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold mb-8">Central de Execuções</h1>
        <ErrorAlert message={error} onRetry={() => void fetchJobs()} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">Central de Execuções</h1>
          <p className="text-surface-600 dark:text-surface-400 mt-1">
            Acompanhe todas as tarefas assíncronas da sua conta.
          </p>
        </div>
      </div>

      <div className="card">
        <JobsPanel />
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-surface-500" aria-live="polite">
            Página {data.page} de {data.totalPages} — {data.total} execuções
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="btn-ghost text-sm"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(data.totalPages, page + 1))}
              disabled={page >= data.totalPages}
              className="btn-ghost text-sm"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}