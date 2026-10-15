'use client';

import { buildConfusionCells, intensityColor } from '@/lib/charts';

/**
 * Confusion matrix as an accessible heatmap table. Color is redundant with
 * the numeric value in every cell (never color-only).
 */
export function ConfusionHeatmap({
  matrix,
  labels,
  averaging,
}: {
  matrix: number[][];
  labels: string[];
  averaging?: string;
}) {
  const cells = buildConfusionCells(matrix, labels);

  if (cells.length === 0) {
    return (
      <p className="text-sm text-surface-500 dark:text-surface-400" role="status">
        Confusion matrix unavailable for this run.
      </p>
    );
  }

  const max = Math.max(...cells.map((c) => c.value), 0);
  const columns = labels;

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <caption className="text-left text-xs text-surface-500 dark:text-surface-400 pb-2">
          Rows = actual, columns = predicted
          {averaging ? ` · averaging: ${averaging}` : ''}. Values shown in every cell.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="py-2 pr-2" />
            {columns.map((l) => (
              <th key={l} scope="col" className="py-2 px-3 font-medium text-xs max-w-[120px] truncate">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((rowLabel, _i) => (
            <tr key={rowLabel}>
              <th scope="row" className="py-2 pr-2 font-medium text-xs text-left max-w-[120px] truncate">
                {rowLabel}
              </th>
              {columns.map((colLabel, _j) => {
                const cell = cells.find((c) => c.row === rowLabel && c.col === colLabel);
                const value = cell?.value ?? 0;
                return (
                  <td
                    key={colLabel}
                    className="py-2 px-3 text-center tabular-nums border border-surface-200 dark:border-surface-700"
                    style={{ backgroundColor: intensityColor(value, max) }}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
