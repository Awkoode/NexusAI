'use client';

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { buildScatterPoints } from '@/lib/charts';

const MAX_POINTS = 500;

/**
 * Scatter plot of two numeric columns. Renders at most MAX_POINTS dots from
 * real preview rows and always discloses sampling/truncation.
 */
export function ScatterPlot({
  xName,
  yName,
  xs,
  ys,
}: {
  xName: string;
  yName: string;
  xs: (number | null | undefined)[];
  ys: (number | null | undefined)[];
}) {
  const { points, truncated, total } = buildScatterPoints(xs, ys, MAX_POINTS);

  if (points.length === 0) {
    return (
      <p className="text-sm text-surface-500 dark:text-surface-400" role="status">
        No paired numeric values to plot for {xName} × {yName}.
      </p>
    );
  }

  return (
    <div>
      <div
        className="h-64"
        role="img"
        aria-label={`Scatter plot of ${yName} versus ${xName}: ${total} paired values${truncated ? `, showing first ${points.length}` : ''}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={xName}
              tick={{ fontSize: 12 }}
              label={{ value: xName, position: 'insideBottom', offset: -2, fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yName}
              tick={{ fontSize: 12 }}
              width={56}
              label={{ value: yName, angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(value ?? ''),
                name === 'x' ? xName : yName,
              ]}
            />
            <Scatter data={points} fill="#8b5cf6">
              {points.map((_, i) => (
                <Cell key={i} fill="#8b5cf6" fillOpacity={0.65} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
        {total} paired values{truncated ? ` — showing first ${points.length} to keep rendering fast` : ''}.
        Preview sample, not the full dataset.
      </p>
    </div>
  );
}
