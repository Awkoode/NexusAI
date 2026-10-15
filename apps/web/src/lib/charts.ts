/**
 * Pure chart-data builders. Everything here is deterministic and unit-tested;
 * components only render what these functions return. No invented data:
 * empty or incompatible inputs yield empty arrays, never placeholders.
 */

export interface HistogramBin {
  bin: string;
  count: number;
}

export function formatBinEdge(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Fixed-width histogram bins over finite values. Empty input → []. */
export function buildHistogramBins(values: number[], binCount = 10): HistogramBin[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0 || binCount < 1) return [];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const width = max === min ? 1 : (max - min) / binCount;
  const counts = new Array<number>(binCount).fill(0);
  for (const v of finite) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / width));
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts.map((count, i) => ({
    bin: `${formatBinEdge(min + i * width)}–${formatBinEdge(min + (i + 1) * width)}`,
    count,
  }));
}

export interface ScatterPoint {
  x: number;
  y: number;
}

/**
 * Paired finite (x, y) points, capped to avoid rendering thousands of dots.
 * Returns the points plus whether truncation happened (must be disclosed).
 */
export function buildScatterPoints(
  xs: (number | null | undefined)[],
  ys: (number | null | undefined)[],
  maxPoints = 500
): { points: ScatterPoint[]; truncated: boolean; total: number } {
  const pairs: ScatterPoint[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      pairs.push({ x, y });
    }
  }
  return {
    points: pairs.slice(0, maxPoints),
    truncated: pairs.length > maxPoints,
    total: pairs.length,
  };
}

export interface ConfusionCell {
  row: string;
  col: string;
  value: number;
  rowTotal: number;
}

/** Flatten a confusion matrix for heatmap rendering. Ragged input → []. */
export function buildConfusionCells(
  matrix: number[][],
  labels: string[]
): ConfusionCell[] {
  if (matrix.length === 0 || matrix.length !== labels.length) return [];
  const cells: ConfusionCell[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length !== labels.length) return [];
    const rowTotal = row.reduce((a, b) => a + b, 0);
    for (let j = 0; j < row.length; j++) {
      cells.push({
        row: labels[i] ?? `row ${i}`,
        col: labels[j] ?? `col ${j}`,
        value: row[j] ?? 0,
        rowTotal,
      });
    }
  }
  return cells;
}

/** Whether a HIGHER value means better for a metric (for fair best-run labels). */
export function isHigherBetter(metric: string): boolean {
  switch (metric) {
    case 'mae':
    case 'rmse':
      return false;
    case 'r2':
    case 'accuracy':
    case 'precision':
    case 'recall':
    case 'f1':
      return true;
    default:
      return true;
  }
}

const REGRESSION_RANK_METRIC = 'r2';
const CLASSIFICATION_RANK_METRIC = 'f1';

/** Metric used to rank runs of the same task. Never mixes tasks. */
export function rankMetricForTask(taskType: string): string {
  return taskType === 'regression' ? REGRESSION_RANK_METRIC : CLASSIFICATION_RANK_METRIC;
}

function metricValue(metrics: Record<string, unknown>, metric: string): number | null {
  const v = metrics[metric];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Index of the best run by the task-appropriate metric. Returns -1 when no
 * run has a finite value (no fake winner). Ties resolve to the earliest run.
 */
export function pickBestRunIndex(
  metricsList: (Record<string, unknown> | null | undefined)[],
  metric: string
): number {
  let best = -1;
  let bestValue: number | null = null;
  const higherBetter = isHigherBetter(metric);
  for (let i = 0; i < metricsList.length; i++) {
    const v = metricsList[i] ? metricValue(metricsList[i] as Record<string, unknown>, metric) : null;
    if (v === null) continue;
    if (
      best === -1 ||
      bestValue === null ||
      (higherBetter ? v > bestValue : v < bestValue)
    ) {
      best = i;
      bestValue = v;
    }
  }
  return best;
}

/** Diverging color for correlation-style values in [-1, 1]; null → neutral. */
export function correlationColor(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '#e2e8f0';
  const t = Math.max(-1, Math.min(1, v));
  if (t < 0) return `rgba(59, 130, 246, ${0.15 + 0.75 * -t})`;
  return `rgba(139, 92, 246, ${0.15 + 0.75 * t})`;
}

/** Sequential intensity color for counts >= 0. */
export function intensityColor(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value <= 0) {
    return '#f1f5f9';
  }
  const t = Math.min(1, value / max);
  return `rgba(124, 58, 237, ${0.12 + 0.78 * t})`;
}
