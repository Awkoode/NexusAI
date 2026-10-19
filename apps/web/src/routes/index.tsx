import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Brain, Database, FlaskConical, FolderKanban, Hexagon, Sigma } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorAlert, LoadingBlock, PageHeader, StatCard, StatusBadge } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { api, createdAt, fmtDate, pick, type Analysis, type Experiment, type Job } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexusAI — Análise de dados e Machine Learning" },
      { name: "description", content: "Envie CSVs, explore estatísticas, compare Python × Julia e treine modelos de ML em um só lugar." },
      { property: "og:title", content: "NexusAI — Análise de dados e Machine Learning" },
      { property: "og:description", content: "Envie CSVs, explore estatísticas e treine modelos de ML em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-8"><LoadingBlock rows={4} /></div>;
  return session ? <AppShell crumbs={[{ label: "Dashboard" }]}><Dashboard /></AppShell> : <Landing />;
}

function Landing() {
  const features = [
    { Icon: Database, t: "Datasets CSV", d: "Upload, preview paginado e perfil estatístico por coluna." },
    { Icon: Sigma, t: "Análises estatísticas", d: "Descritivas, correlação, covariância e álgebra linear — com verificação Python × Julia." },
    { Icon: Brain, t: "Machine Learning", d: "Regressão e classificação com métricas, matriz de confusão e histórico de runs." },
    { Icon: Activity, t: "Jobs em background", d: "Acompanhe progresso por estágio e cancele execuções longas." },
  ];
  return (
    <main id="main" className="relative min-h-screen overflow-hidden bg-hero">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-display text-xl font-semibold"><Hexagon className="h-7 w-7 text-primary" aria-hidden /> NexusAI</span>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth/login">Entrar</Link></Button>
          <Button asChild><Link to="/auth/signup">Criar conta</Link></Button>
        </div>
      </header>
      <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-28">
        <p className="mb-4 inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">dados → estatística → modelos</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
          Do CSV ao modelo treinado, <span className="text-primary">sem fricção.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Explore datasets, valide estatísticas em dois motores e treine modelos de regressão e classificação numa plataforma única.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth/signup">Começar agora</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth/login">Já tenho conta</Link></Button>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, t, d }) => (
            <div key={t} className="rounded-xl border bg-card/70 p-5 backdrop-blur">
              <Icon className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 text-base font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const JOB_STATES = ["queued", "active", "completed", "failed", "cancelled"] as const;
const JOB_LABEL: Record<string, string> = { queued: "Na fila", active: "Executando", completed: "Concluído", failed: "Falhou", cancelled: "Cancelado" };

function Dashboard() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const jobs = useQuery({ queryKey: ["jobs", "dash"], queryFn: () => api.listJobs({ page: 1, limit: 100 }) });
  const ids = (projects.data ?? []).map((p) => p.id);
  const datasets = useQueries({ queries: ids.map((id) => ({ queryKey: ["datasets", id], queryFn: () => api.listDatasets(id) })) });
  const exps = useQueries({ queries: ids.map((id) => ({ queryKey: ["experiments", id], queryFn: () => api.listExperiments(id) })) });
  const analyses = useQueries({ queries: ids.map((id) => ({ queryKey: ["analyses", id], queryFn: () => api.listAnalyses(id) })) });

  const projName = (id?: string) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const sum = (qs: { data?: unknown[] }[]) => qs.reduce((a, q) => a + (q.data?.length ?? 0), 0);
  const partial = (qs: { isError: boolean }[]) => qs.some((q) => q.isError);
  const pending = (qs: { isPending: boolean }[]) => projects.isPending || qs.some((q) => q.isPending);

  const allExps = exps.flatMap((q, i) => (q.data ?? []).map((e) => ({ ...e, _pid: ids[i] }))) as (Experiment & { _pid: string })[];
  const allAn = analyses.flatMap((q, i) => (q.data ?? []).map((a) => ({ ...a, _pid: ids[i] }))) as (Analysis & { _pid: string })[];
  const byDate = <T,>(a: T[]) => [...a].sort((x, y) => String(createdAt(y) ?? "").localeCompare(String(createdAt(x) ?? ""))).slice(0, 5);

  const jobItems = jobs.data?.items ?? [];
  const chart = JOB_STATES.map((s) => ({ state: JOB_LABEL[s], total: jobItems.filter((j) => j.status === s).length }));
  const totalJobs = (jobs.data?.meta?.total as number | undefined) ?? jobItems.length;

  const val = (isPend: boolean, isErr: boolean, n: number) => (isPend ? <Skeleton className="h-9 w-16" /> : isErr ? "!" : n);

  return (
    <>
      <PageHeader title="Dashboard" description="Visão geral da sua atividade." actions={<Button asChild><Link to="/projects">Ver projetos</Link></Button>} />
      {projects.isError && <div className="mb-6"><ErrorAlert error={projects.error} onRetry={() => projects.refetch()} /></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projetos" icon={<FolderKanban className="h-4 w-4" />} value={val(projects.isPending, projects.isError, projects.data?.length ?? 0)} />
        <StatCard label="Datasets" icon={<Database className="h-4 w-4" />} value={val(pending(datasets), false, sum(datasets))} hint={partial(datasets) ? "Algumas fontes falharam" : undefined} />
        <StatCard label="Experimentos" icon={<FlaskConical className="h-4 w-4" />} value={val(pending(exps), false, sum(exps))} hint={partial(exps) ? "Algumas fontes falharam" : undefined} />
        <StatCard label="Jobs" icon={<Activity className="h-4 w-4" />} value={val(jobs.isPending, jobs.isError, totalJobs)} hint={jobs.isError ? "Falha ao carregar jobs" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border bg-card p-5 lg:col-span-3" aria-labelledby="chart-t">
          <h2 id="chart-t" className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-primary" /> Jobs por estado</h2>
          {jobs.isPending ? <Skeleton className="h-64" /> : jobs.isError ? <ErrorAlert error={jobs.error} onRetry={() => jobs.refetch()} /> : jobItems.length === 0 ? (
            <EmptyState title="Nenhum job ainda" description="Rode uma análise em background ou treine um modelo." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="state" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--accent)" }} />
                  <Bar dataKey="total" name="Jobs" fill="var(--chart-1)" radius={[4, 4, 0, 0]} label={{ position: "top", fill: "var(--foreground)", fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <RecentList title="Jobs recentes" className="lg:col-span-2" loading={jobs.isPending} error={jobs.isError ? jobs.error : null} onRetry={() => jobs.refetch()}
          empty="Nenhum job." more={<Link to="/jobs" className="text-xs text-primary hover:underline">Ver todos</Link>}
          items={jobItems.slice(0, 5).map((j: Job) => ({ key: j.id, title: String(pick(j, "jobType", "job_type", "type") ?? "job"), sub: projName(pick(j, "projectId", "project_id")) + " · " + fmtDate(createdAt(j)), right: <StatusBadge status={j.status} /> }))} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RecentList title="Experimentos recentes" loading={pending(exps)} error={null} empty="Nenhum experimento."
          items={byDate(allExps).map((e) => ({
            key: e.id,
            title: <Link to="/projects/$projectId/experiments/$experimentId" params={{ projectId: e._pid, experimentId: e.id }} className="hover:text-primary">{e.name ?? "Experimento"}</Link>,
            sub: `${pick(e, "modelType", "model_type") ?? ""} · ${projName(e._pid)}`,
            right: <StatusBadge status={pick(e, "status")} />,
          }))} />
        <RecentList title="Análises recentes" loading={pending(analyses)} error={null} empty="Nenhuma análise."
          items={byDate(allAn).map((a) => ({
            key: a.id,
            title: <Link to="/projects/$projectId" params={{ projectId: a._pid }} className="hover:text-primary">{String(pick(a, "analysisType", "analysis_type") ?? "análise")}</Link>,
            sub: `${projName(a._pid)} · ${fmtDate(createdAt(a))}`,
            right: <StatusBadge status={pick(a, "status")} />,
          }))} />
      </div>
    </>
  );
}

function RecentList({ title, items, loading, error, onRetry, empty, more, className }: {
  title: string; items: { key: string; title: React.ReactNode; sub: string; right?: React.ReactNode }[];
  loading: boolean; error: unknown; onRetry?: () => void; empty: string; more?: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{more}</div>
      {loading ? <LoadingBlock rows={3} /> : error ? <ErrorAlert error={error} onRetry={onRetry} /> : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="truncate font-medium">{i.title}</p><p className="truncate text-xs text-muted-foreground">{i.sub}</p></div>
              {i.right}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
