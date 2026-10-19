# NexusAI

Plataforma web de análise de dados, estatística e machine learning — construída com arquitetura profissional desde o primeiro dia.

## 📋 Visão Geral

O NexusAI é uma plataforma unificada para ciência de dados que permite:

- **Gerenciamento de projetos** — Organize datasets, experimentos e modelos em workspaces isolados
- **Análise de dados** — Upload, inspeção e profiling automático de arquivos CSV
- **Machine Learning** — Regressão, previsão de séries temporais, detecção de anomalias e classificação
- **Rastreamento de experimentos** — Versionamento, comparação de runs e registro de modelos
- **Explicabilidade** — Relatórios automáticos e explicações em linguagem natural via LLM

## ✅ Fase 2 — Implementada

Esta versão adiciona **persistência real, autenticação e gerenciamento de projetos**:

| Componente | Status | Detalhes |
|------------|--------|----------|
| **Monorepo** | ✅ | npm workspaces com `apps/web`, `apps/api`, `packages/shared` |
| **Frontend (TanStack Start)** | ✅ | File-based routing, React Query, Tailwind + shadcn, tema escuro |
| **Backend (Express)** | ✅ | TypeScript, Zod, Helmet, CORS, error handling centralizado |
| **Health Checks** | ✅ | `GET /api/v1/health` (liveness) e `GET /api/v1/health/ready` (readiness) |
| **Shared Package** | ✅ | Tipos TypeScript compartilhados (API responses, health, pagination, projects, auth) |
| **Configuração de Ambiente** | ✅ | `.env.example` validado com Zod, variáveis públicas/privadas separadas |
| **Banco de Dados** | ✅ | PostgreSQL/Supabase com migrações versionadas e RLS |
| **Autenticação** | ✅ | Supabase Auth com middleware de validação de token |
| **CRUD de Projetos** | ✅ | Criar, listar, editar e excluir projetos com autorização por usuário |
| **Documentação** | ✅ | README, architecture.md, guias de execução |
| **Scripts** | ✅ | `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate` |
| **Testes** | ✅ | Testes de integração para auth e projetos |

## ✅ Fase 3 — Implementada

Esta versão adiciona o **Data Workspace: upload de CSV, armazenamento privado e análise exploratória real**:

| Componente | Status | Detalhes |
|------------|--------|----------|
| **Tabela `datasets`** | ✅ | Migração `002_datasets.sql` com status, metadados e RLS por projeto |
| **Upload de CSV** | ✅ | `POST /api/v1/projects/:projectId/datasets` (multipart, limite 10 MB configurável) |
| **Validação de CSV** | ✅ | Parser PapaParse: aspas, quebras de linha, cabeçalhos duplicados/vazios, linhas inconsistentes |
| **Armazenamento** | ✅ | Abstração `StorageProvider`; local em `./uploads` (dev) ou bucket privado Supabase (`STORAGE_DRIVER=supabase`) |
| **Pré-visualização** | ✅ | `GET /api/v1/datasets/:id/preview` (até 100 linhas, `limit`/`offset`) |
| **Perfil estatístico** | ✅ | `GET /api/v1/datasets/:id/profile` (média, mediana, desvio-padrão populacional, quartis, top categorias) |
| **Detecção de tipos** | ✅ | `integer`, `float`, `boolean`, `date`, `datetime`, `string` a partir dos valores observados |
| **Gráficos (Recharts)** | ✅ | Ausentes por coluna, top categorias e histograma amostral na página do dataset |
| **Páginas** | ✅ | Detalhe do projeto (`/projects/[projectId]`) e do dataset (`/projects/[projectId]/datasets/[datasetId]`) |
| **Testes** | ✅ | 14 testes de CSV/perfil + 11 testes de endpoints de datasets (total: 42 na API) |

## ✅ Fase 6 — Implementada

Processamento assíncrono real com **Redis + BullMQ**: operações demoradas viram jobs persistentes
executados por um worker separado, com retry, cancelamento e acompanhamento no frontend.

| Componente | Status | Detalhes |
|------------|--------|----------|
| **Tabela `jobs`** | ✅ | Migração `005_jobs.sql`: tipo, estado, parâmetros, progresso real por estágio, resultado, erro sanitizado, tentativas, RLS por usuário |
| **Fila BullMQ** | ✅ | Fila `nexusai-analytics` (bullmq@4 + ioredis@5); jobId determinístico `job:<uuid>` — re-enfileirar nunca duplica |
| **Tipos de job** | ✅ | `dataset.profile`, `ml.train`, `analysis.describe/correlation/covariance/linear-algebra/compare` — payload só com IDs + parâmetros validados |
| **Worker separado** | ✅ | `npm run worker` (processo próprio); concorrência configurável; retry com backoff exponencial só para falhas transitórias (`UnrecoverableError` pula retry); timeouts dos serviços; logs com IDs de correlação; shutdown gracioso; recuperação de jobs órfãos no boot |
| **API de jobs** | ✅ | `POST /jobs` → 202, `GET /jobs` (filtros + paginação), `GET /jobs/:id`, `POST /jobs/:id/cancel`; sync preservado |
| **Cancelamento** | ✅ | `queued` → removido da fila; `active` → flag cooperativa (resultado nunca publicado após cancelamento confirmado); terminais rejeitam com 400 |
| **Frontend** | ✅ | Modo "background" no AnalysisPanel, polling com backoff que para em estado terminal, barra de progresso por estágio real, cancelamento, histórico paginado (JobsPanel) |
| **Testes** | ✅ | Unitários (validação, auth, cancelamento) + integração com Redis+BullMQ reais |

## ✅ Fase 8 — Implementada

Dashboard avançado, visualizações e polimento de produto — experiência SaaS completa.

| Componente | Status | Detalhes |
|------------|--------|----------|
| **Sistema de Design** | ✅ | Tokens (cores, tipografia, espaçamento, bordas, sombras, foco), componentes padronizados: Botões, Inputs, Selects, Cards, Modais, Badges, Tabelas, Tooltips, Skeletons, Empty States, Pagination, Breadcrumbs |
| **Navegação** | ✅ | Sidebar fixa desktop / drawer mobile (`AppShell`), links ativos, breadcrumbs, skip-to-content, autenticação integrada |
| **Dashboard Principal** | ✅ | Métricas reais via fan-out (`projects`, `datasets`, `experiments`, `jobs`), gráfico de barras de execuções por estado, listas recentes (jobs, experimentos, análises), degradação parcial honesta quando falha fonte |
| **Página de Projetos** | ✅ | Listagem com cards, busca/filtro implícito, criação/edição/exclusão via modal, estados vazios, confirmação destrutiva |
| **Exploração de Datasets** | ✅ | Metadados, preview paginado, estatísticas por coluna, missing-values chart, top categorias, histograma amostral, **scatter plot** (até 500 pts, divulga amostragem), **matriz de correlação** (sample, cores divergentes), aviso de limitações |
| **Dashboard ML** | ✅ | Cards de métricas (MAE/RMSE/R² ou Acc/Prec/Rec/F1), **ConfusionHeatmap** acessível (cores redundantes com valores), **RunsComparison** (ranking por R² ou F1 apenas, nunca mistura tarefas), histórico de runs, detalhes de execução |
| **Análises Estatísticas / Julia** | ✅ | Estatísticas descritivas, correlações, covariâncias, álgebra linear, comparação Python×Julia com flags de concordância, histórico |
| **Central de Execuções (Jobs)** | ✅ | `/jobs` — listagem paginada, tipo, projeto, estado, duração, erro sanitizado, cancelamento, polling controlado (usa hook `useJobPolling`) |
| **Central de Insights IA** | ✅ | Seção no dashboard (explica que camada IA não conectada; diferencia métricas calculadas de interpretação futura) |
| **Gráficos** | ✅ | Tooltips, legendas, eixos legíveis, formatação consistente, estados vazios, tratamento de nulos, responsivo, cores consistentes, acessibilidade (não dependem só de cor) |
| **Responsividade / Acessibilidade** | ✅ | Sidebar drawer, tabelas com overflow, gráficos redimensionam, modais mobile, labels, foco visível, contraste, skip link, `prefers-reduced-motion` |
| **Estados de Interface** | ✅ | Loading (skeletons), erro (alert com retry), vazio (EmptyState com ação), auth expirado, sem permissão, operação em andamento |
| **Testes / Build** | ✅ | Typecheck, lint, build, testes de API (69) + shared (5) todos passam |

## 🏗️ Arquitetura

```
nexusai/
├── apps/
│   ├── web/           # TanStack Start (React + Vite) - Frontend
│   │   ├── src/
│   │   │   ├── routes/          # Rotas file-based (/, /projects, /projects/$projectId, /jobs, /auth/*)
│   │   │   ├── components/      # AppShell, ui (shadcn), states, heatmap, dialogs
│   │   │   └── lib/             # api.ts (cliente da API :3001), auth (Supabase), supabase
│   └── api/           # Express + TypeScript - Backend API
├── packages/
│   └── shared/        # Tipos e contratos TypeScript compartilhados
├── services/          # Reservado para serviços futuros
│   ├── ml-python/     # FastAPI para ML (Fase 3+)
│   └── statistics-julia/  # Julia para estatística (Fase 3+)
├── database/
│   ├── migrations/    # Scripts SQL versionados (001_profiles_and_projects.sql)
│   └── seeds/         # Dados iniciais para desenvolvimento
├── docs/              # Documentação técnica
├── .github/workflows/ # CI/CD (futuro)
├── .env.example       # Template de variáveis de ambiente
└── package.json       # Workspace root com scripts unificados
```

### Comunicação entre Serviços

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Web       │────▶│   API       │────▶│   PostgreSQL     │
│  (Next.js)  │     │ (Express)   │     │   (Supabase)     │
└─────────────┘     └──────┬──────┘     └──────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌───────────┐ ┌──────────┐
        │ ML Python│ │Statistics │ │  Redis   │
        │ (FastAPI)│ │  Julia    │ │ (Queue)  │
        └──────────┘ └───────────┘ └──────────┘
```

Detalhes em [`docs/architecture.md`](docs/architecture.md).

## 🚀 Pré-requisitos

- **Node.js** ≥ 20.0.0
- **npm** ≥ 10.0.0
- **PostgreSQL** 15+ (ou [Supabase](https://supabase.com))
- **Conta Supabase** — para autenticação e banco de dados
- **Git**

## 📦 Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd nexusai

# Instale dependências de todo o monorepo (apps/api, apps/web, packages/shared)
npm install

# Configure variáveis de ambiente (já existem templates; preencha o bloco Supabase)
# .env + apps/api/.env (backend) | apps/web/.env (frontend VITE_*) | services/*/.env
```

## ⚙️ Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Anote a URL do projeto e as chaves de API

### 2. Configurar Variáveis de Ambiente

No arquivo `.env` (backend):

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

No arquivo `apps/web/.env` (frontend TanStack Start):

```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Aplicar Migrações

```bash
# Aplicar migrações no banco de dados
npm run db:migrate up
```

Isso criará as tabelas `profiles` e `projects` com as políticas de Row Level Security (RLS).

### 4. Configurar Autenticação no Supabase

1. No painel do Supabase, vá em **Authentication > Providers**
2. Ative o provedor **Email**
3. Configure o redirecionamento de senha para: `http://localhost:3000/auth/reset-password`

## ⚙️ Configuração de Ambiente

### Backend (`.env`)

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `NODE_ENV` | Não | `development` | Ambiente de execução |
| `PORT` | Não | `3001` | Porta do servidor API |
| `CORS_ORIGIN` | Não | `http://localhost:3000` | Origem permitida para CORS |
| `DATABASE_URL` | Sim | — | URL de conexão PostgreSQL |
| `API_VERSION` | Não | `v1` | Versão da API no path |
| `SUPABASE_URL` | Sim | — | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Sim | — | Chave anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Não | — | Chave de serviço (apenas backend) |

### Frontend (`apps/web/.env`, prefixo `VITE_`)

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `VITE_API_URL` | Sim | `http://localhost:3001` | URL base da API |
| `VITE_SUPABASE_URL` | Sim | — | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sim | — | Chave anônima do Supabase |

> **Importante**: Apenas variáveis com prefixo `VITE_` são expostas ao navegador. Nunca coloque segredos nelas.

### Jobs assíncronos (backend)

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `REDIS_URL` | Para jobs | — | URL do Redis. Sem ela, `POST /jobs` retorna 503 e o worker se recusa a iniciar |
| `WORKER_CONCURRENCY` | Não | `2` | Jobs processados em paralelo pelo worker |
| `JOB_MAX_ATTEMPTS` | Não | `3` | Tentativas totais por job (1ª tentativa + retries) |
| `JOB_BACKOFF_MS` | Não | `5000` | Atraso base do backoff exponencial entre retries |

## 🏃 Executando Localmente

### Desenvolvimento (frontend + API simultâneos)

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Health check: http://localhost:3001/api/v1/health
- Readiness: http://localhost:3001/api/v1/health/ready

### Com Redis + worker (jobs assíncronos)

```bash
# Terminal 0 - Redis (escolha uma opção)
redis-server --port 6379
# ou: docker run -p 6379:6379 redis:7

# Terminal 1 - API
npm run dev --workspace=apps/api

# Terminal 2 - Worker (processo separado, obrigatório para consumir a fila)
npm run worker --workspace=apps/api

# Terminal 3 - Frontend
npm run dev --workspace=apps/web
```

Sem Redis, a API inicia normalmente, mas `POST /api/v1/jobs` responde `503 QUEUE_UNAVAILABLE`.
Sem worker, os jobs ficam em `queued` até um worker iniciar (recuperação no boot re-enfileira órfãos).

### Separadamente

```bash
# Terminal 1 - API
npm run dev --workspace=apps/api

# Terminal 2 - Frontend
npm run dev --workspace=apps/web
```

### Produção (build + start)

```bash
# Build de todos os workspaces
npm run build

# Iniciar API
npm run start --workspace=apps/api

# Iniciar Frontend
npm run start --workspace=apps/web
```

## 🧪 Qualidade de Código

```bash
# Lint (ESLint)
npm run lint

# Type checking (TypeScript strict)
npm run typecheck

# Testes
npm run test

# Testes de integração da fila (exige Redis local: REDIS_URL=redis://127.0.0.1:6379)
# PowerShell: $env:RUN_QUEUE_INTEGRATION='1'; npm run test:integration --workspace=apps/api
# Bash:       RUN_QUEUE_INTEGRATION=1 npm run test:integration --workspace=apps/api

# Tudo junto
npm run lint && npm run typecheck && npm run test
```

## 🗄️ Banco de Dados (Migrações)

```bash
# Criar nova migração
npm run db:migrate create nome_da_migracao

# Aplicar migrações (requer DATABASE_URL)
npm run db:migrate up

# Rollback (requer DATABASE_URL)
npm run db:migrate down nome_da_migracao
```

### Estrutura do Banco

- **profiles** — Dados públicos do usuário (id, display_name, timestamps)
- **projects** — Projetos do usuário (id, user_id, name, description, timestamps)
- **datasets** — Metadados de CSVs (id, project_id, user_id, name, original_filename, storage_path, mime_type, file_size_bytes, row_count, column_count, status, error_message, schema_json, timestamps)
- **schema_migrations** — Controle de migrações aplicadas

> O conteúdo do CSV **não** é armazenado no banco — apenas metadados. O arquivo original fica no
> armazenamento de objetos (`./uploads` local em dev, bucket privado `datasets` no Supabase em produção).

### Row Level Security (RLS)

Todas as tabelas têm RLS habilitado com políticas que garantem:
- Usuários só podem ver e modificar seus próprios perfis
- Usuários só podem ver e modificar seus próprios projetos
- Datasets são acessíveis apenas via projetos do próprio usuário (políticas com `EXISTS` sobre `projects`)

## 📡 Endpoints da API

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| `GET` | `/api/v1/health` | Liveness probe | Não |
| `GET` | `/api/v1/health/ready` | Readiness probe | Não |
| `GET` | `/api/v1/projects` | Listar projetos do usuário | Sim |
| `POST` | `/api/v1/projects` | Criar novo projeto | Sim |
| `GET` | `/api/v1/projects/:id` | Obter projeto específico | Sim |
| `PATCH` | `/api/v1/projects/:id` | Atualizar projeto | Sim |
| `DELETE` | `/api/v1/projects/:id` | Excluir projeto | Sim |
| `POST` | `/api/v1/projects/:projectId/datasets` | Upload de CSV (multipart, campo `file`) | Sim |
| `GET` | `/api/v1/projects/:projectId/datasets` | Listar datasets do projeto | Sim |
| `GET` | `/api/v1/datasets/:datasetId` | Metadados do dataset | Sim |
| `GET` | `/api/v1/datasets/:datasetId/preview?limit=&offset=` | Amostra de linhas (máx. 100) | Sim |
| `GET` | `/api/v1/datasets/:datasetId/profile` | Estatísticas descritivas | Sim |
| `DELETE` | `/api/v1/datasets/:datasetId` | Excluir dataset (banco + arquivo) | Sim |
| `POST` | `/api/v1/experiments` | Criar e treinar experimento (retorna 201 com resultados) | Sim |
| `GET` | `/api/v1/projects/:projectId/experiments` | Histórico de experimentos do projeto | Sim |
| `GET` | `/api/v1/experiments/:id` | Detalhe + última execução | Sim |
| `GET` | `/api/v1/experiments/:id/runs` | Histórico de execuções | Sim |
| `POST` | `/api/v1/experiments/:id/run` | Reexecutar (nova run; 400 se já em execução) | Sim |
| `DELETE` | `/api/v1/experiments/:id` | Excluir experimento + runs | Sim |
| `POST` | `/api/v1/jobs` | Criar job assíncrono → **202** `{ id, status: queued, ... }` | Sim |
| `GET` | `/api/v1/jobs?page=&limit=&status=&jobType=&projectId=` | Listar jobs próprios (paginado) | Sim |
| `GET` | `/api/v1/jobs/:jobId` | Estado, progresso real por estágio e resultado | Sim |
| `POST` | `/api/v1/jobs/:jobId/cancel` | Cancelar (queued: imediato; active: cooperativo) | Sim |

### Frontend Pages (Fase 8)

| Rota | Descrição | Auth |
|------|-----------|------|
| `/` | Landing (não autenticado) / Dashboard (autenticado) | Não / Sim |
| `/projects` | Lista de projetos com CRUD | Sim |
| `/projects/[projectId]` | Detalhe do projeto (datasets + experiments) | Sim |
| `/projects/[projectId]/datasets/[datasetId]` | Exploração completa do dataset | Sim |
| `/projects/[projectId]/experiments/[experimentId]` | Detalhe do experimento + comparação de runs | Sim |
| `/jobs` | Central de execuções (histórico paginado) | Sim |
| `/auth/login` | Login | Não |
| `/auth/signup` | Cadastro | Não |
| `/auth/forgot-password` | Recuperação de senha | Não |
| `/auth/reset-password` | Redefinição de senha | Não |

### Exemplo de Resposta — Job criado (202)

```json
{
  "success": true,
  "data": {
    "id": "623e4567-e89b-12d3-a456-426614174000",
    "jobType": "analysis.describe",
    "status": "queued",
    "progress": 0,
    "attempts": 0,
    "maxAttempts": 3,
    "createdAt": "2026-10-14T12:00:00.000Z"
  },
  "meta": { "timestamp": "2026-10-14T12:00:00.000Z", "version": "v1" }
}
```

### Exemplo de Resposta — Health

```json
{
  "status": "ok",
  "service": "nexusai-api",
  "version": "v1",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "uptime": 42,
  "checks": [
    { "name": "api", "status": "pass", "componentType": "service", "observedValue": 42, "observedUnit": "s" }
  ]
}
```

### Exemplo de Resposta — Projeto

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Meu Projeto",
    "description": "Descrição do projeto",
    "createdAt": "2026-10-14T12:00:00.000Z",
    "updatedAt": "2026-10-14T12:00:00.000Z"
  },
  "meta": {
    "timestamp": "2026-10-14T12:00:00.000Z",
    "version": "v1"
  }
}
```

## 📊 Datasets e Análise (Fase 3)

### Configuração do armazenamento

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `STORAGE_DRIVER` | `local` | `local` (dev, `./uploads/`) ou `supabase` (bucket privado) |
| `STORAGE_BUCKET` | `datasets` | Nome do bucket privado no Supabase Storage |
| `MAX_UPLOAD_MB` | `10` | Tamanho máximo do CSV (imposto pelo servidor; o cliente não pode aumentá-lo) |

Para produção com Supabase Storage:
1. Crie um bucket **privado** chamado `datasets` (Storage > New bucket, sem acesso público).
2. Defina `STORAGE_DRIVER=supabase` e `SUPABASE_SERVICE_ROLE_KEY` (somente no backend).
3. O backend verifica a propriedade do projeto em **todas** as operações — a `service_role` nunca chega ao frontend.

### Limites de upload e processamento

- Tamanho: `MAX_UPLOAD_MB` (padrão 10 MB, máx. 100 MB por validação de env).
- Colunas: máx. 500. Linhas: máx. 1.000.000. Campo: máx. 10.000 caracteres.
- Preview: máx. 100 linhas por requisição. Categorias no perfil: top 50 por coluna.
- Arquivos acima do limite recebem `413 FILE_TOO_LARGE`; CSV malformado recebe `400` com o dataset marcado como `failed`.

### Regras de detecção de tipos

- `integer`: todos os valores não-vazios casam `^-?\d+$`.
- `float`: todos casam numérico com ponto/expoente.
- `boolean`: somente `true/false/0/1/yes/no` (case-insensitive).
- `date`: `AAAA-MM-DD`. `datetime`: `AAAA-MM-DD[T ]HH:MM…`.
- Caso contrário: `string`. Colunas totalmente vazias são `string`.
- A tipagem é **metadado analítico** — os valores originais são preservados.

### Estatísticas calculadas

- Gerais: linhas, colunas, células, ausentes (quantidade e %), nº de colunas numéricas/categóricas, tamanho do arquivo.
- Numéricas: contagem válida, média, mediana, **desvio-padrão populacional (÷ N)**, mín, máx, Q1, Q3, distintos.
- Categóricas: contagem válida, distintos, top valores com frequência (top 50).
- Ausentes: strings vazias contam como ausentes; `"0"` e `"false"` são valores válidos.
- A resposta nunca contém `NaN` ou `Infinity` (valores não-finitos são normalizados).

## 📐 Julia Statistical Engine (Fase 5)

Motor estatístico independente em Julia 1.12 (`services/statistics-julia`), chamado apenas pelo backend
via `X-Julia-Service-Key`. Endpoints internos: `GET /health`, `POST /v1/statistics/{describe,correlation,covariance}`,
`POST /v1/linear-algebra/analyze`.

### API pública (Node)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| `POST` | `/api/v1/projects/:projectId/analyses` | Executa `describe`, `correlation`, `covariance`, `linear_algebra` ou `compare` | Sim |
| `GET` | `/api/v1/projects/:projectId/analyses` | Histórico de análises do projeto | Sim |
| `GET` | `/api/v1/analyses/:analysisId` | Detalhe de uma análise | Sim |
| `DELETE` | `/api/v1/analyses/:analysisId` | Excluir análise | Sim |

### Convenções numéricas (Julia e Python alinhados)

- Variância/desvio: **amostrais (÷ n−1)** nos dois motores; quantis por **interpolação linear**.
- Correlação de Pearson `pairwise` (n por par retornado); covariância amostral; correlação indefinida → `null`, nunca 0.
- Ausentes: só JSON `null`; strings/booleanos rejeitados com 422.
- Binário: `average="binary"` com classe positiva = maior rótulo; multiclasse: `weighted` (registrado em `averaging`).
- Comparação: tolerâncias abs `1e-9` / rel `1e-6`; flags `agrees` por métrica + benchmark de latência (mediana de 5 repetições, round-trip com nota de limitação).

### Iniciar e testar

```bash
cd services/statistics-julia
julia --project=. setup_deps.jl   # uma vez (resolve deps, gera Manifest.toml)
$env:JULIA_SERVICE_KEY = "dev-julia-service-key"
julia --project=. src/server.jl   # PORT padrão 8001
julia --project=. test/runtests.jl
```

Deploy (Render, serviço privado): Dockerfile usa `julia:1.12-bookworm`, respeita `PORT`, healthcheck em `/health`.
Serviços no Render não compartilham `localhost` — configure `JULIA_SERVICE_URL` com a URL do serviço.

## 🔒 Segurança

- ✅ TypeScript `strict: true` em todos os packages
- ✅ Validação de variáveis de ambiente com Zod na inicialização
- ✅ Tratamento centralizado de erros (sem stack traces em produção)
- ✅ CORS restrito à origem configurada
- ✅ Helmet para headers de segurança
- ✅ Body parser com limite de 1MB
- ✅ Request ID para rastreamento
- ✅ `.gitignore` adequado (ignora `.env`, `node_modules`, builds)
- ✅ Zero segredos hardcoded
- ✅ Autenticação via Supabase Auth (JWT)
- ✅ Row Level Security (RLS) no PostgreSQL
- ✅ Consultas SQL parametrizadas (prevenção contra SQL injection)
- ✅ Validação de entrada com Zod
- ✅ Upload restrito a CSV com verificação de conteúdo (não só extensão/MIME)
- ✅ Bucket privado; nenhuma URL pública de arquivo; downloads passam pela API autenticada
- ✅ Exclusão consistente (banco + objeto; falha no storage aborta antes de apagar o registro)

## 📚 Documentação Adicional

- [`docs/architecture.md`](docs/architecture.md) — Decisões arquiteturais, comunicação entre serviços, modelagem de dados

## 🗺️ Roadmap — Próximas Fases

### Fase 4 — ML Engine (implementada nesta versão)

- [x] Serviço Python (FastAPI) para treinamento e avaliação
- [x] Regressão: `linear_regression`, `random_forest_regressor` (MAE, RMSE, R²)
- [x] Classificação: `logistic_regression`, `random_forest_classifier` (accuracy, precision, recall, F1, matriz de confusão)
- [x] Experimentos e execuções persistidos (`experiments`, `model_runs`)
- [x] Interface de experimentos (configurar, executar, histórico, métricas)
- [ ] Previsão de séries temporais — Fase 7
- [ ] Detecção de anomalias — Fase 7
- [ ] Registro de artefatos de modelo — Fase 7 (só métricas são persistidas hoje)
- [x] Processamento assíncrono (Redis + BullMQ) para uploads/treinos grandes — Fase 6 ✅

### Fase 5 — Julia Statistical Engine (implementada)

- [x] Serviço Julia (HTTP.jl) com describe/correlação/covariância/álgebra linear
- [x] Comparação Python × Julia com tolerâncias e flags de concordância
- [x] Análises persistidas (`analysis_runs`) + interface com heatmap

### Fase 7 — Production Ready (futuro)
- [ ] LLM Provider para explicações automáticas
- [ ] Geração de relatórios PDF/HTML
- [ ] Docker multi-stage para todos os serviços
- [ ] Deploy no Render (serviços separados)
- [ ] CI/CD com GitHub Actions
- [ ] Observabilidade (logs estruturados, métricas, tracing)

## ⚠️ Limitações Atuais

| Limitação | Planejada Para |
|-----------|----------------|
| Sem testes E2E completos (com banco real) | Fase 7 |
| Treinamento/análise via jobs é limitado pelos timeouts dos serviços | Fase 7 (filas com checkpoint) |
| Cancelamento de job ativo não aborta chamadas HTTP em voo (resultado descartado) | Limite documentado |
| Modelos treinados não são persistidos como artefatos (só métricas) | Fase 7 |
| Histograma é calculado no navegador a partir da amostra de 100 linhas | Fase 7 (agregação no backend) |
| Docker não configurado | Fase 7 |
| Deploy não automatizado | Fase 7 |

## 🤖 Serviço ML (Fase 4)

### Iniciar

```bash
cd services/ml-python
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows
cp .env.example .env
.venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Requer `ML_SERVICE_KEY` idêntica no `.env` da API (`ML_SERVICE_URL=http://localhost:8000`).

### Testes Python

```bash
cd services/ml-python
.venv/Scripts/python -m pytest tests -q
```

### Deploy no Render (serviço privado)

1. Novo **Web Service** a partir de `services/ml-python/` (Docker).
2. Variáveis: `ML_SERVICE_KEY` (secret), `PORT` (injetada pelo Render — respeitada pelo Dockerfile).
3. Na API: `ML_SERVICE_URL=https://<ml-service>.onrender.com`.
4. Serviços Render **não** compartilham `localhost` — use sempre a URL pública/privada do serviço.
5. Mantenha o serviço ML **privado** quando o plano permitir; o frontend nunca o chama diretamente.

## 👷 Worker de Jobs (Fase 6)

### Executar localmente

```bash
# 1. Suba o Redis (uma das opções)
redis-server --port 6379
# docker run -p 6379:6379 redis:7

# 2. Em outro terminal, inicie o worker (mesmo .env da API)
npm run worker --workspace=apps/api
# produção (após npm run build): npm run worker:start --workspace=apps/api
```

O worker valida o `REDIS_URL` na inicialização e aborta com erro claro se inalcançável.
Na inicialização ele também recupera jobs `active` órfãos (sem heartbeat há >300s),
re-enfileirando com o mesmo `jobId` determinístico (sem duplicar).

### Deploy no Render

1. **Redis gerenciado**: Render Key Value (ou Upstash/Railway) → copie a URL para `REDIS_URL`.
2. **API (Web Service)**: deploy normal; inclua `REDIS_URL` nas variáveis.
3. **Worker (Background Worker)**: mesmo repositório, comando `npm run build && npm run worker:start --workspace=apps/api`;
   mesmas variáveis da API (`DATABASE_URL`, `REDIS_URL`, `ML_SERVICE_URL/KEY`, `JULIA_SERVICE_URL/KEY`…).
4. Escale API e worker de forma independente (`WORKER_CONCURRENCY` por instância).

### Recuperação

- Crash entre DB e Redis: a linha `queued` sem job correspondente é detectada no boot do worker e re-enfileirada.
- Crash durante execução: a linha fica `active` sem heartbeat → recuperada no próximo boot.
- Falhas transitórias: retry com backoff exponencial (`JOB_MAX_ATTEMPTS`, `JOB_BACKOFF_MS`); permanentes não repetem.

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

MIT License — veja [LICENSE](LICENSE) para detalhes.

---

**NexusAI** — Construído com ❤️ usando Next.js, Express, TypeScript, Tailwind CSS, Zod e Supabase.