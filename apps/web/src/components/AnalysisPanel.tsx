'use client';

import { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { useJobPolling } from '@/lib/useJobPolling';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

const ANALYSIS_TYPES: { value: api.AnalysisType; label: string }[] = [
  { value: 'describe', label: 'Descriptive (Julia)' },
  { value: 'correlation', label: 'Correlation (Julia)' },
  { value: 'covariance', label: 'Covariance (Julia)' },
  { value: 'linear_algebra', label: 'Linear algebra (Julia)' },
  { value: 'compare', label: 'Compare Python × Julia' },
];

function fmt(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function heatColor(v: number | null): string {
  if (v === null || v === undefined) return '#e2e8f0';
  const t = Math.max(-1, Math.min(1, v));
  // Blue (negative) → neutral → purple (positive)
  if (t < 0) return `rgba(59, 130, 246, ${0.15 + 0.75 * -t})`;
  return `rgba(139, 92, 246, ${0.15 + 0.75 * t})`;
}

export function AnalysisPanel({
  projectId,
  dataset,
  numericColumns,
}: {
  projectId: string;
  dataset: api.Dataset;
  numericColumns: string[];
}) {
  const [analysisType, setAnalysisType] = useState<api.AnalysisType>('describe');
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [asyncMode, setAsyncMode] = useState(false);
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [asyncResult, setAsyncResult] = useState<{
    analysisType: api.AnalysisType;
    result: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<api.AnalysisRun | null>(null);
  const [history, setHistory] = useState<api.AnalysisRun[]>([]);
  const { job: trackedJob, error: pollError } = useJobPolling(trackedJobId);

  useEffect(() => {
    api.listAnalyses(projectId).then(setHistory).catch(() => undefined);
  }, [projectId]);

  // When a tracked background job finishes, surface its real result.
  useEffect(() => {
    if (!trackedJob) return;
    if (trackedJob.status === 'completed' && trackedJob.result) {
      setAsyncResult({
        analysisType: (trackedJob.params['analysisType'] as api.AnalysisType) ?? analysisType,
        result: trackedJob.result,
      });
      api.listAnalyses(projectId).then(setHistory).catch(() => undefined);
    }
    if (trackedJob.status === 'failed') {
      setError(trackedJob.errorMessage || 'Background analysis failed');
    }
  }, [trackedJob, projectId, analysisType]);

  function toggle(col: string) {
    setSelected((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  }

  const ANALYSIS_JOB_TYPES: Record<api.AnalysisType, api.JobType> = {
    describe: 'analysis.describe',
    correlation: 'analysis.correlation',
    covariance: 'analysis.covariance',
    linear_algebra: 'analysis.linear-algebra',
    compare: 'analysis.compare',
  };

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAsyncResult(null);
    if (asyncMode) {
      setRunning(true);
      try {
        const job = await api.createJob({
          jobType: ANALYSIS_JOB_TYPES[analysisType],
          projectId,
          datasetId: dataset.id,
          columns: selected.length > 0 ? selected : undefined,
        });
        setTrackedJobId(job.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to queue analysis');
      } finally {
        setRunning(false);
      }
      return;
    }
    setRunning(true);
    try {
      const run = await api.runAnalysis(projectId, {
        datasetId: dataset.id,
        analysisType,
        columns: selected.length > 0 ? selected : undefined,
      });
      setResult(run);
      setHistory(await api.listAnalyses(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleCancelTracked() {
    if (!trackedJobId) return;
    try {
      await api.cancelJob(trackedJobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  }

  const display = result
    ? { analysisType: result.analysisType, result: (result.result ?? {}) as Record<string, unknown> }
    : asyncResult;
  const res = (display?.result ?? {}) as Record<string, unknown>;
  const resColumns = (res['columns'] ?? []) as { name: string; count: number; missing: number; mean: number | null; median: number | null; std: number | null; min: number | null; max: number | null }[];
  const matrix = res['matrix'] as (number | null)[][] | undefined;
  const matrixCols = (res['columns'] ?? []) as string[];
  const entries = (res['entries'] ?? []) as {
    metric: string; column?: string; pair?: [string, string];
    python: number | null; julia: number | null;
    absoluteDifference: number | null; agrees: boolean; warning?: string;
  }[];

  return (
    <section className="card p-6 mt-8" aria-labelledby="analysis-heading">
      <h2 id="analysis-heading" className="text-xl font-bold text-surface-900 dark:text-surface-50">
        Statistical analysis (Julia engine)
      </h2>
      <p className="text-sm text-surface-600 dark:text-surface-400 mt-1 mb-6">
        Independent computation in Julia. Compare runs Python × Julia on the same data.
      </p>

      <form onSubmit={handleRun} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="analysis-type" className="label">Analysis</label>
          <select
            id="analysis-type"
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as api.AnalysisType)}
            className="input"
          >
            {ANALYSIS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Numeric columns (empty = auto-detect)</span>
          <div className="max-h-32 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg p-2 space-y-1">
            {numericColumns.length === 0 && (
              <p className="text-xs text-surface-500 px-2 py-1">No numeric columns detected.</p>
            )}
            {numericColumns.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer">
                <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" className="btn-primary flex-1" disabled={running}>
            {running ? (asyncMode ? 'Queued…' : 'Computing…') : asyncMode ? 'Queue analysis' : 'Run analysis'}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 mb-6">
        <input
          id="async-mode"
          type="checkbox"
          checked={asyncMode}
          onChange={(e) => {
            setAsyncMode(e.target.checked);
            setTrackedJobId(null);
            setAsyncResult(null);
          }}
        />
        <label htmlFor="async-mode" className="text-sm text-surface-600 dark:text-surface-400">
          Run in background (job queue — poll for completion, cancellable)
        </label>
      </div>

      {trackedJob && !api.isTerminalJobStatus(trackedJob.status) && (
        <div className="mb-6 p-4 border border-surface-200 dark:border-surface-700 rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              Job <span className="font-mono">{trackedJob.id.slice(0, 8)}…</span> — {trackedJob.status}
              {trackedJob.stage ? ` (${trackedJob.stage})` : ''} · {trackedJob.progress}%
            </p>
            <button onClick={() => void handleCancelTracked()} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
          <div
            className="mt-2 h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={trackedJob.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Background job progress: ${trackedJob.progress}% (${trackedJob.stage ?? trackedJob.status})`}
          >
            <div className="h-full bg-primary-600 dark:bg-primary-400 transition-all" style={{ width: `${trackedJob.progress}%` }} />
          </div>
        </div>
      )}

      {pollError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{pollError}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {display && (
        <div className="space-y-6">
          {display.analysisType === 'describe' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    {['Column', 'n', 'Missing', 'Mean', 'Median', 'Std (sample)', 'Min', 'Max'].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resColumns.map((c) => (
                    <tr key={c.name} className="border-b border-surface-100 dark:border-surface-800">
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4">{c.count}</td>
                      <td className="py-2 pr-4">{c.missing}</td>
                      <td className="py-2 pr-4">{fmt(c.mean)}</td>
                      <td className="py-2 pr-4">{fmt(c.median)}</td>
                      <td className="py-2 pr-4">{fmt(c.std)}</td>
                      <td className="py-2 pr-4">{fmt(c.min)}</td>
                      <td className="py-2 pr-4">{fmt(c.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(display.analysisType === 'correlation' || display.analysisType === 'covariance') && matrix && (
            <div className="overflow-x-auto">
              <h3 className="font-semibold mb-1 capitalize">{display.analysisType} matrix</h3>
              <p className="text-xs text-surface-500 mb-3">
                {String(res['method'] ?? '')} · missing: {String(res['missingPolicy'] ?? 'pairwise')}
              </p>
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="py-2 pr-2" />
                    {matrixCols.map((c) => (
                      <th key={c} className="py-2 px-2 font-medium text-xs max-w-[100px] truncate">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={matrixCols[i] ?? i}>
                      <th className="py-1 pr-2 font-medium text-xs text-left max-w-[100px] truncate">
                        {matrixCols[i]}
                      </th>
                      {row.map((v, j) => (
                        <td
                          key={j}
                          className="py-1 px-2 text-center tabular-nums text-xs"
                          style={{ backgroundColor: display.analysisType === 'correlation' ? heatColor(v) : undefined }}
                          title={v === null ? 'undefined' : String(v)}
                        >
                          {v === null ? '∅' : fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {display.analysisType === 'linear_algebra' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Dimensions', value: `${String(res['rows'])} × ${String(res['cols'])}` },
                { label: 'Rank', value: String(res['rank'] ?? '—') },
                { label: 'Determinant', value: fmt(res['determinant']) },
                { label: 'κ₂ (cond)', value: fmt(res['conditionNumber']) },
              ].map((s) => (
                <div key={s.label} className="card p-4">
                  <p className="text-xs text-surface-500">{s.label}</p>
                  <p className="text-lg font-bold mt-1">{s.value}</p>
                </div>
              ))}
              {((res['warnings'] ?? []) as string[]).map((w) => (
                <p key={w} className="text-xs text-yellow-700 dark:text-yellow-400 col-span-full">⚠ {w}</p>
              ))}
            </div>
          )}

          {display.analysisType === 'compare' && (
            <div>
              <p className="text-sm mb-3">
                <span className="badge-success badge mr-2">{String(res['agreed'] ?? 0)} agree</span>
                <span className="badge-error badge">{String(res['disagreed'] ?? 0)} disagree</span>
              </p>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={entries.slice(0, 30).map((e) => ({
                      name: e.column ?? (e.pair ? `${e.pair[0]}·${e.pair[1]}` : e.metric),
                      diff: e.absoluteDifference ?? 0,
                      agrees: e.agrees,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={false} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="diff">
                      {entries.slice(0, 30).map((e, i) => (
                        <Cell key={i} fill={e.agrees ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      {['Metric', 'Target', 'Python', 'Julia', '|Δ|', 'Agrees'].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={i} className="border-b border-surface-100 dark:border-surface-800">
                        <td className="py-2 pr-4">{e.metric}</td>
                        <td className="py-2 pr-4">{e.column ?? (e.pair ? e.pair.join(' × ') : '—')}</td>
                        <td className="py-2 pr-4">{fmt(e.python)}</td>
                        <td className="py-2 pr-4">{fmt(e.julia)}</td>
                        <td className="py-2 pr-4">{fmt(e.absoluteDifference)}</td>
                        <td className="py-2 pr-4">{e.agrees ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold mb-3">Analysis history ({history.length})</h3>
          <ul className="space-y-2 text-sm">
            {history.slice(0, 10).map((h) => (
              <li key={h.id} className="flex items-center gap-3">
                <span className={`badge ${h.status === 'completed' ? 'badge-success' : h.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                  {h.status}
                </span>
                <span className="font-medium">{h.analysisType}</span>
                <span className="text-surface-500">· {h.engine} · {new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                {h.errorMessage && <span className="text-red-600 dark:text-red-400 text-xs">{h.errorMessage}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
