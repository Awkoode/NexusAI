import { AppError } from '../middleware/errorHandler';
import {
  juliaDescribe,
  juliaCorrelation,
  juliaCovariance,
  juliaLinearAlgebra,
  JuliaServiceError,
} from '../services/juliaClient';
import {
  pythonDescribe,
  pythonCorrelation,
  pythonCovariance,
  MlServiceError,
} from '../services/mlClient';
import { requireReadyDataset } from '../services/datasetLoader';
import type { AnalysisType } from '@nexusai/shared';

export const MAX_COMPARE_COLUMNS = 10;
export const MAX_LINALG_ROWS = 200;
export const ABS_TOL = 1e-9;
export const REL_TOL = 1e-6;
export const BENCHMARK_REPETITIONS = 5;

export type ProgressCallback = (progress: number, stage: string) => Promise<void> | void;

const NUMERIC_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

function toNullableNumbers(values: string[]): (number | null)[] {
  return values.map((v) => {
    const t = v.trim();
    if (t === '') return null;
    if (!NUMERIC_RE.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  });
}

function detectNumericColumns(headers: string[], rows: string[][]): string[] {
  const numeric: string[] = [];
  for (let c = 0; c < headers.length; c++) {
    let allNumeric = true;
    let hasValue = false;
    for (const row of rows) {
      const v = (row[c] ?? '').trim();
      if (v === '') continue;
      hasValue = true;
      if (!NUMERIC_RE.test(v)) {
        allNumeric = false;
        break;
      }
    }
    if (allNumeric && hasValue) numeric.push(headers[c]!);
  }
  return numeric;
}

function buildColumnsPayload(
  headers: string[],
  rows: string[][],
  selected: string[] | undefined,
  maxRows: number
): { columns: Record<string, (number | null)[]>; usedColumns: string[]; rowsUsed: number } {
  const limited = rows.slice(0, maxRows);
  const candidates = selected && selected.length > 0 ? selected : detectNumericColumns(headers, limited);
  for (const name of candidates) {
    if (!headers.includes(name)) {
      throw AppError.badRequest('INVALID_COLUMNS', `Unknown column: ${name}`);
    }
  }
  if (candidates.length === 0) {
    throw AppError.badRequest('NO_NUMERIC_COLUMNS', 'No numeric columns available for analysis');
  }
  const columns: Record<string, (number | null)[]> = {};
  for (const name of candidates) {
    const idx = headers.indexOf(name);
    columns[name] = toNullableNumbers(limited.map((r) => r[idx] ?? ''));
  }
  return { columns, usedColumns: candidates, rowsUsed: limited.length };
}

export function toServiceError(error: unknown, service: 'julia' | 'python'): never {
  if (error instanceof JuliaServiceError || error instanceof MlServiceError) {
    const message = error.message.slice(0, 500);
    if (error.statusCode === 422) {
      throw AppError.badRequest('ANALYSIS_VALIDATION_ERROR', message);
    }
    if (error.statusCode === 504) {
      throw AppError.serviceUnavailable('ANALYSIS_TIMEOUT', message);
    }
    throw AppError.serviceUnavailable(
      service === 'julia' ? 'JULIA_UNAVAILABLE' : 'PYTHON_UNAVAILABLE',
      message
    );
  }
  throw error;
}

function agrees(a: number | null, b: number | null): { agrees: boolean; abs: number | null; rel: number | null } {
  if (a === null && b === null) return { agrees: true, abs: 0, rel: 0 };
  if (a === null || b === null) return { agrees: false, abs: null, rel: null };
  const abs = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  const rel = scale === 0 ? abs : abs / scale;
  return { agrees: abs <= Math.max(ABS_TOL, REL_TOL * scale), abs, rel };
}

interface EngineBundle {
  describe: Record<string, unknown>;
  correlation: Record<string, unknown>;
  covariance: Record<string, unknown>;
  versions: Record<string, string>;
  timingsMs: Record<string, number>;
}

async function runPythonBundle(
  columns: Record<string, (number | null)[]>
): Promise<EngineBundle> {
  const timingsMs: Record<string, number> = {};
  const timed = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      timingsMs[key] = Date.now() - start;
    }
  };
  const [describe, correlation, covariance] = await Promise.all([
    timed('describe', () => pythonDescribe({ columns })),
    timed('correlation', () => pythonCorrelation({ columns })),
    timed('covariance', () => pythonCovariance({ columns })),
  ]);
  const samples: number[] = [];
  for (let i = 0; i < BENCHMARK_REPETITIONS; i++) {
    const start = Date.now();
    await pythonDescribe({ columns });
    samples.push(Date.now() - start);
  }
  samples.sort((x, y) => x - y);
  timingsMs['describe_benchmark_median'] = samples[Math.floor(samples.length / 2)]!;
  return {
    describe,
    correlation,
    covariance,
    versions: { service: 'nexusai-ml' },
    timingsMs,
  };
}

async function runJuliaBundle(
  columns: Record<string, (number | null)[]>
): Promise<EngineBundle & { juliaVersion?: string }> {
  const timingsMs: Record<string, number> = {};
  const timed = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      timingsMs[key] = Date.now() - start;
    }
  };
  const payload = { columns, options: { missing_policy: 'pairwise' as const } };
  const [describe, correlation, covariance] = await Promise.all([
    timed('describe', () => juliaDescribe(payload)),
    timed('correlation', () => juliaCorrelation(payload)),
    timed('covariance', () => juliaCovariance(payload)),
  ]);
  const samples: number[] = [];
  for (let i = 0; i < BENCHMARK_REPETITIONS; i++) {
    const start = Date.now();
    await juliaDescribe(payload);
    samples.push(Date.now() - start);
  }
  samples.sort((x, y) => x - y);
  timingsMs['describe_benchmark_median'] = samples[Math.floor(samples.length / 2)]!;
  return { describe, correlation, covariance, versions: {}, timingsMs };
}

function buildComparison(
  usedColumns: string[],
  python: EngineBundle,
  julia: EngineBundle & { juliaVersion?: string }
): Record<string, unknown> {
  const entries: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  const pyCols = ((python.describe['columns'] ?? []) as Record<string, unknown>[]);
  const jlCols = ((julia.describe['columns'] ?? []) as Record<string, unknown>[]);
  const pyByName = new Map(pyCols.map((c) => [c['name'] as string, c]));
  const jlByName = new Map(jlCols.map((c) => [c['name'] as string, c]));

  for (const name of usedColumns) {
    const p = pyByName.get(name);
    const j = jlByName.get(name);
    if (!p || !j) {
      warnings.push(`column "${name}" missing from one engine; skipped`);
      continue;
    }
    for (const metric of ['mean', 'median', 'std', 'variance', 'q1', 'q3', 'min', 'max']) {
      const pv = (p[metric] as number | null) ?? null;
      const jv = (j[metric] as number | null) ?? null;
      const diff = agrees(pv, jv);
      entries.push({
        metric,
        column: name,
        python: pv,
        julia: jv,
        absoluteDifference: diff.abs,
        relativeDifference: diff.rel,
        tolerance: { abs: ABS_TOL, rel: REL_TOL },
        agrees: diff.agrees,
      });
    }
  }

  const pyCorr = python.correlation as { columns?: string[]; matrix?: (number | null)[][] };
  const jlCorr = julia.correlation as { columns?: string[]; matrix?: (number | null)[][] };
  const pyCov = python.covariance as { columns?: string[]; matrix?: (number | null)[][] };
  const jlCov = julia.covariance as { columns?: string[]; matrix?: (number | null)[][] };

  const compareMatrices = (
    kind: string,
    pyM: (number | null)[][] | undefined,
    jlM: (number | null)[][] | undefined,
    cols: string[]
  ): void => {
    if (!pyM || !jlM) {
      warnings.push(`${kind}: matrix missing from one engine`);
      return;
    }
    for (let i = 0; i < cols.length; i++) {
      for (let k = 0; k < cols.length; k++) {
        const pv = pyM[i]?.[k] ?? null;
        const jv = jlM[i]?.[k] ?? null;
        const diff = agrees(pv, jv);
        entries.push({
          metric: kind,
          pair: [cols[i], cols[k]],
          python: pv,
          julia: jv,
          absoluteDifference: diff.abs,
          relativeDifference: diff.rel,
          tolerance: { abs: ABS_TOL, rel: REL_TOL },
          agrees: diff.agrees,
        });
      }
    }
  };

  compareMatrices('correlation', pyCorr.matrix, jlCorr.matrix, usedColumns);
  compareMatrices('covariance', pyCov.matrix, jlCov.matrix, usedColumns);

  const agreed = entries.filter((e) => e['agrees'] === true).length;
  return {
    kind: 'compare',
    comparedAt: new Date().toISOString(),
    engineVersions: {
      julia: julia.juliaVersion ?? null,
      python: python.versions,
    },
    benchmarkMs: {
      python: python.timingsMs,
      julia: julia.timingsMs,
      repetitions: BENCHMARK_REPETITIONS,
      note: 'Wall-clock round-trip per engine (HTTP + compute on shared localhost); not isolated CPU benchmarks. First-call warmup included in describe timing, excluded from benchmark median.',
    },
    tolerance: { abs: ABS_TOL, rel: REL_TOL },
    entries,
    agreed,
    disagreed: entries.length - agreed,
    warnings,
  };
}

export interface AnalysisJobInput {
  analysisType: AnalysisType;
  projectId: string;
  datasetId: string;
  columns?: string[];
  missingPolicy?: 'pairwise' | 'listwise';
  maxRows?: number;
}

/**
 * Execute an analysis end-to-end. Shared by the synchronous HTTP endpoint
 * and the async BullMQ worker — identical code path, identical results.
 * Progress reflects real stages (load → engines → done), never fake percent.
 */
export async function executeAnalysisJob(
  userId: string,
  input: AnalysisJobInput,
  onProgress?: ProgressCallback
): Promise<{ result: Record<string, unknown>; engine: 'julia' | 'comparison' }> {
  const maxRows = input.maxRows ?? 5000;

  if (input.analysisType === 'compare' && (input.columns?.length ?? 0) > MAX_COMPARE_COLUMNS) {
    throw AppError.badRequest(
      'TOO_MANY_COLUMNS',
      `Compare supports at most ${MAX_COMPARE_COLUMNS} columns`
    );
  }

  await onProgress?.(15, 'loading-dataset');
  const dataset = await requireReadyDataset(userId, input.projectId, input.datasetId);
  await onProgress?.(25, 'dataset-loaded');

  let result: Record<string, unknown>;
  const engine = input.analysisType === 'compare' ? 'comparison' : ('julia' as const);

  if (input.analysisType === 'linear_algebra') {
    const { columns, usedColumns } = buildColumnsPayload(
      dataset.headers,
      dataset.rows,
      input.columns,
      MAX_LINALG_ROWS
    );
    await onProgress?.(50, 'calling-julia');
    const colArrays = usedColumns.map((name) => columns[name]!);
    const matrix: number[][] = [];
    const rowCount = Math.min(MAX_LINALG_ROWS, dataset.rows.length);
    for (let r = 0; r < rowCount; r++) {
      const rowVals: number[] = [];
      let complete = true;
      for (const arr of colArrays) {
        const v = arr[r];
        if (v === null || v === undefined) {
          complete = false;
          break;
        }
        rowVals.push(v);
      }
      if (complete) matrix.push(rowVals);
    }
    if (matrix.length === 0) {
      throw AppError.badRequest('NO_COMPLETE_ROWS', 'No complete numeric rows for linear algebra');
    }
    if (usedColumns.length > 200 || matrix.length > 200) {
      throw AppError.badRequest('MATRIX_TOO_LARGE', 'Matrix limited to 200x200');
    }
    try {
      const jl = await juliaLinearAlgebra(matrix);
      result = {
        kind: 'linear_algebra',
        ...jl,
        columns: usedColumns,
        rowsUsed: matrix.length,
        rowsTotal: dataset.rows.length,
      };
    } catch (error) {
      toServiceError(error, 'julia');
    }
    result = result!;
  } else if (input.analysisType === 'compare') {
    const { columns, usedColumns } = buildColumnsPayload(
      dataset.headers,
      dataset.rows,
      input.columns,
      maxRows
    );
    await onProgress?.(50, 'calling-engines');
    let python: EngineBundle;
    let julia: EngineBundle & { juliaVersion?: string };
    try {
      [python, julia] = await Promise.all([runPythonBundle(columns), runJuliaBundle(columns)]);
    } catch (error) {
      if (error instanceof MlServiceError) toServiceError(error, 'python');
      toServiceError(error, 'julia');
    }
    await onProgress?.(80, 'comparing');
    result = buildComparison(usedColumns, python!, julia!);
  } else {
    const { columns } = buildColumnsPayload(
      dataset.headers,
      dataset.rows,
      input.columns,
      maxRows
    );
    await onProgress?.(50, 'calling-julia');
    const payload = { columns, options: { missing_policy: input.missingPolicy ?? 'pairwise' } };
    try {
      if (input.analysisType === 'describe') {
        const jl = await juliaDescribe(payload);
        result = { kind: 'describe', ...jl };
      } else if (input.analysisType === 'correlation') {
        const jl = await juliaCorrelation(payload);
        result = { kind: 'correlation', ...jl };
      } else {
        const jl = await juliaCovariance(payload);
        result = { kind: 'covariance', ...jl };
      }
    } catch (error) {
      toServiceError(error, 'julia');
    }
    result = result!;
  }

  await onProgress?.(90, 'done');
  return { result: result!, engine };
}
