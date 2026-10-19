import { fmtNum } from "@/lib/api";

/** Divergent (-1..1 style) or sequential heatmap with numeric values printed in every cell. */
export function Heatmap({
  rows,
  cols,
  matrix,
  mode = "divergent",
  rowTitle,
  colTitle,
}: {
  rows: string[];
  cols: string[];
  matrix: (number | null)[][];
  mode?: "divergent" | "sequential";
  rowTitle?: string;
  colTitle?: string;
}) {
  const flat = matrix.flat().filter((v): v is number => typeof v === "number" && isFinite(v));
  const maxAbs = Math.max(1e-9, ...flat.map(Math.abs));
  const max = Math.max(1e-9, ...flat);
  const bg = (v: number | null) => {
    if (v === null || !isFinite(v)) return "var(--muted)";
    if (mode === "sequential") {
      const t = Math.round((v / max) * 100);
      return `color-mix(in oklch, var(--heat-pos) ${t}%, var(--heat-mid))`;
    }
    const t = Math.round((Math.abs(v) / maxAbs) * 100);
    return `color-mix(in oklch, ${v >= 0 ? "var(--heat-pos)" : "var(--heat-neg)"} ${t}%, var(--heat-mid))`;
  };
  return (
    <div className="overflow-x-auto">
      {colTitle && <p className="mb-1 pl-24 text-xs text-muted-foreground">{colTitle} →</p>}
      <table className="border-separate border-spacing-0.5 text-xs" role="grid">
        <thead>
          <tr>
            <th className="w-24 text-left text-muted-foreground font-normal">{rowTitle ? `${rowTitle} ↓` : ""}</th>
            {cols.map((c) => (
              <th key={c} scope="col" className="max-w-24 truncate px-1 pb-1 font-mono font-normal text-muted-foreground" title={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r + i}>
              <th scope="row" className="max-w-24 truncate pr-2 text-left font-mono font-normal text-muted-foreground" title={r}>
                {r}
              </th>
              {cols.map((c, j) => {
                const v = matrix[i]?.[j] ?? null;
                return (
                  <td
                    key={c + j}
                    className="h-10 min-w-14 rounded text-center font-mono text-foreground"
                    style={{ background: bg(v) }}
                    title={`${r} × ${c}: ${fmtNum(v)}`}
                  >
                    {fmtNum(v, 2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {mode === "divergent" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>−{fmtNum(maxAbs, 2)} negativo</span>
          <span className="h-2 w-32 rounded" style={{ background: "linear-gradient(90deg, var(--heat-neg), var(--heat-mid), var(--heat-pos))" }} />
          <span>positivo +{fmtNum(maxAbs, 2)}</span>
        </div>
      )}
    </div>
  );
}

/** Find a {columns, matrix} pair anywhere in an arbitrary result payload. */
export function findMatrix(obj: unknown, depth = 0): { labels: string[]; matrix: (number | null)[][] } | null {
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  const o = obj as Record<string, unknown>;
  const m = o.matrix ?? o.values ?? o.data;
  const labels = (o.columns ?? o.labels ?? o.names) as unknown;
  if (Array.isArray(m) && Array.isArray(m[0]) && Array.isArray(labels)) {
    return { labels: labels.map(String), matrix: m as (number | null)[][] };
  }
  // object map form: { colA: { colA: 1, colB: .3 }, ... }
  const keys = Object.keys(o);
  if (keys.length > 1 && keys.every((k) => o[k] && typeof o[k] === "object" && !Array.isArray(o[k]))) {
    const inner = o[keys[0]] as Record<string, unknown>;
    if (keys.every((k) => typeof inner[k] === "number" || inner[k] === null)) {
      return { labels: keys, matrix: keys.map((r) => keys.map((c) => ((o[r] as Record<string, number>)[c] ?? null))) };
    }
  }
  for (const k of keys) {
    const f = findMatrix(o[k], depth + 1);
    if (f) return f;
  }
  return null;
}
