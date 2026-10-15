'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { RunsComparison } from '@/components/RunsComparison';
import { ConfusionHeatmap } from '@/components/ConfusionHeatmap';
import * as api from '@/lib/api';
import { formatUnknown, formatDateTime } from '@/lib/format';

export default function ExperimentDetailPage({
  params,
}: {
  params: { projectId: string; experimentId: string };
}) {
  const [experiment, setExperiment] = useState<api.Experiment | null>(null);
  const [runs, setRuns] = useState<api.ModelRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const fetchAll = useCallback(async () => {
    const [e, r] = await Promise.all([
      api.getExperiment(params.experimentId),
      api.listExperimentRuns(params.experimentId),
    ]);
    setExperiment(e);
    setRuns(r);
  }, [params.experimentId]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await fetchAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load experiment');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, fetchAll]);

  async function handleRerun() {
    setRunning(true);
    setError(null);
    try {
      const updated = await api.runExperiment(params.experimentId);
      setExperiment(updated);
      setRuns(await api.listExperimentRuns(params.experimentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run experiment');
      await fetchAll().catch(() => undefined);
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    await api.deleteExperiment(params.experimentId);
    router.push(`/projects/${params.projectId}`);
  }

  const run = experiment?.latestRun ?? runs[0] ?? null;
  const metrics = (run?.metrics ?? {}) as Record<string, unknown>;
  const summary = run?.predictionsSummary;
  const isRegression = experiment?.taskType === 'regression';
  const confusion = metrics['confusionMatrix'] as number[][] | undefined;
  const labels = (metrics['labels'] as string[] | undefined) ?? [];
  const averaging = metrics['averaging'] as string | undefined;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
        <Link
          href={`/projects/${params.projectId}`}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          ← Back to project
        </Link>

        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">
              {experiment?.name ?? 'Experiment'}
            </h1>
            <p className="text-surface-600 dark:text-surface-400 mt-1 text-sm">
              {experiment?.taskType} · {experiment?.modelType} · target: {experiment?.targetColumn}
            </p>
            {experiment && (
              <span className={`badge mt-2 ${
                experiment.status === 'completed' ? 'badge-success'
                : experiment.status === 'failed' ? 'badge-error'
                : 'badge-warning'
              }`}>
                {experiment.status}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleRerun} disabled={running} className="btn-secondary">
              {running ? 'Running…' : 'Re-run'}
            </button>
            <button onClick={() => setConfirmDelete(true)} className="btn-ghost">
              Delete
            </button>
          </div>
        </div>

        {experiment?.status === 'failed' && experiment.errorMessage && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{experiment.errorMessage}</p>
          </div>
        )}

        {run && run.status === 'completed' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {isRegression
                ? [
                    { label: 'MAE', value: formatUnknown(metrics['mae']) },
                    { label: 'RMSE', value: formatUnknown(metrics['rmse']) },
                    {
                      label: 'R²',
                      value:
                        metrics['r2'] === null || metrics['r2'] === undefined
                          ? 'n/a (undefined)'
                          : formatUnknown(metrics['r2']),
                    },
                    {
                      label: 'Train / Test',
                      value: `${formatUnknown(metrics['trainSamples'])} / ${formatUnknown(metrics['testSamples'])}`,
                    },
                  ].map((s) => (
                    <div key={s.label} className="card p-4">
                      <p className="text-xs text-surface-500 dark:text-surface-400">{s.label}</p>
                      <p className="text-xl font-bold text-surface-900 dark:text-surface-50 mt-1">{s.value}</p>
                    </div>
                  ))
                : [
                    { label: 'Accuracy', value: formatUnknown(metrics['accuracy']) },
                    { label: 'Precision', value: formatUnknown(metrics['precision']) },
                    { label: 'Recall', value: formatUnknown(metrics['recall']) },
                    { label: 'F1-score', value: formatUnknown(metrics['f1']) },
                  ].map((s) => (
                    <div key={s.label} className="card p-4">
                      <p className="text-xs text-surface-500 dark:text-surface-400">{s.label}</p>
                      <p className="text-xl font-bold text-surface-900 dark:text-surface-50 mt-1">{s.value}</p>
                    </div>
                  ))}
            </div>

            {!isRegression && confusion && (
              <div className="card p-6 mb-8">
                <ConfusionHeatmap matrix={confusion} labels={labels} averaging={averaging} />
              </div>
            )}

            {summary && summary.sample.length > 0 && (
              <div className="card p-6 mb-8 overflow-x-auto">
                <h2 className="text-lg font-semibold mb-1">
                  Test predictions sample ({summary.sample.length} of {summary.count})
                </h2>
                <p className="text-xs text-surface-500 mb-4">
                  Actual vs predicted on the held-out test set — never training data.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left py-2 pr-4 font-medium">Actual</th>
                      <th className="text-left py-2 pr-4 font-medium">Predicted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sample.map((pair, i) => (
                      <tr key={i} className="border-b border-surface-100 dark:border-surface-800">
                        <td className="py-2 pr-4">{String(pair[0])}</td>
                        <td className="py-2 pr-4">{String(pair[1])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">Run details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-surface-500">Features</dt><dd>{experiment?.featureColumns.join(', ')}</dd></div>
                <div><dt className="text-surface-500">Test size / seed</dt><dd>{experiment?.config.testSize} / {experiment?.config.randomState}</dd></div>
                <div><dt className="text-surface-500">Training time</dt><dd>{run.trainSeconds != null ? `${run.trainSeconds.toFixed(2)}s` : '—'}</dd></div>
                <div><dt className="text-surface-500">Libraries</dt><dd>{run.libraryVersions ? Object.entries(run.libraryVersions).map(([k, v]) => `${k} ${v}`).join(' · ') : '—'}</dd></div>
              </dl>
            </div>
          </>
        )}

        {runs.length > 1 && (
          <div className="card p-6 mb-8">
            <RunsComparison taskType={experiment?.taskType ?? 'regression'} runs={runs} />
          </div>
        )}

        {runs.length > 0 && runs.length <= 1 && (
          <div className="card p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Run history ({runs.length})</h2>
            <ul className="space-y-2 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className={`badge ${r.status === 'completed' ? 'badge-success' : r.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                    {r.status}
                  </span>
                  <span className="text-surface-500">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {confirmDelete && experiment && (
        <DeleteConfirmModal
          projectName={experiment.name}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}