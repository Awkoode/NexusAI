import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlaskConical, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorAlert, LoadingBlock, PageHeader, StatCard, StatusBadge } from "@/components/states";
import { Heatmap, findMatrix } from "@/components/heatmap";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, createdAt, fmtDate, fmtNum, pick, sanitizeError } from "@/lib/api";

export const Route = createFileRoute("/projects/$projectId/experiments/$experimentId")({
  head: () => ({ meta: [{ title: "Experimento — NexusAI" }] }),
  component: () => {
    const { projectId, experimentId } = Route.useParams();
    return (
      <AppShell crumbs={[{ label: "Projetos", to: "/projects" }, { label: "Projeto", to: "/projects/$projectId", params: { projectId } }, { label: "Experimento" }]}>
        <ExperimentDetail projectId={projectId} experimentId={experimentId} />
      </AppShell>
    );
  },
});

type Loose = Record<string, unknown>;

function ExperimentDetail({ projectId, experimentId }: { projectId: string; experimentId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const exp = useQuery({ queryKey: ["experiment", experimentId], queryFn: () => api.getExperiment(experimentId) });
  const runs = useQuery({ queryKey: ["runs", experimentId], queryFn: () => api.listRuns(experimentId) });

  const rerun = useMutation({
    mutationFn: () => api.runExperiment(experimentId),
    onSuccess: () => { toast.success("Nova run iniciada."); qc.invalidateQueries({ queryKey: ["runs", experimentId] }); qc.invalidateQueries({ queryKey: ["experiment", experimentId] }); },
    onError: (e) => toast.error(sanitizeError(e)),
  });
  const del = useMutation({
    mutationFn: () => api.deleteExperiment(experimentId),
    onSuccess: () => { toast.success("Experimento excluído."); qc.invalidateQueries({ queryKey: ["experiments", projectId] }); navigate({ to: "/projects/$projectId", params: { projectId } }); },
    onError: (e) => toast.error(sanitizeError(e)),
  });

  if (exp.isPending) return <LoadingBlock rows={4} />;
  if (exp.isError) return <ErrorAlert error={exp.error} onRetry={() => exp.refetch()} />;
  const e = exp.data;
  const task = String(pick(e, "taskType", "task_type") ?? "");
  const isReg = task === "regression";
  const latest = (pick(e, "latestRun", "latest_run") ?? {}) as Loose;
  const metrics = ((latest.metrics ?? {}) as Loose);
  const runsList = (runs.data ?? []) as Loose[];

  const scoreOf = (m: Loose) => isReg
    ? (pick<number>(m, "r2", "R2", "r_squared") ?? null)
    : (pick<number>(m, "f1", "F1", "f1_score") ?? null);
  const best = runsList.reduce<{ id: string; s: number } | null>((acc, r) => {
    const s = scoreOf((r.metrics ?? {}) as Loose);
    if (s === null || !isFinite(s)) return acc;
    return !acc || s > acc.s ? { id: String(r.id), s } : acc;
  }, null);

  const cards = isReg
    ? [
        { label: "MAE", v: pick(metrics, "mae", "MAE") },
        { label: "RMSE", v: pick(metrics, "rmse", "RMSE") },
        { label: "R²", v: pick(metrics, "r2", "R2", "r_squared") },
      ]
    : [
        { label: "Accuracy", v: pick(metrics, "accuracy") },
        { label: "Precision", v: pick(metrics, "precision") },
        { label: "Recall", v: pick(metrics, "recall") },
        { label: "F1", v: pick(metrics, "f1", "F1", "f1_score") },
      ];

  const cm = !isReg ? findMatrix((pick(metrics, "confusionMatrix", "confusion_matrix") ?? metrics) as unknown) : null;

  return (
    <>
      <PageHeader
        title={String(e.name ?? "Experimento")}
        description={`${task} · ${String(pick(e, "modelType", "model_type") ?? "")} · alvo: ${String(pick(e, "targetColumn", "target_column") ?? "—")}`}
        actions={
          <>
            <StatusBadge status={pick<string>(e, "status")} />
            <Button variant="outline" disabled={rerun.isPending} onClick={() => rerun.mutate()}>
              <Play className="mr-1 h-4 w-4" /> {rerun.isPending ? "Executando…" : "Reexecutar"}
            </Button>
            <Button variant="outline" onClick={() => setDeleting(true)}><Trash2 className="mr-1 h-4 w-4 text-destructive" /> Excluir</Button>
          </>
        }
      />
      {rerun.isError && <div className="mb-4"><ErrorAlert error={rerun.error} title="Não foi possível reexecutar" /></div>}
      {Boolean(pick(e, "errorMessage", "error_message")) && <div className="mb-4"><ErrorAlert error={String(pick(e, "errorMessage", "error_message"))} title="Experimento falhou" /></div>}

      <section className="mb-6 rounded-xl border bg-card p-5" aria-label="Configuração">
        <h2 className="mb-3 font-semibold">Configuração</h2>
        <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">features</dt><dd className="truncate" title={String((pick(e, "featureColumns", "feature_columns") as string[] | undefined)?.join(", ") ?? "—")}>{String((pick(e, "featureColumns", "feature_columns") as string[] | undefined)?.join(", ") ?? "—")}</dd></div>
          <div><dt className="text-muted-foreground">test_size</dt><dd>{String(pick((pick(e, "config") ?? {}) as Loose, "testSize", "test_size") ?? "—")}</dd></div>
          <div><dt className="text-muted-foreground">random_state</dt><dd>{String(pick((pick(e, "config") ?? {}) as Loose, "randomState", "random_state") ?? "—")}</dd></div>
          <div><dt className="text-muted-foreground">criado em</dt><dd>{fmtDate(createdAt(e))}</dd></div>
        </dl>
      </section>

      <h2 className="mb-3 font-semibold">Última execução</h2>
      {Object.keys(metrics).length === 0 ? (
        <EmptyState icon={<FlaskConical className="h-6 w-6" />} title="Sem métricas ainda" description="Reexecute o experimento para gerar resultados." />
      ) : (
        <>
          <div className={`mb-6 grid gap-4 sm:grid-cols-2 ${isReg ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {cards.map((c) => <StatCard key={c.label} label={c.label} value={fmtNum(c.v)} />)}
          </div>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {!isReg && cm && (
              <section className="rounded-xl border bg-card p-5" aria-label="Matriz de confusão">
                <h3 className="mb-3 font-semibold">Matriz de confusão</h3>
                <Heatmap rows={cm.labels} cols={cm.labels} matrix={cm.matrix} mode="sequential" rowTitle="real" colTitle="predito" />
              </section>
            )}
            <section className="rounded-xl border bg-card p-5" aria-label="Amostras e treino">
              <h3 className="mb-3 font-semibold">Treino</h3>
              <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2">
                <div><dt className="text-muted-foreground">amostras treino</dt><dd>{fmtNum(pick(latest, "trainSamples", "train_samples"))}</dd></div>
                <div><dt className="text-muted-foreground">amostras teste</dt><dd>{fmtNum(pick(latest, "testSamples", "test_samples"))}</dd></div>
                <div><dt className="text-muted-foreground">tempo (s)</dt><dd>{fmtNum(pick(latest, "trainSeconds", "train_seconds"))}</dd></div>
                <div><dt className="text-muted-foreground">concluída em</dt><dd>{fmtDate(pick<string>(latest, "completedAt", "completed_at"))}</dd></div>
              </dl>
            </section>
          </div>
        </>
      )}

      <h2 className="mb-3 font-semibold">Histórico de runs {best && <span className="ml-1 text-xs font-normal text-muted-foreground">(melhor por {isReg ? "R²" : "F1"} destacada)</span>}</h2>
      {runs.isPending ? <LoadingBlock rows={3} /> : runs.isError ? <ErrorAlert error={runs.error} onRetry={() => runs.refetch()} /> : runsList.length === 0 ? (
        <EmptyState title="Nenhuma run" description="O histórico de execuções aparece aqui." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Estado</TableHead>{cards.map((c) => <TableHead key={c.label}>{c.label}</TableHead>)}<TableHead>Treino/teste</TableHead></TableRow></TableHeader>
            <TableBody>
              {runsList.map((r) => {
                const m = (r.metrics ?? {}) as Loose;
                const isBest = best?.id === String(r.id);
                return (
                  <TableRow key={String(r.id)} className={isBest ? "bg-primary/5" : undefined}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(createdAt(r))}{isBest && " ★"}</TableCell>
                    <TableCell><StatusBadge status={pick<string>(r, "status")} /></TableCell>
                    {cards.map((c) => (
                      <TableCell key={c.label} className="font-mono text-xs">{
                        fmtNum(isReg
                          ? (c.label === "MAE" ? pick(m, "mae", "MAE") : c.label === "RMSE" ? pick(m, "rmse", "RMSE") : pick(m, "r2", "R2", "r_squared"))
                          : pick(m, c.label.toLowerCase(), c.label))
                      }</TableCell>
                    ))}
                    <TableCell className="font-mono text-xs">{fmtNum(pick(r, "trainSamples", "train_samples"))} / {fmtNum(pick(r, "testSamples", "test_samples"))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-4 text-sm">
        <Link to="/projects/$projectId" params={{ projectId }} className="text-primary hover:underline">← Voltar ao projeto</Link>
      </p>
      <ConfirmDialog open={deleting} onOpenChange={(o: boolean) => !o && setDeleting(false)} title="Excluir experimento?"
        description="O experimento e suas runs serão removidos."
        busy={del.isPending} onConfirm={() => del.mutate()} />
    </>
  );
}
