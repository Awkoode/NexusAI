import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorAlert, LoadingBlock, PageHeader, StatCard, StatusBadge } from "@/components/states";
import { Heatmap } from "@/components/heatmap";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, fmtNum, pick } from "@/lib/api";

export const Route = createFileRoute("/projects/$projectId/datasets/$datasetId")({
  head: () => ({ meta: [{ title: "Dataset — NexusAI" }] }),
  component: () => {
    const { projectId, datasetId } = Route.useParams();
    return (
      <AppShell crumbs={[{ label: "Projetos", to: "/projects" }, { label: "Projeto", to: "/projects/$projectId", params: { projectId } }, { label: "Dataset" }]}>
        <DatasetDetail projectId={projectId} datasetId={datasetId} />
      </AppShell>
    );
  },
});

const PAGE = 20;

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function DatasetDetail({ projectId, datasetId }: { projectId: string; datasetId: string }) {
  const dataset = useQuery({ queryKey: ["dataset", datasetId], queryFn: () => api.getDataset(datasetId) });
  const profile = useQuery({ queryKey: ["profile", datasetId], queryFn: () => api.profileDataset(datasetId) });
  const [page, setPage] = useState(0);
  const preview = useQuery({
    queryKey: ["preview", datasetId, page],
    queryFn: () => api.previewDataset(datasetId, PAGE, page * PAGE),
  });

  const pv = preview.data?.data as Record<string, unknown> | undefined;
  const headers = (pick<string[]>(pv, "headers") ?? []) as string[];
  const rows = (pick<string[][]>(pv, "rows") ?? []) as string[][];
  const totalRows = Number(pick(pv, "totalRows", "total_rows") ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE));

  const prof = profile.data as Record<string, unknown> | undefined;
  const columns = (pick<Record<string, unknown>[]>(prof, "columns") ?? []) as Record<string, unknown>[];

  if (dataset.isPending) return <LoadingBlock rows={4} />;
  if (dataset.isError) return <ErrorAlert error={dataset.error} onRetry={() => dataset.refetch()} />;
  const d = dataset.data;

  return (
    <>
      <PageHeader
        title={String(d.name ?? "Dataset")}
        description={`${String(pick(d, "originalFilename", "original_filename") ?? "")} · enviado em ${fmtDate(pick<string>(d, "createdAt", "created_at"))}`}
        actions={<StatusBadge status={d.status} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Linhas" icon={<Database className="h-4 w-4" />} value={fmtNum(pick(prof, "rowCount", "row_count") ?? pick(d, "rowCount", "row_count") ?? "?")} />
        <StatCard label="Colunas" value={fmtNum(pick(prof, "columnCount", "column_count") ?? pick(d, "columnCount", "column_count") ?? "?")} />
        <StatCard label="Ausentes" value={`${fmtNum(pick(prof, "missingPercentage", "missing_percentage") ?? "?")}%`} hint={`${fmtNum(pick(prof, "missingCells", "missing_cells") ?? "?")} células`} />
        <StatCard label="Num / categóricas" value={`${pick(prof, "numericColumnCount", "numeric_column_count") ?? "?"} / ${pick(prof, "categoricalColumnCount", "categorical_column_count") ?? "?"}`} />
      </div>

      <section className="mb-6 rounded-xl border bg-card p-5" aria-labelledby="prev-t">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="prev-t" className="font-semibold">Preview ({fmtNum(totalRows)} linhas)</h2>
          <nav aria-label="Paginação do preview" className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-mono text-xs">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </nav>
        </div>
        {preview.isPending ? <LoadingBlock rows={3} /> : preview.isError ? <ErrorAlert error={preview.error} onRetry={() => preview.refetch()} /> : rows.length === 0 ? (
          <EmptyState title="Sem linhas" description="O dataset não retornou linhas para preview." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>{headers.map((h) => <TableHead key={h} className="whitespace-nowrap font-mono text-xs">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="max-w-48 truncate font-mono text-xs" title={c}>{c === "" ? <span className="text-muted-foreground">∅</span> : c}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {profile.isPending ? <LoadingBlock rows={3} /> : profile.isError ? <ErrorAlert error={profile.error} onRetry={() => profile.refetch()} /> : columns.length > 0 && (
        <>
          <MissingChart columns={columns} />
          <ColumnTables columns={columns} />
          <SampleCharts headers={headers} rows={rows} />
        </>
      )}
      <p className="mt-4 text-sm">
        <Link to="/projects/$projectId" params={{ projectId }} className="text-primary hover:underline">← Voltar ao projeto</Link>
      </p>
    </>
  );
}

type Col = Record<string, unknown>;

function MissingChart({ columns }: { columns: Col[] }) {
  const data = columns.map((c) => ({ name: String(c.name ?? ""), ausentes: Number(c.nullCount ?? c.null_count ?? 0) }));
  return (
    <section className="mb-6 rounded-xl border bg-card p-5" aria-labelledby="miss-t">
      <h2 id="miss-t" className="mb-4 font-semibold">Valores ausentes por coluna</h2>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
            <Bar dataKey="ausentes" name="Ausentes" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ColumnTables({ columns }: { columns: Col[] }) {
  const numeric = columns.filter((c) => ["integer", "float", "number"].includes(String(c.type ?? "")));
  const categ = columns.filter((c) => !["integer", "float", "number"].includes(String(c.type ?? "")));
  const numOf = (c: Col) => (c.numericStats ?? c.numeric_stats ?? {}) as Record<string, unknown>;
  const catOf = (c: Col) => (c.categoricalStats ?? c.categorical_stats ?? {}) as Record<string, unknown>;
  return (
    <section className="mb-6 grid gap-6 lg:grid-cols-2" aria-label="Estatísticas por coluna">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Colunas numéricas ({numeric.length})</h2>
        {numeric.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Coluna</TableHead><TableHead>Média</TableHead><TableHead>Mediana</TableHead><TableHead>Desv.pad</TableHead><TableHead>Mín</TableHead><TableHead>Máx</TableHead></TableRow></TableHeader>
              <TableBody>
                {numeric.map((c) => { const n = numOf(c); return (
                  <TableRow key={String(c.name)}>
                    <TableCell className="font-mono text-xs">{String(c.name)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(n.mean)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(n.median)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(n.stdDev ?? n.std_dev ?? n.stddev)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(n.min)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(n.max)}</TableCell>
                  </TableRow>); })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-semibold">Top categorias</h2>
        {categ.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma coluna categórica.</p> : (
          <ul className="max-h-96 space-y-4 overflow-y-auto">
            {categ.slice(0, 12).map((c) => {
              const top = ((catOf(c).topValues ?? catOf(c).top_values ?? []) as Record<string, unknown>[]).slice(0, 5);
              return (
                <li key={String(c.name)}>
                  <p className="font-mono text-xs font-semibold">{String(c.name)} <span className="font-normal text-muted-foreground">({fmtNum(c.distinctCount ?? c.distinct_count)} distintos)</span></p>
                  <ul className="mt-1 space-y-1">
                    {top.map((t, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-32 truncate font-mono" title={String(t.value ?? "")}>{String(t.value ?? "")}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.round(Number(t.frequency ?? 0) * 100)}%` }} /></span>
                        <span className="w-16 text-right font-mono text-muted-foreground">{fmtNum(t.count)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function SampleCharts({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const numericIdx = useMemo(() => headers.map((_, i) => i).filter((i) =>
    rows.some((r) => r[i] !== "" && isFinite(Number(r[i])))), [headers, rows]);
  const [histCol, setHistCol] = useState<number | undefined>(undefined);
  const [sx, setSx] = useState<number | undefined>(undefined);
  const [sy, setSy] = useState<number | undefined>(undefined);
  const hc = histCol ?? numericIdx[0];
  const x = sx ?? numericIdx[0];
  const y = sy ?? numericIdx[1];

  const hist = useMemo(() => {
    if (hc === undefined) return [];
    const vals = rows.map((r) => Number(r[hc])).filter((v) => isFinite(v));
    if (vals.length === 0) return [];
    const min = Math.min(...vals), max = Math.max(...vals);
    const bins = 12, w = (max - min) / bins || 1;
    const counts = Array(bins).fill(0) as number[];
    vals.forEach((v) => { counts[Math.min(bins - 1, Math.floor((v - min) / w))]++; });
    return counts.map((c, i) => ({ faixa: `${fmtNum(min + i * w, 2)}–${fmtNum(min + (i + 1) * w, 2)}`, qtd: c }));
  }, [rows, hc]);

  const scatter = useMemo(() => {
    if (x === undefined || y === undefined) return [];
    return rows.map((r) => ({ x: Number(r[x]), y: Number(r[y]) })).filter((p) => isFinite(p.x) && isFinite(p.y)).slice(0, 500);
  }, [rows, x, y]);

  const corr = useMemo(() => {
    const idx = numericIdx.slice(0, 12);
    const series = idx.map((i) => rows.map((r) => Number(r[i])).filter((v) => isFinite(v)));
    const pearson = (a: number[], b: number[]) => {
      const n = Math.min(a.length, b.length);
      if (n < 2) return null;
      const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n, mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
      return da === 0 || db === 0 ? null : num / Math.sqrt(da * db);
    };
    return { labels: idx.map((i) => headers[i]), matrix: idx.map((_, a) => idx.map((_, b) => pearson(series[a], series[b]))) };
  }, [rows, headers, numericIdx]);

  if (numericIdx.length === 0 || rows.length === 0) return null;
  const name = (i?: number) => (i === undefined ? "" : headers[i]);

  return (
    <>
      <section className="mb-6 grid gap-6 lg:grid-cols-2" aria-label="Gráficos da amostra">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Histograma (amostra)</h2>
            <Select value={String(hc)} onValueChange={(v: string) => setHistCol(Number(v))}>
              <SelectTrigger className="w-44" aria-label="Coluna do histograma"><SelectValue /></SelectTrigger>
              <SelectContent>{numericIdx.map((i) => <SelectItem key={i} value={String(i)}>{headers[i]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={hist}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="faixa" stroke="var(--muted-foreground)" fontSize={10} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="qtd" name="Qtd" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-semibold">Dispersão (amostra ≤500)</h2>
            <Select value={String(x)} onValueChange={(v: string) => setSx(Number(v))}>
              <SelectTrigger className="w-36" aria-label="Eixo X"><SelectValue /></SelectTrigger>
              <SelectContent>{numericIdx.map((i) => <SelectItem key={i} value={String(i)}>{headers[i]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(y)} onValueChange={(v: string) => setSy(Number(v))}>
              <SelectTrigger className="w-36" aria-label="Eixo Y"><SelectValue /></SelectTrigger>
              <SelectContent>{numericIdx.map((i) => <SelectItem key={i} value={String(i)}>{headers[i]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <ScatterChart margin={{ left: -12, right: 12 }}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis type="number" dataKey="x" name={name(x)} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="number" dataKey="y" name={name(y)} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ stroke: "var(--border)" }} />
                <Scatter data={scatter} fill="var(--chart-1)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5" aria-labelledby="corr-t">
        <h2 id="corr-t" className="mb-1 font-semibold">Matriz de correlação (amostra de {rows.length} linhas)</h2>
        <p className="mb-3 text-xs text-muted-foreground">Pearson calculado no navegador sobre a amostra do preview — valores exatos vêm da análise “correlation”.</p>
        <Heatmap rows={corr.labels} cols={corr.labels} matrix={corr.matrix} rowTitle="coluna" colTitle="coluna" />
      </section>
    </>
  );
}
