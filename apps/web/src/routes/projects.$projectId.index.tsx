import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, Database, FlaskConical, Pencil, Plus, Sigma, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorAlert, LoadingBlock, PageHeader, StatCard, StatusBadge } from "@/components/states";
import { Heatmap, findMatrix } from "@/components/heatmap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, createdAt, fmtDate, fmtNum, jobPollInterval, pick, sanitizeError, TERMINAL, type Dataset } from "@/lib/api";
import { ProjectDialog } from "./projects.index";

export const Route = createFileRoute("/projects/$projectId/")({
  head: () => ({
    meta: [
      { title: "Projeto — NexusAI" },
      { name: "description", content: "Datasets, experimentos e análises do projeto." },
    ],
  }),
  component: () => {
    const { projectId } = Route.useParams();
    return (
      <AppShell crumbs={[{ label: "Projetos", to: "/projects" }, { label: "Detalhe" }]}>
        <ProjectDetail projectId={projectId} />
      </AppShell>
    );
  },
});

const ANALYSIS_TYPES = ["describe", "correlation", "covariance", "linear_algebra", "compare"] as const;
const JOB_OF: Record<string, string> = {
  describe: "analysis.describe",
  correlation: "analysis.correlation",
  covariance: "analysis.covariance",
  linear_algebra: "analysis.linear-algebra",
  compare: "analysis.compare",
};
const REG_MODELS = ["linear_regression", "random_forest_regressor"];
const CLS_MODELS = ["logistic_regression", "random_forest_classifier"];

function ProjectDetail({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => api.getProject(projectId) });
  const datasets = useQuery({ queryKey: ["datasets", projectId], queryFn: () => api.listDatasets(projectId) });
  const experiments = useQuery({ queryKey: ["experiments", projectId], queryFn: () => api.listExperiments(projectId) });
  const analyses = useQuery({ queryKey: ["analyses", projectId], queryFn: () => api.listAnalyses(projectId) });

  const del = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => { toast.success("Projeto excluído."); qc.invalidateQueries({ queryKey: ["projects"] }); navigate({ to: "/projects" }); },
    onError: (e) => toast.error(sanitizeError(e)),
  });

  if (project.isPending) return <LoadingBlock rows={4} />;
  if (project.isError) return <ErrorAlert error={project.error} onRetry={() => project.refetch()} />;
  const p = project.data;

  return (
    <>
      <PageHeader
        title={p.name}
        description={p.description || "Sem descrição."}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" /> Editar</Button>
            <Button variant="outline" onClick={() => setDeleting(true)}><Trash2 className="mr-1 h-4 w-4 text-destructive" /> Excluir</Button>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Datasets" icon={<Database className="h-4 w-4" />} value={datasets.data?.length ?? 0} />
        <StatCard label="Experimentos" icon={<FlaskConical className="h-4 w-4" />} value={experiments.data?.length ?? 0} />
        <StatCard label="Análises" icon={<Sigma className="h-4 w-4" />} value={analyses.data?.length ?? 0} />
      </div>
      <Tabs defaultValue="datasets">
        <TabsList aria-label="Seções do projeto">
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="experiments">Experimentos</TabsTrigger>
          <TabsTrigger value="analyses">Análises</TabsTrigger>
        </TabsList>
        <TabsContent value="datasets" className="mt-4"><DatasetsTab projectId={projectId} /></TabsContent>
        <TabsContent value="experiments" className="mt-4"><ExperimentsTab projectId={projectId} /></TabsContent>
        <TabsContent value="analyses" className="mt-4"><AnalysesTab projectId={projectId} /></TabsContent>
      </Tabs>
      {editing && <ProjectDialog project={p} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)} title="Excluir projeto?"
        description={`"${p.name}" e todos os seus dados serão removidos. Esta ação não pode ser desfeita.`}
        busy={del.isPending} onConfirm={() => del.mutate()} />
    </>
  );
}

/* ---------------- Datasets ---------------- */

function DatasetsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Dataset | null>(null);
  const datasets = useQuery({ queryKey: ["datasets", projectId], queryFn: () => api.listDatasets(projectId) });

  const up = useMutation({
    mutationFn: (file: File) => api.uploadDataset(projectId, file),
    onSuccess: (d) => { toast.success(`Dataset "${d.name ?? "CSV"}" enviado.`); qc.invalidateQueries({ queryKey: ["datasets", projectId] }); },
    onError: (e) => toast.error(sanitizeError(e)),
    onSettled: () => setUploading(false),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteDataset(id),
    onSuccess: () => { toast.success("Dataset excluído."); qc.invalidateQueries({ queryKey: ["datasets", projectId] }); setDeleting(null); },
    onError: (e) => toast.error(sanitizeError(e)),
  });

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { toast.error("Apenas arquivos CSV."); return; }
    setUploading(true);
    up.mutate(f);
  };

  return (
    <section aria-label="Datasets">
      <div className="mb-4 flex justify-end">
        <Button asChild disabled={uploading}>
          <label className="cursor-pointer">
            <Upload className="mr-1 h-4 w-4" /> {uploading ? "Enviando…" : "Enviar CSV"}
            <input type="file" accept=".csv" className="sr-only" disabled={uploading}
              onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </Button>
      </div>
      {datasets.isPending ? <LoadingBlock rows={3} /> : datasets.isError ? <ErrorAlert error={datasets.error} onRetry={() => datasets.refetch()} /> : (datasets.data ?? []).length === 0 ? (
        <EmptyState icon={<Database className="h-6 w-6" />} title="Nenhum dataset" description="Envie um CSV de até 10MB para começar a explorar." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(datasets.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => { window.location.href = `/projects/${projectId}/datasets/${d.id}`; }}
                  className="font-display font-semibold hover:text-primary text-left w-full"
                >
                  {d.name ?? "Dataset"}
                </button>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={String(pick(d, "originalFilename", "original_filename") ?? "")}>
                {String(pick(d, "originalFilename", "original_filename") ?? "")}
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {pick<number>(d, "rowCount", "row_count") ?? "?"} linhas · {pick<number>(d, "columnCount", "column_count") ?? "?"} colunas
              </p>
              {Boolean(pick(d, "errorMessage", "error_message")) && (
                <p className="mt-2 text-xs text-destructive">{sanitizeError(pick(d, "errorMessage", "error_message"))}</p>
              )}
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{fmtDate(createdAt(d))}</span>
                <Button variant="ghost" size="icon" aria-label={`Excluir ${d.name ?? "dataset"}`} onClick={() => setDeleting(d)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!deleting} onOpenChange={(o: boolean) => !o && setDeleting(null)} title="Excluir dataset?"
        description="O arquivo e seus metadados serão removidos."
        busy={del.isPending} onConfirm={() => deleting && del.mutate(deleting.id)} />
    </section>
  );
}

/* ---------------- Experiments ---------------- */

function ExperimentsTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const datasets = useQuery({ queryKey: ["datasets", projectId], queryFn: () => api.listDatasets(projectId) });
  const experiments = useQuery({ queryKey: ["experiments", projectId], queryFn: () => api.listExperiments(projectId) });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteExperiment(id),
    onSuccess: () => { toast.success("Experimento excluído."); qc.invalidateQueries({ queryKey: ["experiments", projectId] }); setDeleting(null); },
    onError: (e) => toast.error(sanitizeError(e)),
  });

  return (
    <section aria-label="Experimentos">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)} disabled={(datasets.data ?? []).length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Novo experimento
        </Button>
      </div>
      {experiments.isPending ? <LoadingBlock rows={3} /> : experiments.isError ? <ErrorAlert error={experiments.error} onRetry={() => experiments.refetch()} /> : (experiments.data ?? []).length === 0 ? (
        <EmptyState icon={<Brain className="h-6 w-6" />} title="Nenhum experimento"
          description={(datasets.data ?? []).length === 0 ? "Envie um dataset primeiro." : "Configure regressão ou classificação sobre um dataset."} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(experiments.data ?? []).map((e) => (
            <li key={e.id} className="flex flex-col rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => { window.location.href = `/projects/${projectId}/experiments/${e.id}`; }}
                  className="font-display font-semibold hover:text-primary text-left w-full"
                >
                  {e.name ?? "Experimento"}
                </button>
                <StatusBadge status={pick<string>(e, "status")} />
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {String(pick(e, "taskType", "task_type") ?? "")} · {String(pick(e, "modelType", "model_type") ?? "")}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">alvo: {String(pick(e, "targetColumn", "target_column") ?? "—")}</p>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{fmtDate(createdAt(e))}</span>
                <Button variant="ghost" size="icon" aria-label="Excluir experimento" onClick={() => setDeleting(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <ExperimentDialog projectId={projectId} onClose={() => setOpen(false)} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(o: boolean) => !o && setDeleting(null)} title="Excluir experimento?"
        description="O experimento e seu histórico de runs serão removidos."
        busy={del.isPending} onConfirm={() => deleting && del.mutate(deleting)} />
    </section>
  );
}

function ExperimentDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const datasets = useQuery({ queryKey: ["datasets", projectId], queryFn: () => api.listDatasets(projectId) });
  const [datasetId, setDatasetId] = useState("");
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState("regression");
  const [modelType, setModelType] = useState(REG_MODELS[0]);
  const [targetColumn, setTargetColumn] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const models = taskType === "regression" ? REG_MODELS : CLS_MODELS;

  const headers = useQuery({
    queryKey: ["preview-headers", datasetId],
    queryFn: () => api.previewDataset(datasetId, 1, 0),
    enabled: !!datasetId,
  });
  const cols = ((headers.data?.data as Record<string, unknown> | undefined)?.headers ?? []) as string[];
  const toggleFeature = (c: string) => setFeatures((f) => (f.includes(c) ? f.filter((x) => x !== c) : [...f, c]));

  const m = useMutation({
    mutationFn: () => api.createExperiment({
      projectId, datasetId, name: name || undefined, taskType, modelType, targetColumn: targetColumn.trim(),
      featureColumns: features.filter((f) => f !== targetColumn.trim()),
    }),
    onSuccess: () => { toast.success("Experimento criado e treinado."); qc.invalidateQueries({ queryKey: ["experiments", projectId] }); onClose(); },
  });

  return (
    <Dialog open onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Novo experimento</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          {m.isError && <ErrorAlert error={m.error} title="Não foi possível criar" />}
          <div className="space-y-2">
            <Label>Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger><SelectValue placeholder="Selecione o dataset" /></SelectTrigger>
              <SelectContent>{(datasets.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name ?? d.id.slice(0, 8)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="exp-name">Nome (opcional)</Label><Input id="exp-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tarefa</Label>
              <Select value={taskType} onValueChange={(v: string) => { setTaskType(v); setModelType(v === "regression" ? REG_MODELS[0] : CLS_MODELS[0]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="regression">Regressão</SelectItem><SelectItem value="classification">Classificação</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={modelType} onValueChange={setModelType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{models.map((mo) => <SelectItem key={mo} value={mo}>{mo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Coluna alvo</Label>
            <Select value={targetColumn} onValueChange={(v: string) => { setTargetColumn(v); setFeatures((f) => f.filter((x) => x !== v)); }}>
              <SelectTrigger><SelectValue placeholder={datasetId ? "Selecione a coluna alvo" : "Escolha um dataset primeiro"} /></SelectTrigger>
              <SelectContent>{cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <fieldset className="space-y-2">
            <Label asChild><legend>Features ({features.length} selecionadas)</legend></Label>
            {!datasetId ? <p className="text-xs text-muted-foreground">Escolha um dataset para listar as colunas.</p> : cols.length === 0 ? <p className="text-xs text-muted-foreground">Carregando colunas…</p> : (
              <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border p-2">
                {cols.filter((c) => c !== targetColumn).map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 font-mono text-xs hover:bg-accent">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={features.includes(c)} onChange={() => toggleFeature(c)} aria-label={`Usar ${c} como feature`} />
                    <span className="truncate">{c}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={m.isPending || !datasetId || !targetColumn.trim() || features.filter((f) => f !== targetColumn.trim()).length === 0}>{m.isPending ? "Treinando…" : "Criar e treinar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Analyses ---------------- */

function AnalysesTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const datasets = useQuery({ queryKey: ["datasets", projectId], queryFn: () => api.listDatasets(projectId) });
  const analyses = useQuery({ queryKey: ["analyses", projectId], queryFn: () => api.listAnalyses(projectId) });
  const [datasetId, setDatasetId] = useState("");
  const [analysisType, setAnalysisType] = useState<string>("describe");
  const [columns, setColumns] = useState("");
  const [background, setBackground] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (!s || TERMINAL.includes(s)) {
        if (s && (s === "completed" || s === "failed")) qc.invalidateQueries({ queryKey: ["analyses", projectId] });
        return false;
      }
      return jobPollInterval(s, 0);
    },
  });

  const run = useMutation({
    mutationFn: () => {
      const cols = columns.split(",").map((s) => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = { datasetId, analysisType };
      if (cols.length > 0) body.columns = cols;
      if (background) {
        return api.createJob({ jobType: JOB_OF[analysisType], projectId, datasetId, analysisType, ...(cols.length > 0 ? { columns: cols } : {}) }).then((j) => { setJobId(j.id); return j; });
      }
      return api.createAnalysis(projectId, body);
    },
    onSuccess: () => {
      if (!background) { toast.success("Análise concluída."); qc.invalidateQueries({ queryKey: ["analyses", projectId] }); }
      else toast.success("Job criado. Acompanhe o progresso abaixo.");
    },
    onError: (e) => toast.error(sanitizeError(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.deleteAnalysis(id),
    onSuccess: () => { toast.success("Análise excluída."); qc.invalidateQueries({ queryKey: ["analyses", projectId] }); setDeleting(null); },
    onError: (e) => toast.error(sanitizeError(e)),
  });
  const cancelJob = useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess: () => { toast.success("Cancelamento solicitado."); qc.invalidateQueries({ queryKey: ["job", jobId] }); },
    onError: (e) => toast.error(sanitizeError(e)),
  });
  const laNeedsCols = analysisType === "linear_algebra" && columns.split(",").map((s) => s.trim()).filter(Boolean).length === 0;

  return (
    <section aria-label="Análises" className="grid gap-6 lg:grid-cols-5">
      <div className="rounded-xl border bg-card p-5 lg:col-span-2">
        <h2 className="mb-4 font-semibold">Nova análise</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(datasets.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name ?? d.id.slice(0, 8)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ANALYSIS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="an-cols">Colunas (opcional, vírgula)</Label>
            <Input id="an-cols" value={columns} onChange={(e) => setColumns(e.target.value)} placeholder="ex: idade, salario" />
          </div>
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={background ? "bg" : "sync"} onValueChange={(v: string) => setBackground(v === "bg")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sync">Síncrono</SelectItem><SelectItem value="bg">Background (job)</SelectItem></SelectContent>
            </Select>
          </div>
          {run.isError && <ErrorAlert error={run.error} title="Falha ao executar" />}
          {laNeedsCols && <p className="text-xs text-warning">linear_algebra exige ao menos uma coluna.</p>}
          <Button className="w-full" disabled={run.isPending || !datasetId || laNeedsCols} onClick={() => run.mutate()}>
            {run.isPending ? "Executando…" : "Executar análise"}
          </Button>
          {jobId && job.data && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={job.data.status} />
                {(job.data.status === "queued" || job.data.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => cancelJob.mutate(jobId)}>Cancelar</Button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={Number(job.data.progress ?? 0)} className="h-2" aria-label="Progresso do job" />
                <span className="font-mono text-xs">{Number(job.data.progress ?? 0)}%</span>
              </div>
              {job.data.stage && <p className="mt-1 text-xs text-muted-foreground">{job.data.stage}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-3">
        <h2 className="mb-4 font-semibold">Histórico</h2>
        {analyses.isPending ? <LoadingBlock rows={3} /> : analyses.isError ? <ErrorAlert error={analyses.error} onRetry={() => analyses.refetch()} /> : (analyses.data ?? []).length === 0 ? (
          <EmptyState title="Nenhuma análise" description="Execute a primeira análise ao lado." />
        ) : (
          <ul className="space-y-3">
            {(analyses.data ?? []).map((a) => (
              <li key={a.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold">{String(pick(a, "analysisType", "analysis_type") ?? "—")}</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pick<string>(a, "status")} />
                    <Button variant="ghost" size="icon" aria-label="Excluir análise" onClick={() => setDeleting(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  motor: {String(pick(a, "engine") ?? "—")} · {fmtDate(createdAt(a))}
                </p>
                {Boolean(pick(a, "errorMessage", "error_message")) && <p className="mt-1 text-xs text-destructive">{sanitizeError(pick(a, "errorMessage", "error_message"))}</p>}
                {Boolean(pick(a, "result", "result_json")) && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                      {expanded === a.id ? "Ocultar resultado" : "Ver resultado"}
                    </Button>
                    {expanded === a.id && <AnalysisResult result={pick(a, "result", "result_json")} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog open={!!deleting} onOpenChange={(o: boolean) => !o && setDeleting(null)} title="Excluir análise?"
        description="O registro desta análise será removido."
        busy={del.isPending} onConfirm={() => deleting && del.mutate(deleting)} />
    </section>
  );
}

function AnalysisResult({ result }: { result: unknown }) {
  const m = findMatrix(result);
  const scalars = result && typeof result === "object" && !Array.isArray(result)
    ? Object.entries(result as Record<string, unknown>)
        .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
        .slice(0, 12)
    : [];
  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      {m && (
        <div>
          <p className="mb-2 text-xs font-semibold">Matriz</p>
          <Heatmap rows={m.labels} cols={m.labels} matrix={m.matrix} />
        </div>
      )}
      {scalars.length > 0 && (
        <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2">
          {scalars.map(([k, v]) => (
            <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{typeof v === "number" ? fmtNum(v) : String(v)}</dd></div>
          ))}
        </dl>
      )}
      {!m && scalars.length === 0 && (
        <p className="text-xs text-muted-foreground">Resultado sem resumo tabular — veja o JSON completo abaixo.</p>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-primary hover:underline">JSON completo</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 font-mono text-[11px]">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}
