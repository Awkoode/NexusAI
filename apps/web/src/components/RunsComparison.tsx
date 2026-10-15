'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';
import { pickBestRunIndex, rankMetricForTask, isHigherBetter } from '@/lib/charts';
import { formatUnknown } from '@/lib/format';
import type { ModelRun } from '@/lib/api';

const METRICS_BY_TASK: Record<string, string[]> = {
  regression: ['mae', 'rmse', 'r2'],
  classification: ['accuracy', 'precision', 'recall', 'f1'],
};

function metricOf(run: ModelRun, metric: string): number | null {
  const v = (run.metrics as Record<string, unknown> | null | undefined)?.[metric];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Compares completed runs of ONE experiment (same task, dataset and config
 * family). Ranks by the task-appropriate metric only — R²/MAE-style metrics
 * are never mixed across tasks because this component never sees two tasks.
 */
export function RunsComparison({
  taskType,
  runs,
}: {
  taskType: string;
  runs: ModelRun[];
}) {
  const completed = runs.filter((r) => r.status === 'completed');
  const metrics = METRICS_BY_TASK[taskType] ?? ['mae', 'rmse', 'r2'];
  const rankMetric = rankMetricForTask(taskType);
  const bestIdx = pickBestRunIndex(
    completed.map((r) => (r.metrics ?? {}) as Record<string, unknown>),
    rankMetric
  );

  if (completed.length === 0) {
    return (
      <p className="text-sm text-surface-500 dark:text-surface-400" role="status">
        No completed runs to compare yet.
      </p>
    );
  }

  const chartData = metrics.map((m) => {
    const row: Record<string, number | string | null> = { metric: m.toUpperCase() };
    completed.forEach((run, i) => {
      row[`run${i + 1}`] = metricOf(run, m);
    });
    return row;
  });

  const colors = ['#8b5cf6', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      <div
        className="h-64"
        role="img"
        aria-label={`Bar chart comparing ${completed.length} runs on ${metrics.join(', ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} width={56} />
            <Tooltip formatter={(value) => (typeof value === 'number' ? formatUnknown(value) : '—')} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {completed.map((run, i) => (
              <Bar key={run.id} dataKey={`run${i + 1}`} name={`Run ${i + 1}`} fill={colors[i % colors.length]}>
                {chartData.map((_, j) => (
                  <Cell key={j} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-left text-xs text-surface-500 dark:text-surface-400 pb-2">
            Completed runs of this experiment only. Best by {rankMetric.toUpperCase()} (
            {isHigherBetter(rankMetric) ? 'higher' : 'lower'} is better)
            {bestIdx >= 0 ? ` — Run ${bestIdx + 1}` : ' — no finite value yet'}.
          </caption>
          <thead>
            <tr className="border-b border-surface-200 dark:border-surface-700">
              <th scope="col" className="text-left py-2 pr-4 font-medium">Run</th>
              {metrics.map((m) => (
                <th scope="col" key={m} className="text-left py-2 pr-4 font-medium uppercase">
                  {m}
                </th>
              ))}
              <th scope="col" className="text-left py-2 pr-4 font-medium">Finished</th>
            </tr>
          </thead>
          <tbody>
            {completed.map((run, i) => (
              <tr
                key={run.id}
                className={`border-b border-surface-100 dark:border-surface-800 ${i === bestIdx ? 'bg-primary-50 dark:bg-primary-950/40' : ''}`}
              >
                <td className="py-2 pr-4 font-medium">
                  Run {i + 1}
                  {i === bestIdx && (
                    <span className="badge badge-success ml-2">best {rankMetric.toUpperCase()}</span>
                  )}
                </td>
                {metrics.map((m) => (
                  <td key={m} className="py-2 pr-4 tabular-nums">
                    {formatUnknown(metricOf(run, m))}
                  </td>
                ))}
                <td className="py-2 pr-4 text-surface-500">
                  {run.completedAt ? new Date(run.completedAt).toLocaleString('pt-BR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
