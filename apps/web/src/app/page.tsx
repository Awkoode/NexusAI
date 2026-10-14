import Link from 'next/link';
import { ModuleCard } from '@/components/ModuleCard';
import { EmptyState } from '@/components/EmptyState';
import { Navigation } from '@/components/Navigation';

const modules = [
  {
    id: 'datasets',
    name: 'Datasets',
    description: 'Upload, inspecione e gerencie arquivos CSV. Visualize estatísticas descritivas, tipos de dados e qualidade dos dados.',
    icon: '📊',
    status: 'planned' as const,
    href: '/projects',
  },
  {
    id: 'regression',
    name: 'Regressão',
    description: 'Modelos de regressão linear, polinomial e regularizada. Avaliação com métricas R², MAE, RMSE e validação cruzada.',
    icon: '📈',
    status: 'planned' as const,
    href: '/projects',
  },
  {
    id: 'forecasting',
    name: 'Previsão de Séries Temporais',
    description: 'ARIMA, Prophet e modelos baseados em deep learning. Decomposição sazonal, detecção de tendência e intervalos de confiança.',
    icon: '🔮',
    status: 'planned' as const,
    href: '/projects',
  },
  {
    id: 'anomaly',
    name: 'Detecção de Anomalias',
    description: 'Isolation Forest, DBSCAN e autoencoders. Identificação de outliers univariados e multivariados com explicabilidade.',
    icon: '🎯',
    status: 'planned' as const,
    href: '/projects',
  },
  {
    id: 'experiments',
    name: 'Experimentos & MLflow',
    description: 'Rastreamento de experimentos, versionamento de modelos, comparação de runs e registro de modelos para deploy.',
    icon: '🧪',
    status: 'planned' as const,
    href: '/projects',
  },
  {
    id: 'reports',
    name: 'Relatórios & Explicações',
    description: 'Geração automática de relatórios em PDF/HTML. Explicações em linguagem natural via LLM para stakeholders não técnicos.',
    icon: '📄',
    status: 'planned' as const,
    href: '/projects',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Hero Section */}
        <section className="mb-16 animate-in" aria-labelledby="hero-heading">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100/20 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              NexusAI v0.1.0 — Fase 1: Fundação
            </div>

            <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-surface-900 dark:text-surface-50 mb-6">
              Plataforma de <span className="text-primary-600 dark:text-primary-400">Análise de Dados</span> & <span className="text-primary-600 dark:text-primary-400">Machine Learning</span>
            </h1>

            <p className="text-lg sm:text-xl text-surface-600 dark:text-surface-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Uma plataforma unificada para ciência de dados: do upload de datasets à publicação de modelos.
              Construída com Next.js, Express, TypeScript e arquitetura preparada para serviços Python e Julia.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/projects"
                className="btn-primary w-full sm:w-auto"
              >
                Acessar Projetos
              </Link>
              <Link
                href="#modules"
                className="btn-secondary w-full sm:w-auto"
              >
                Ver Módulos Planejados
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Overview */}
        <section className="mb-16" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">Visão geral da plataforma</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Projetos"
              value="0"
              description="Nenhum projeto criado ainda"
              icon="📁"
            />
            <StatCard
              label="Datasets"
              value="0"
              description="Aguardando upload"
              icon="📊"
            />
            <StatCard
              label="Experimentos"
              value="0"
              description="Pronto para começar"
              icon="🧪"
            />
            <StatCard
              label="Modelos Registrados"
              value="0"
              description="Nenhum modelo salvo"
              icon="🤖"
            />
          </div>
        </section>

        {/* Quick Actions / Empty State */}
        <section className="mb-16" aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="sr-only">Ações rápidas</h2>
          <EmptyState
            title="Nenhum projeto encontrado"
            description="Comece criando seu primeiro projeto para organizar datasets, experimentos e modelos."
            actionLabel="Criar projeto (em breve)"
            actionHref="/projects"
            icon="📁"
          />
        </section>

        {/* Planned Modules */}
        <section id="modules" aria-labelledby="modules-heading">
          <div className="flex items-center justify-between mb-8">
            <h2 id="modules-heading" className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-50">
              Módulos Planejados
            </h2>
            <span className="badge-info">Fase 2+</span>
          </div>

          <p className="text-surface-600 dark:text-surface-400 mb-8 max-w-3xl">
            Os módulos abaixo estão documentados e arquitetados para as próximas fases de desenvolvimento.
            Esta versão (Fase 1) estabelece a fundação: monorepo, API, frontend, configuração de ambiente e documentação.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <ModuleCard key={module.id} {...module} />
            ))}
          </div>

          <div className="mt-12 p-6 bg-surface-100 dark:bg-surface-900/50 rounded-xl border border-surface-200 dark:border-surface-700">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
              Serviços Futuros (Não Implementados Nesta Fase)
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-surface-600 dark:text-surface-400">
              <li className="flex items-center gap-2">🐍 <strong>ML Python (FastAPI):</strong> Treinamento, inferência e registro de modelos</li>
              <li className="flex items-center gap-2">🔢 <strong>Statistics Julia:</strong> Cálculos numéricos, otimização e estatística avançada</li>
              <li className="flex items-center gap-2">🔴 <strong>Redis + BullMQ:</strong> Filas assíncronas para jobs de longa duração</li>
              <li className="flex items-center gap-2">🤖 <strong>LLM Provider:</strong> Explicações automáticas via OpenAI, Anthropic ou modelos locais</li>
              <li className="flex items-center gap-2">🐘 <strong>PostgreSQL/Supabase:</strong> Persistência completa com migrações versionadas</li>
              <li className="flex items-center gap-2">🐳 <strong>Docker + Render:</strong> Deploy separado de web, API e serviços</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-surface-200 dark:border-surface-800 py-8">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-surface-500 dark:text-surface-400">
          <p>NexusAI v0.1.0 — Fase 1: Fundação Profissional do Projeto</p>
          <p className="mt-1">Construído com Next.js 14, Express, TypeScript, Tailwind CSS e Zod</p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-2xl">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <dt className="text-sm font-medium text-surface-500 dark:text-surface-400">{label}</dt>
          <dd className="text-3xl font-bold text-surface-900 dark:text-surface-50 mt-1">{value}</dd>
          <dd className="text-sm text-surface-500 dark:text-surface-400 mt-1">{description}</dd>
        </div>
      </div>
    </div>
  );
}