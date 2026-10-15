'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import { AppShell } from '@/components/AppShell';
import { StatCard, CardSkeleton, ErrorAlert, StatusBadge } from '@/components/ui';
import { useDashboardData } from '@/lib/useDashboardData';
import { formatDateTime } from '@/lib/format';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  queued: '#6366f1',
  active: '#0ea5e9',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#94a3b8',
  cancel_requested: '#f59e0b',
};

function LandingPage() {
  const features = [
    {
      name: 'Datasets',
      description: 'Upload de CSV com validação, prévia tabular, tipos detectados e perfil estatístico.',
      icon: '📊',
      href: '/projects',
    },
    {
      name: 'Experimentos',
      description: 'Regressão e classificação com métricas reais, histórico de runs e comparação.',
      icon: '🧪',
      href: '/projects',
    },
    {
      name: 'Análises & Jobs',
      description: 'Estatística descritiva, correlações e execução assíncrona com acompanhamento.',
      icon: '📈',
      href: '/projects',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <section className="mb-16 animate-in" aria-labelledby="hero-heading">
          <div className="text-center max-w-3xl mx-auto">
            <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-surface-900 dark:text-surface-50 mb-6">
              Plataforma de <span className="text-primary-600 dark:text-primary-400">Análise de Dados</span> & <span className="text-primary-600 dark:text-primary-400">Machine Learning</span>
            </h1>
            <p className="text-lg sm:text-xl text-surface-600 dark:text-surface-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Do upload de datasets à avaliação de modelos — Projekte, datasets, experimentos e
              análises estatísticas em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup" className="btn-primary w-full sm:w-auto">
                Começar grátis
              </Link>
              <Link href="/auth/login" className="btn-secondary w-full sm:w-auto">
                Entrar
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-50 mb-8 text-center">
            O que você pode fazer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <Link
                key={f.name}
                href={f.href}
                className="card p-6 block transition-colors hover:border-primary-300 dark:hover:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className="text-3xl mb-3" aria-hidden="true">{f.icon}</div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
                  {f.name}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-400">{f.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-surface-200 dark:border-surface-800 py-8">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-surface-500 dark:text-surface-400">
          <p>NexusAI — Análise de dados &amp; Machine Learning</p>
          <p className="mt-1">Construído com Next.js 14, Express, TypeScript, Tailwind CSS e Zod</p>
        </div>
      </footer>
    </div>
  );
}

function Dashboard() {
  const { data, loading, error, refresh } = useDashboardData(true);

  if (loading && !data) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold mb-8">Visão geral</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} rows={2} />
          ))}
        </div>
        <CardSkeleton rows={4} />
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell>
        <h1 className="text-3xl font-bold mb-8">Visão geral</h1>
        <ErrorAlert message={error} onRetry={() => void refresh()} />
      </AppShell>
    );
  }

  const projects = data?.projects ?? [];
  const jobs = data?.jobs ?? [];
  const statusCounts = new Map<string, number>();
  for (const job of jobs) {
    statusCounts.set(job.status, (statusCounts.get(job.status) ?? 0) + 1);
  }
  const statusData = [...statusCounts.entries()].map(([status, count]) => ({ status, count }));
  const activeJobs = jobs.filter((j) => !['completed', 'failed', 'cancelled'].includes(j.status));

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-50">Visão geral</h1>
          <p className="text-surface-600 dark:text-surface-400 mt-1">
            Acompanhe projetos, datasets, experimentos e execuções.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/projects" className="btn-primary text-sm">
            + Novo Projeto
          </Link>
          <Link href="/jobs" className="btn-secondary text-sm">
            Ver execuções
          </Link>
        </div>
      </div>

      {data && data.failedSources.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg" role="note">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Algumas seções não puderam ser carregadas ({data.failedSources.join(', ')}). Os demais
            dados abaixo são reais e atualizados.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Projetos" value={String(projects.length)} description={projects.length === 1 ? '1 projeto ativo' : `${projects.length} projetos`} icon="📁" href="/projects" />
        <StatCard label="Datasets" value={String(data?.datasetCount ?? 0)} description="Arquivos importados" icon="📊" href="/projects" />
        <StatCard label="Experimentos" value={String(data?.experimentCount ?? 0)} description="Modelos treinados e avaliados" icon="🧪" href="/projects" />
        <StatCard label="Jobs ativos" value={String(activeJobs.length)} description={`${data?.jobsTotal ?? 0} execuções no total`} icon="⚙️" href="/jobs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-1">Execuções por estado</h2>
          <p className="text-xs text-surface-500 mb-4">Últimas {jobs.length} execuções da sua conta.</p>
          {statusData.length === 0 ? (
            <p className="text-sm text-surface-500" role="status">Nenhuma execução ainda.</p>
          ) : (
            <div
              className="h-56"
              role="img"
              aria-label={`Distribuição de execuções: ${statusData.map((s) => `${s.count} ${s.status}`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="status" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {statusData.map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Execuções recentes</h2>
            <Link href="/jobs" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Ver todas →
            </Link>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-surface-500" role="status">
              Nenhuma execução ainda. Execute uma análise em modo background para vê-la aqui.
            </p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-3 text-sm">
                  <StatusBadge status={job.status} />
                  <span className="font-medium truncate">{job.jobType}</span>
                  <span className="text-surface-500 ml-auto shrink-0">{formatDateTime(job.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Experimentos recentes</h2>
            <Link href="/projects" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Ver projetos →
            </Link>
          </div>
          {(data?.recentExperiments ?? []).length === 0 ? (
            <p className="text-sm text-surface-500" role="status">Nenhum experimento ainda.</p>
          ) : (
            <ul className="space-y-3">
              {(data?.recentExperiments ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-3 text-sm min-w-0">
                  <StatusBadge status={e.status} />
                  <span className="font-medium truncate">{e.name}</span>
                  <span className="text-surface-500 truncate hidden sm:inline">{e.projectName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-1">Insights de IA</h2>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Relatórios interpretativos ainda não estão disponíveis — a camada de IA não está
            conectada nesta versão. Nenhum relatório foi gerado.
          </p>
          <p className="text-xs text-surface-500 mt-2">
            Métricas, estatísticas e avaliações continuam calculadas pelos motores Python, Julia e
            Node — a IA futura apenas os interpretará.
          </p>
        </div>
      </div>

      {(data?.recentAnalyses ?? []).length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Últimas análises</h2>
          <ul className="space-y-3">
            {(data?.recentAnalyses ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-sm min-w-0">
                <StatusBadge status={a.status} />
                <span className="font-medium truncate">{a.analysisType}</span>
                <span className="text-surface-500 truncate hidden sm:inline">
                  {a.engine} · {a.projectName}
                </span>
                <span className="text-surface-500 ml-auto shrink-0">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" role="status" aria-label="Carregando" />
      </div>
    );
  }

  if (!user) return <LandingPage />;
  return <Dashboard />;
}
