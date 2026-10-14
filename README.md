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
| **Frontend (Next.js 14)** | ✅ | App Router, TypeScript strict, Tailwind CSS, tema escuro |
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

## 🏗️ Arquitetura

```
nexusai/
├── apps/
│   ├── web/           # Next.js 14 (App Router) - Frontend
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

# Instale dependências de todo o monorepo
npm install

# Configure variáveis de ambiente
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
# Edite os arquivos .env conforme necessário
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

No arquivo `apps/web/.env.local` (frontend):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
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

### Frontend (`apps/web/.env.local`)

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `NEXT_PUBLIC_API_URL` | Sim | `http://localhost:3001` | URL base da API |
| `NEXT_PUBLIC_API_VERSION` | Não | `v1` | Versão da API |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | — | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | — | Chave anônima do Supabase |
| `NEXT_PUBLIC_APP_NAME` | Não | `NexusAI` | Nome da aplicação |
| `NEXT_PUBLIC_APP_VERSION` | Não | `0.2.0` | Versão do app |

> **Importante**: Apenas variáveis com prefixo `NEXT_PUBLIC_` são expostas ao navegador. Nunca coloque segredos nelas.

## 🏃 Executando Localmente

### Desenvolvimento (frontend + API simultâneos)

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Health check: http://localhost:3001/api/v1/health
- Readiness: http://localhost:3001/api/v1/health/ready

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
- [ ] Previsão de séries temporais — Fase 5
- [ ] Detecção de anomalias — Fase 5
- [ ] Registro de artefatos de modelo — Fase 5 (só métricas são persistidas hoje)
- [ ] Processamento assíncrono (Redis + BullMQ) para uploads/treinos grandes — Fase 5

### Fase 5 — Production Ready (futuro)
- [ ] Redis + BullMQ para jobs assíncronos
- [ ] LLM Provider para explicações automáticas
- [ ] Geração de relatórios PDF/HTML
- [ ] Docker multi-stage para todos os serviços
- [ ] Deploy no Render (serviços separados)
- [ ] CI/CD com GitHub Actions
- [ ] Observabilidade (logs estruturados, métricas, tracing)

## ⚠️ Limitações Atuais

| Limitação | Planejada Para |
|-----------|----------------|
| Sem testes E2E completos | Fase 5 |
| Serviço Julia não implementado | Fase 5 |
| Treinamento é síncrono (limitado por `ML_TIMEOUT_MS`, padrão 120s) | Fase 5 (filas) |
| Modelos treinados não são persistidos como artefatos (só métricas) | Fase 5 |
| Histograma é calculado no navegador a partir da amostra de 100 linhas | Fase 5 (agregação no backend) |
| Docker não configurado | Fase 5 |
| Deploy não automatizado | Fase 5 |

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