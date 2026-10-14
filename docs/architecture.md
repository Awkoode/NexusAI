# NexusAI — Arquitetura e Decisões Técnicas

## 1. Visão Arquitetural

O NexusAI segue uma arquitetura **modular, orientada a serviços** com separação clara de responsabilidades:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MONOREPO NEXUSAI                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────┐                │
│  │    WEB      │───▶│    API      │───▶│   POSTGRESQL     │                │
│  │  (Next.js)  │    │ (Express)   │    │   (Supabase)     │                │
│  └─────────────┘    └──────┬──────┘    └──────────────────┘                │
│                            │                                                │
│              ┌─────────────┼─────────────┐                                 │
│              ▼             ▼             ▼                                 │
│       ┌────────────┐ ┌───────────┐ ┌──────────┐                           │
│       │ ML Python  │ │Statistics │ │  Redis   │                           │
│       │ (FastAPI)  │ │  Julia    │ │ (Queue)  │                           │
│       └────────────┘ └───────────┘ └──────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Princípios Fundamentais

1. **Separação de responsabilidades** — Frontend, API, ML, Estatística são serviços independentes
2. **Contratos compartilhados** — Tipos TypeScript em `packages/shared` eliminam duplicação
3. **Deploy independente** — Cada serviço pode ser versionado e escalado separadamente
4. **Observabilidade nativa** — Health checks, structured logging, request tracing
5. **Segurança por padrão** — Validação Zod, CORS restrito, Helmet, env validation

---

## 2. Comunicação entre Serviços

### API ↔ Frontend
- **Protocolo**: HTTP/JSON sobre REST
- **Versionamento**: Path-based (`/api/v1/...`)
- **Autenticação**: JWT Bearer tokens (Fase 2)
- **Proxy**: Next.js rewrites para `/api/proxy/*` → `NEXT_PUBLIC_API_URL/api/*` (evita CORS em dev)

### API ↔ Serviços Futuros (Python/Julia)
- **Protocolo**: HTTP/JSON (síncrono) + Redis/BullMQ (assíncrono, Fase 3)
- **Autenticação**: API Keys por serviço (`ML_PYTHON_API_KEY`, `STATISTICS_JULIA_API_KEY`)
- **Contratos**: Definidos em `packages/shared` (ex: `TrainRequest`, `PredictResponse`, `StatsComputeRequest`)

### Exemplo de Contrato Futuro (ML Python)

```typescript
// packages/shared/src/ml-contracts.ts
export interface TrainRequest {
  projectId: string;
  datasetId: string;
  taskType: 'regression' | 'classification' | 'forecasting' | 'anomaly_detection';
  targetColumn: string;
  features: string[];
  hyperparameters: Record<string, JsonValue>;
  experimentId?: string;
}

export interface TrainResponse {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  modelId?: string;
  metrics?: Record<string, number>;
  artifacts?: ModelArtifact[];
}
```

---

## 3. Modelagem de Dados (Planejada - Fase 2)

### Entidades Principais

```sql
-- Usuários e Autenticação
users (id, email, password_hash, name, avatar_url, created_at, updated_at)
sessions (id, user_id, token_hash, expires_at, created_at)

-- Projetos
projects (id, name, description, owner_id, settings_json, created_at, updated_at, deleted_at)
project_members (project_id, user_id, role, joined_at)

-- Datasets
datasets (id, project_id, name, filename, mime_type, size_bytes, rows, columns, schema_json, statistics_json, storage_path, uploaded_by, created_at)

-- Experimentos
experiments (id, project_id, name, description, task_type, status, config_json, created_by, created_at, updated_at, completed_at)
experiment_runs (id, experiment_id, run_number, status, parameters_json, metrics_json, artifacts_json, started_at, completed_at, error_message)

-- Modelos Registrados
registered_models (id, project_id, name, version, experiment_run_id, model_type, framework, storage_path, metadata_json, registered_by, registered_at)

-- Previsões (para serving)
predictions (id, model_id, input_hash, input_json, output_json, latency_ms, created_at)
```

### Índices Estratégicos

```sql
-- Performance para queries comuns
CREATE INDEX idx_datasets_project ON datasets(project_id, created_at DESC);
CREATE INDEX idx_experiments_project ON experiments(project_id, created_at DESC);
CREATE INDEX idx_runs_experiment ON experiment_runs(experiment_id, run_number);
CREATE INDEX idx_models_project ON registered_models(project_id, name, version);
CREATE INDEX idx_predictions_model ON predictions(model_id, created_at DESC);
```

### Políticas de Acesso (Row Level Security - Supabase)

```sql
-- Usuários veem apenas projetos dos quais são membros
CREATE POLICY project_access ON projects
  USING (id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Datasets herdados do projeto
CREATE POLICY dataset_access ON datasets
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
```

---

## 4. Decisões Técnicas Documentadas

### ADR 001 — Monorepo com npm Workspaces
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: Necessidade de compartilhar tipos entre frontend e backend, scripts unificados.
**Decisão**: Usar `npm workspaces` nativo (sem Turbo, Nx, ou Lerna na Fase 1).
**Consequências**: 
- ✅ Zero configuração extra, nativo do npm 7+
- ✅ `packages/shared` linkado automaticamente
- ⚠️ Build paralela limitada (resolvido com `concurrently`)

### ADR 002 — TypeScript Strict em Todo Lugar
**Data**: 2026-10-14
**Status**: Aceito
**Decisão**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` em todos os `tsconfig.json`.
**Consequências**: 
- ✅ Erros de tipo capturados em compile-time
- ✅ Refatoração segura
- ⚠️ Curva de aprendizado maior para contributors junior

### ADR 003 — Zod para Validação (Runtime + Compile-time)
**Data**: 2026-10-14
**Status**: Aceito
**Decisão**: Zod schemas como fonte única da verdade; inferir tipos TypeScript com `z.infer<typeof schema>`.
**Consequências**:
- ✅ Validação consistente frontend/backend
- ✅ Documentação viva dos contratos
- ✅ Error messages estruturados

### ADR 004 — Sem ORM (SQL Explícito + pg)
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: Controle total sobre queries, migrações versionadas, performance previsível.
**Decisão**: Usar `pg` driver diretamente; migrações SQL em `database/migrations/`.
**Consequências**:
- ✅ Zero overhead, SQL otimizado manualmente
- ✅ Migrações revisáveis em code review
- ⚠️ Mais boilerplate para CRUD simples (mitigado com query builders leves futuros)

### ADR 005 — Next.js App Router (não Pages Router)
**Data**: 2026-10-14
**Status**: Aceito
**Decisão**: App Router com Server Components por padrão.
**Consequências**:
- ✅ RSC, streaming, layouts aninhados
- ✅ Fetch nativo com cache control
- ⚠️ Client Components precisam de `'use client'` explícito

### ADR 006 — Tailwind CSS com Tema Escuro Padrão
**Data**: 2026-10-14
**Status**: Aceito
**Decisão**: `darkMode: 'class'` no Tailwind; tema escuro forçado via `<html class="dark">` no layout raiz.
**Consequências**:
- ✅ Consistência visual, design system coeso
- ✅ Tamanho de bundle pequeno (purge automático)
- ⚠️ Curva de aprendizado para desenvolvedores não familiarizados

### ADR 007 — Variáveis de Ambiente: Pública vs Privada
**Data**: 2026-10-14
**Status**: Aceito
**Decisão**: 
- Backend: `.env` na raiz (validado com Zod no bootstrap)
- Frontend: `.env.local` em `apps/web/` apenas com `NEXT_PUBLIC_*`
**Consequências**:
- ✅ Segredos nunca vazam para o bundle do cliente
- ✅ Validação early-fail no backend
- ✅ Type-safety via `packages/shared/ValidatedEnv`

### ADR 008 — Health Checks Dual (Liveness + Readiness)
**Data**: 2026-10-14
**Status**: Aceito
**Decisão**: 
- `GET /health` — Liveness (processo vivo)
- `GET /health/ready` — Readiness (dependências OK)
**Consequências**:
- ✅ Kubernetes/Render podem distinguir restart vs drain
- ✅ Deploy zero-downtime suportado

### ADR 009 — Datasets: Metadados no Postgres, Arquivo no Storage (Fase 3)
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: CSVs podem ter MBs; guardar conteúdo em JSONB estouraria memória e invalidaria o uso do Postgres.
**Decisão**: Tabela `datasets` guarda apenas metadados + `schema_json` (tipos por coluna); o arquivo original vai para
`StorageProvider` (local `./uploads` em dev, bucket privado Supabase em produção). Preview/profile releem o arquivo
e recalculam — sem cache para invalidar nesta fase.
**Consequências**:
- ✅ Banco leve; RLS por projeto via `EXISTS`
- ✅ Troca de provider sem mudar controllers (interface `upload/download/delete`)
- ⚠️ Profile recalcula a cada request (aceitável até ~10 MB; documentado para virar job assíncrono na Fase 4)

### ADR 010 — CSV com PapaParse no Node, Sem Python/Julia (Fase 3)
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: Parsing de CSV não justifica um serviço novo; Python/Julia entram na Fase 4 para ML/estatística avançada.
**Decisão**: PapaParse no backend com limites rígidos (10 MB, 500 cols, 1M linhas, campo 10k). Processamento síncrono.
**Consequências**:
- ✅ Zero infra nova; comportamento determinístico e testável
- ⚠️ Uploads grandes precisam de fila na Fase 4 (documentado)

### ADR 011 — Auth: 401 Antes de Config-Check (Fase 3)
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: O middleware validava a configuração do Supabase antes do token; sem env, faltas de token retornavam 500.
**Decisão**: Verificar presença do token `Bearer` primeiro (401 `NO_TOKEN`), depois a configuração.
**Consequências**:
- ✅ Semântica HTTP correta independente do ambiente
- ✅ Nenhum teste existente quebrou

### ADR 012 — ML como Serviço Python Interno, Node como Gateway (Fase 4)
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: Treinamento exige scikit-learn; o frontend nunca deve ver credenciais internas.
**Decisão**: FastAPI em `services/ml-python` acessível só via `X-ML-Service-Key`; Node valida auth do usuário,
propriedade do projeto/dataset, carrega o CSV do storage e envia linhas inline ao Python. Execução síncrona
dentro de `ML_TIMEOUT_MS` (padrão 120s); estados `pending→running→completed|failed` + linha em `model_runs`
persistidos em toda transição, inclusive falha.
**Consequências**:
- ✅ Superfície pública única (Node); Python sem acesso a FS/DB/caminhos de usuário
- ✅ Falhas parciais deixam estado consultável (run `failed` + mensagem segura)
- ⚠️ Datasets grandes precisam de fila na Fase 5 (limite 200k linhas no Python)

### ADR 013 — Sem Artefatos de Modelo na Fase 4
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: Desserializar pickle/joblib de origem arbitrária executa código; registro de artefatos exige versionamento.
**Decisão**: Persistir só métricas + amostra de ≤20 previsões; retreino determinístico via `random_state`.
Documentado como limitação para a Fase 5.
**Consequências**:
- ✅ Sem risco de desserialização; banco leve
- ⚠️ Sem reutilização do objeto treinado (inferência em produção fica para a Fase 5)

### ADR 014 — Julia como Motor Estatístico Independente, Comparação no Node (Fase 5)
**Data**: 2026-10-14
**Status**: Aceito
**Contexto**: A comparação Python × Julia exige dois cálculos independentes sobre os mesmos dados; o serviço
Julia não deve chamar o Python (acoplamento reverso) nem receber credenciais alheias.
**Decisão**: Julia expõe primitivas (`describe`/`correlation`/`covariance`/`linear-algebra`) com contratos
JSON estritos; o Node orquestra: carrega o dataset autorizado, chama Julia e Python em paralelo e difere
com tolerâncias abs 1e-9 / rel 1e-6. Não há endpoint `/v1/compare` no Julia — a comparação vive no Node,
onde residem auth, propriedade e persistência (`analysis_runs`).
**Consequências**:
- ✅ Cada motor calcula de forma independente; divergências viram flags investigáveis, não erros silenciosos
- ✅ Estatística descritiva adicionada ao Python é mínima e só serve à comparação (sem novo escopo de ML)
- ⚠️ Benchmark incluso é latência round-trip (HTTP + cálculo), documentado como não-isolado

---

## 5. Padrões de Código

### Estrutura de Resposta API (packages/shared)

```typescript
// Sucesso
{ success: true, data: T, meta: { timestamp, requestId, version } }

// Erro
{ success: false, error: { code, message, details }, meta: { ... } }
```

### Error Handling (API)

```typescript
// Erros operacionais (4xx) - esperados, log level warn
throw AppError.badRequest('VALIDATION_ERROR', 'Dados inválidos', { field: 'email' });

// Erros de programação (5xx) - bugs, log level error, não expostos ao cliente
throw AppError.internal('DB_CONNECTION_FAILED', 'Falha ao conectar');
```

### Logging Estruturado

```typescript
logger.info('User created', { userId: '123', email: 'user@example.com' });
logger.warn('Rate limit approached', { ip: '192.168.1.1', remaining: 5 });
logger.error('Payment failed', { orderId: '456' }, error); // error.stack incluído
```

---

## 6. Fluxos Principais (Fase 2+)

### Upload de Dataset

```
1. Frontend: Drag & drop CSV → PapaParse (worker) → Preview + Schema inferido
2. Frontend: POST /api/v1/projects/:id/datasets { name, schema, preview }
3. API: Valida Zod → Salva metadados no Postgres → Upload file para storage (S3/Supabase)
4. API: Dispara job assíncrono (Redis) → Workers Python/Julia computam estatísticas completas
5. API: Atualiza dataset com statistics_json → WebSocket/Server-Sent Events notifica frontend
6. Frontend: Atualiza UI com profiling completo
```

### Treinamento de Modelo

```
1. Frontend: Formulário de experimento → POST /api/v1/experiments
2. API: Cria experiment + run (status: pending) → Responde com runId
3. API: Enfileira job no Redis (BullMQ) → Worker Python consome
4. Worker: Baixa dataset → Treina modelo → Salva artefatos (S3) → Métricas no Postgres
5. Worker: Atualiza run status → completed/failed
6. Frontend: Polling/SSE mostra progresso → Métricas em tempo real
```

---

## 7. Configuração por Ambiente

| Variável | Development | Staging | Production |
|----------|-------------|---------|------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` | `warn` |
| `CORS_ORIGIN` | `http://localhost:3000` | `https://staging.nexusai.app` | `https://nexusai.app` |
| `DATABASE_URL` | Local/Dev DB | Staging DB | Prod DB (pooler) |
| `JWT_SECRET` | Dev secret | Rotated secret | HSM/Vault secret |
| `RATE_LIMIT` | Disabled | 100/min | 60/min |

---

## 8. Observabilidade (Futuro)

### Métricas Prometheus (expor em `/metrics`)
- `http_requests_total{method, path, status}`
- `http_request_duration_seconds{method, path}`
- `db_query_duration_seconds{query_type}`
- `ml_job_duration_seconds{task_type}`
- `active_experiments_gauge`

### Distributed Tracing (OpenTelemetry)
- Trace ID propagado via `x-request-id` header
- Spans: HTTP request → DB query → External service call

### Alertas Críticos
- API latency p99 > 2s
- Error rate > 1%
- DB connection pool exhausted
- ML job queue depth > 100

---

## 9. Referências

- [Next.js 14 App Router Docs](https://nextjs.org/docs/app)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Zod Documentation](https://zod.dev/)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [npm Workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Architecture](https://supabase.com/docs/guides/architecture)

---

*Documento vivo — atualize a cada decisão arquitetural significativa.*