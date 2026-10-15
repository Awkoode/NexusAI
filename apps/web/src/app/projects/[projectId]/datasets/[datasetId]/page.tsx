'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { JobsPanel } from '@/components/JobsPanel';
import { ScatterPlot } from '@/components/ScatterPlot';
import * as api from '@/lib/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatNumber } from '@/lib/format';
import { buildHistogramBins } from '@/lib/charts';

export default function DatasetDetailPage({
  params,
}: {
  params: { projectId: string; datasetId: string };
}) {
  const [dataset, setDataset] = useState<api.Dataset | null>(null);
  const [preview, setPreview] = useState<api.DatasetPreview | null>(null);
  const [profile, setProfile] = useState<api.DatasetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [histColumn, setHistColumn] = useState<string>('');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [d, p, pr] = await Promise.all([
          api.getDataset(params.datasetId),
          api.getDatasetPreview(params.datasetId, 100, 0),
          api.getDatasetProfile(params.datasetId),
        ]);
        setDataset(d);
        setPreview(p);
        setProfile(pr);
        const firstNumeric = pr.columns.find((c) => c.numericStats)?.name ?? '';
        setHistColumn(firstNumeric);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dataset');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, params.datasetId]);

  const missingData = useMemo(
    () =>
      (profile?.columns ?? []).map((c) => ({
        column: c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name,
        missing: c.nullCount,
      })),
    [profile]
  );

  const firstCategorical = useMemo(
    () => profile?.columns.find((c) => c.categoricalStats),
    [profile]
  );

  const categoryData = useMemo(
    () =>
      (firstCategorical?.categoricalStats?.topValues ?? []).slice(0, 10).map((t) => ({
        value: t.value.length > 16 ? `${t.value.slice(0, 15)}…` : t.value,
        count: t.count,
      })),
    [firstCategorical]
  );

  const histogramData = useMemo(() => {
    if (!preview || !histColumn) return [];
    const colIdx = preview.headers.indexOf(histColumn);
    if (colIdx < 0) return [];
    const values = preview.rows
      .map((r) => Number(r[colIdx]))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return [];
    return buildHistogramBins(values, 10);
  }, [preview, histColumn]);

  const numericColumns = useMemo(
    () => (profile?.columns ?? []).filter((c) => c.numericStats),
    [profile]
  );

  const numericHeaders = useMemo(
    () => preview?.headers.filter((_, i) => preview.columnTypes[i] === 'integer' || preview.columnTypes[i] === 'float') ?? [],
    [preview]
  );

  const scatterX = useMemo(
    () => numericHeaders[0] ?? '',
    [numericHeaders]
  );
  const scatterY = useMemo(
    () => numericHeaders[1] ?? numericHeaders[0] ?? '',
    [numericHeaders]
  );

  const scatterData = useMemo(() => {
    if (!preview || !scatterX || !scatterY || scatterX === scatterY) return null;
    const xi = preview.headers.indexOf(scatterX);
    const yi = preview.headers.indexOf(scatterY);
    if (xi < 0 || yi < 0) return null;
    const xs = preview.rows.map((r) => Number(r[xi]));
    const ys = preview.rows.map((r) => Number(r[yi]));
    return { xName: scatterX, yName: scatterY, xs, ys };
  }, [preview, scatterX, scatterY]);

  const correlationData = useMemo(() => {
    if (!preview || numericHeaders.length < 2) return null;
    const indices = numericHeaders.map((h) => preview.headers.indexOf(h));
    const cols = indices.map((idx) =>
      preview.rows.map((r) => Number(r[idx]))
    );
    const n = cols.length;
    if (n < 2) return null;
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        const xi = cols[i];
        const yj = cols[j];
        const pairs = xi.map((x, k) => (Number.isFinite(x) && Number.isFinite(yj[k]) ? [x, yj[k]] : null)).filter((p): p is [number, number] => p !== null);
        if (pairs.length < 2) {
          row.push(NaN);
          continue;
        }
        const meanX = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
        const meanY = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
        const cov = pairs.reduce((s, p) => s + (p[0] - meanX) * (p[1] - meanY), 0) / pairs.length;
        const stdX = Math.sqrt(pairs.reduce((s, p) => s + (p[0] - meanX) ** 2, 0) / pairs.length);
        const stdY = Math.sqrt(pairs.reduce((s, p) => s + (p[1] - meanY) ** 2, 0) / pairs.length);
        row.push(stdX > 0 && stdY > 0 ? cov / (stdX * stdY) : NaN);
      }
      matrix.push(row);
    }
    return { labels: numericHeaders, matrix };
  }, [preview, numericHeaders]);

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

        {error ? (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 mb-8">
              <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">
                {dataset?.name}
              </h1>
              <p className="text-surface-600 dark:text-surface-400 mt-1 text-sm">
                {dataset?.originalFilename} · imported{' '}
                {dataset ? new Date(dataset.createdAt).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>

            {profile && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Rows', value: formatNumber(profile.rowCount) },
                  { label: 'Columns', value: formatNumber(profile.columnCount) },
                  { label: 'Cells', value: formatNumber(profile.totalCells) },
                  {
                    label: 'Missing',
                    value: `${formatNumber(profile.missingCells)} (${profile.missingPercentage.toFixed(1)}%)`,
                  },
                ].map((s) => (
                  <div key={s.label} className="card p-4">
                    <p className="text-xs text-surface-500 dark:text-surface-400">{s.label}</p>
                    <p className="text-xl font-bold text-surface-900 dark:text-surface-50 mt-1">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="card p-6">
                <h2 className="text-lg font-semibold mb-1">Missing values per column</h2>
                <p className="text-xs text-surface-500 mb-4">Full-dataset aggregates from the server profile.</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={missingData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="column" width={110} />
                      <Tooltip />
                      <Bar dataKey="missing" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold mb-1">
                  Top categories{firstCategorical ? ` — ${firstCategorical.name}` : ''}
                </h2>
                <p className="text-xs text-surface-500 mb-4">Full-dataset frequencies (top 10).</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="value" tick={false} label={{ value: 'category', position: 'insideBottom' }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card p-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold">Numeric distribution (sample)</h2>
                <select
                  value={histColumn}
                  onChange={(e) => setHistColumn(e.target.value)}
                  className="input max-w-xs"
                  aria-label="Numeric column"
                >
                  {numericColumns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-surface-500 mb-4">
                Built in the browser from the first {preview?.previewRowCount ?? 0} rows — a sample,
                not the full dataset.
              </p>
              {histogramData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bin" tick={false} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-surface-500">No numeric data in the sample.</p>
              )}
            </div>

            {scatterData && (
              <div className="card p-6 mb-8">
                <h2 className="text-lg font-semibold mb-1">Scatter plot (sample)</h2>
                <p className="text-xs text-surface-500 mb-4">
                  Preview rows only — limited to 500 points. Not the full dataset.
                </p>
                <ScatterPlot {...scatterData} />
              </div>
            )}

            {correlationData && numericHeaders.length >= 2 && (
              <div className="card p-6 mb-8">
                <h2 className="text-lg font-semibold mb-1">Correlation matrix (sample)</h2>
                <p className="text-xs text-surface-500 mb-4">
                  Pearson correlation on preview rows. Diverging color: blue = negative, purple = positive.
                </p>
                <div className="overflow-x-auto">
                  <table className="text-sm border-collapse">
                    <thead>
                      <tr>
                        <th scope="col" className="py-2 pr-2" />
                        {correlationData.labels.map((l) => (
                          <th key={l} scope="col" className="py-2 px-3 font-medium text-xs max-w-[120px] truncate">
                            {l}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlationData.labels.map((rowLabel, i) => (
                        <tr key={rowLabel}>
                          <th scope="row" className="py-2 pr-2 font-medium text-xs text-left max-w-[120px] truncate">
                            {rowLabel}
                          </th>
                          {correlationData.labels.map((colLabel, j) => {
                            const value = correlationData.matrix[i]?.[j];
                            const isDiagonal = i === j;
                            const color = isDiagonal
                              ? '#f1f5f9'
                              : (typeof value === 'number' && Number.isFinite(value)
                                  ? (value < 0
                                      ? `rgba(59, 130, 246, ${0.15 + 0.75 * -value})`
                                      : `rgba(139, 92, 246, ${0.15 + 0.75 * value})`)
                                  : '#e2e8f0');
                            return (
                              <td
                                key={colLabel}
                                className="py-2 px-3 text-center tabular-nums border border-surface-200 dark:border-surface-700"
                                style={{ backgroundColor: color }}
                              >
                                {isDiagonal ? '1.0000' : (typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview && (
              <div className="card p-6 mb-8 overflow-x-auto">
                <h2 className="text-lg font-semibold mb-4">
                  Preview — {preview.previewRowCount} of {preview.totalRows} rows
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      {preview.headers.map((h, i) => (
                        <th key={h} className="text-left py-2 pr-4 font-medium">
                          {h}
                          <span className="block text-xs font-normal text-surface-500">
                            {preview.columnTypes[i]}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-surface-100 dark:border-surface-800">
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2 pr-4 max-w-[200px] truncate">
                            {cell === '' ? <span className="text-surface-400">∅</span> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {profile && (
              <div className="card p-6 overflow-x-auto">
                <h2 className="text-lg font-semibold mb-4">Column statistics</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      {['Column', 'Type', 'Non-null', 'Missing', 'Distinct', 'Mean / Top value'].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profile.columns.map((c) => (
                      <tr key={c.name} className="border-b border-surface-100 dark:border-surface-800">
                        <td className="py-2 pr-4 font-medium">{c.name}</td>
                        <td className="py-2 pr-4">{c.type}</td>
                        <td className="py-2 pr-4">{formatNumber(c.nonNullCount)}</td>
                        <td className="py-2 pr-4">{formatNumber(c.nullCount)}</td>
                        <td className="py-2 pr-4">{formatNumber(c.distinctCount)}</td>
                        <td className="py-2 pr-4">
                          {c.numericStats
                            ? `μ = ${formatNumber(c.numericStats.mean)}`
                            : (c.categoricalStats?.topValues[0]?.value ?? '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-surface-500 mt-4">
                  Standard deviation is population (÷ N). Empty strings count as missing; the strings
                  "0" and "false" are valid values. Identifier-like digit codes are kept as detected —
                  review the type before treating a column as quantitative.
                </p>
              </div>
            )}

            {dataset && preview && (
              <AnalysisPanel
                projectId={params.projectId}
                dataset={dataset}
                numericColumns={numericHeaders}
              />
            )}

            <div className="card p-6 mt-8">
              <JobsPanel projectId={params.projectId} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}