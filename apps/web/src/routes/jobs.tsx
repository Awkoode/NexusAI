import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorAlert, LoadingBlock, PageHeader, StatusBadge } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, createdAt, pick, sanitizeError, type Job } from "@/lib/api";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Execuções — NexusAI" },
      { name: "description", content: "Acompanhe e cancele jobs assíncronos." },
      { property: "og:title", content: "Execuções — NexusAI" },
      { property: "og:description", content: "Acompanhe e cancele jobs assíncronos." },
    ],
  }),
  component: () => (
    <AppShell crumbs={[{ label: "Execuções" }]}>
      <Jobs />
    </AppShell>
  ),
});

export const JOB_TYPES = ["dataset.profile", "ml.train", "analysis.describe", "analysis.correlation", "analysis.covariance", "analysis.linear-algebra", "analysis.compare"];
const STATUSES = ["queued", "active", "completed", "failed", "cancelled"];
const LIMIT = 20;

export function duration(j: Job) {
  const s = pick<string>(j, "startedAt", "started_at", "processedOn") ?? createdAt(j);
  const e = pick<string>(j, "finishedAt", "finished_at", "completedAt", "completed_at", "finishedOn");
  if (!s) return "—";
  const ms = (e ? new Date(e).getTime() : Date.now()) - new Date(s).getTime();
  if (!isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function Jobs() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [jobType, setJobType] = useState("all");
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const jobs = useQuery({
    queryKey: ["jobs", page, status, jobType],
    queryFn: () => api.listJobs({ page, limit: LIMIT, status: status === "all" ? undefined : status, jobType: jobType === "all" ? undefined : jobType }),
    refetchInterval: (q) => (q.state.data?.items.some((j) => j.status === "queued" || j.status === "active") ? 4000 : false),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess: () => { toast.success("Cancelamento solicitado."); qc.invalidateQueries({ queryKey: ["jobs"] }); },
    onError: (e) => toast.error(sanitizeError(e)),
  });
  const items = jobs.data?.items ?? [];
  const meta = jobs.data?.meta;
  const totalPages = (meta?.totalPages as number | undefined) ?? (meta?.total ? Math.ceil(Number(meta.total) / LIMIT) : items.length < LIMIT ? page : page + 1);
  const projName = (id?: string) => projects.data?.find((p) => p.id === id)?.name ?? (id ? id.slice(0, 8) : "—");

  return (
    <>
      <PageHeader title="Execuções" description="Jobs assíncronos da sua conta." actions={<Button variant="outline" onClick={() => jobs.refetch()}><RotateCw className="mr-1 h-4 w-4" /> Atualizar</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v: string) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44" aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os status</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={jobType} onValueChange={(v: string) => { setJobType(v); setPage(1); }}>
          <SelectTrigger className="w-56" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{JOB_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {jobs.isPending ? <LoadingBlock rows={5} /> : jobs.isError ? <ErrorAlert error={jobs.error} onRetry={() => jobs.refetch()} /> : items.length === 0 ? (
        <EmptyState icon={<Activity className="h-6 w-6" />} title="Nenhum job encontrado" description="Jobs aparecem aqui quando você roda análises em background ou treina modelos." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Projeto</TableHead><TableHead>Estado</TableHead><TableHead className="w-48">Progresso</TableHead><TableHead>Duração</TableHead><TableHead>Erro</TableHead><TableHead><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((j) => {
                const p = Number(j.progress ?? 0);
                const err = pick(j, "error", "errorMessage", "error_message", "failedReason");
                return (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{String(pick(j, "jobType", "job_type", "type") ?? "—")}</TableCell>
                    <TableCell className="whitespace-nowrap">{projName(pick(j, "projectId", "project_id"))}</TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2"><Progress value={p} className="h-2" aria-label="Progresso" /><span className="w-10 font-mono text-xs">{p}%</span></div>
                      {j.stage && <p className="mt-1 text-xs text-muted-foreground">{j.stage}</p>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{duration(j)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-destructive" title={err ? sanitizeError(err) : ""}>{err ? sanitizeError(err) : "—"}</TableCell>
                    <TableCell>{(j.status === "queued" || j.status === "active") && <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(j.id)}>Cancelar</Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <nav aria-label="Paginação" className="mt-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Anterior</Button>
        <span className="font-mono text-sm">{page} / {Math.max(1, totalPages)}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima <ChevronRight className="h-4 w-4" /></Button>
      </nav>
    </>
  );
}
