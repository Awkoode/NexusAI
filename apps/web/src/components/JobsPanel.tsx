'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

function statusBadge(status: api.JobStatus): string {
  switch (status) {
    case 'completed':
      return 'badge-success';
    case 'failed':
      return 'badge-error';
    case 'cancelled':
      return 'badge-neutral';
    case 'cancel_requested':
      return 'badge-warning';
    default:
      return 'badge-info';
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Recent job history for a project (or all user jobs when projectId is omitted),
 * with pagination and cancel actions for non-terminal jobs.
 */
export function JobsPanel({ projectId }: { projectId?: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<api.JobsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const result = await api.listJobs(page, 10, projectId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [page, projectId]);

  useEffect(() => {
    setLoading(true);
    void fetchJobs();
  }, [fetchJobs]);

  async function handleCancel(jobId: string) {
    setCancelling(jobId);
    try {
      await api.cancelJob(jobId);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    } finally {
      setCancelling(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <section aria-labelledby="jobs-heading">
      <h2 id="jobs-heading" className="text-xl font-bold text-surface-900 dark:text-surface-50 mb-4">
        Background jobs{data ? ` (${data.total})` : ''}
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {!data || data.jobs.length === 0 ? (
        <p className="text-sm text-surface-500 dark:text-surface-400">
          No background jobs yet. Run an analysis in background mode to see it here.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {data.jobs.map((job) => (
              <li key={job.id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${statusBadge(job.status)}`}>{job.status}</span>
                      <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                        {job.jobType}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      {job.stage ?? '—'} · {job.progress}% · attempts {job.attempts}/{job.maxAttempts} ·{' '}
                      {formatDate(job.createdAt)}
                    </p>
                    {job.errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{job.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-24 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={job.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Job progress: ${job.progress}% (${job.stage ?? job.status})`}
                    >
                      <div
                        className="h-full bg-primary-600 dark:bg-primary-400 transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    {!api.isTerminalJobStatus(job.status) && (
                      <button
                        onClick={() => void handleCancel(job.id)}
                        disabled={cancelling === job.id}
                        className="btn-ghost text-sm"
                      >
                        {cancelling === job.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost text-sm"
              >
                ← Previous
              </button>
              <span className="text-sm text-surface-500">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="btn-ghost text-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
