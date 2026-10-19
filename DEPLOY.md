# 🚀 Guia de Deploy — NexusAI

Este documento explica como fazer deploy do NexusAI no **Render** (recomendado) e em outras plataformas.

---

## 📋 Visão geral da arquitetura

O NexusAI é um monorepo com 5 serviços que precisam rodar em separado:

| Serviço | Porta | Tipo | Descrição |
|---------|-------|------|-----------|
| **Frontend** | 3000 | Web Service | TanStack Start (React + Vite) — `apps/web` |
| **API Backend** | 3001 | Web Service | Express + TypeScript — `apps/api` |
| **Worker** | — | Background Worker | BullMQ + Redis — `apps/api` (comando diferente) |
| **ML Python** | 8000 | Web Service | FastAPI — `services/ml-python` |
| **Statistics Julia** | 8001 | Web Service | HTTP.jl — `services/statistics-julia` |
| **Redis** | 6379 | Gerenciado | Render Key Value / Upstash / Railway |
| **PostgreSQL** | 5432 | Gerenciado | Supabase ou Render PostgreSQL |

> ⚠️ **Importante:** Serviços no Render **não compartilham `localhost`**. Use URLs internas (ex: `nexusai-api.onrender.com`) ou URLs públicas para comunicação entre serviços.

---

## 🔧 Pré-requisitos

1. Conta no [Render](https://render.com)
2. Conta no [Supabase](https://supabase.com) (banco + auth)
3. Conta no [GitHub](https://github.com) (repositório conectado ao Render)
4. Código do NexusAI pushado no GitHub

---

## 1️⃣ Banco de dados (Supabase)

### Criar projeto
1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Anote:
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
3. Vá em **Settings > Database > Connection string**
   - Escolha **Transaction pooler** (porta 6543)
   - Substitua `[YOUR-PASSWORD]` pela senha do banco
   - Cole em `DATABASE_URL`

### Configurar Auth
No painel do Supabase > **Authentication > Providers**:
1. Ative **Email**
2. Em **URL Configuration**:
   - Site URL: `https://nexusai-web.onrender.com`
   - Redirect URLs: `https://nexusai-web.onrender.com/auth/reset-password`

### Configurar Storage (para upload de CSV)
1. Vá em **Storage > New bucket**
2. Nome: `datasets`
3. Tipo: **Privado** (sem acesso público)
4. O backend usa `service_role` para acessar (nunca exposto ao frontend)

### Aplicar migrações
Após criar o banco, rode as migrações:
```bash
npm run db:migrate up --workspace=apps/api
```
(ou via terminal do Render no serviço da API)

---

## 2️⃣ Redis (fila de jobs)

Opcional: se não quiser jobs assíncronos, pule esta etapa (jobs retornarão 503).

No Render:
1. Crie um **Redis** (Render Key Value, Upstash ou Railway)
2. Anote a URL: `redis://default:senha@host:port`
3. Defina como `REDIS_URL` nas variáveis de ambiente da API e do Worker

---

## 3️⃣ Deploy no Render (passo a passo)

### 3.1 Conectar o repositório
1. No Render Dashboard, clique em **New > Blueprint**
2. Conecte seu GitHub e selecione o repositório do NexusAI
3. O Render detectará o `render.yaml` na raiz

### 3.2 Serviços criados automaticamente pelo `render.yaml`

O `render.yaml` já cria:
- **nexusai-api** — Web Service (Dockerfile em `apps/api/Dockerfile`)
- **nexusai-worker** — Background Worker (mesmo Dockerfile, comando diferente)
- **nexusai-ml** — Web Service (Dockerfile em `services/ml-python/Dockerfile`)
- **nexusai-stats** — Web Service (Dockerfile em `services/statistics-julia/Dockerfile`)
- **nexusai-web** — Web Service (Dockerfile em `apps/web/Dockerfile`)

### 3.3 Configurar variáveis de ambiente (SECRETOS)

No Render Dashboard, para **cada serviço**, defina as variáveis marcadas como `sync: false` (segredos):

#### API (`nexusai-api`)
```
NODE_ENV=production
PORT=3001
API_VERSION=v1
CORS_ORIGIN=https://nexusai-web.onrender.com
DATABASE_URL=postgresql://... (Transaction pooler)
SUPABASE_URL=https://SEU_REF.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
STORAGE_DRIVER=supabase
STORAGE_BUCKET=datasets
MAX_UPLOAD_MB=10
ML_SERVICE_URL=https://nexusai-ml.onrender.com
ML_SERVICE_KEY=uma_chave_secreta_qualquer
ML_TIMEOUT_MS=120000
JULIA_SERVICE_URL=https://nexusai-stats.onrender.com
JULIA_SERVICE_KEY=uma_chave_secreta_qualquer
JULIA_TIMEOUT_MS=60000
REDIS_URL=redis://... (do seu Redis)
WORKER_CONCURRENCY=2
JOB_MAX_ATTEMPTS=3
JOB_BACKOFF_MS=5000
```

#### Worker (`nexusai-worker`)
Mesmas variáveis da API acima.

#### ML Python (`nexusai-ml`)
```
PORT=8000
LOG_LEVEL=info
ML_SERVICE_KEY=uma_chave_secreta_qualquer (mesma da API)
MAX_TRAIN_ROWS=200000
MAX_TRAIN_COLUMNS=200
MAX_FEATURES=100
```

#### Statistics Julia (`nexusai-stats`)
```
PORT=8001
JULIA_SERVICE_KEY=uma_chave_secreta_qualquer (mesma da API)
```

#### Web Frontend (`nexusai-web`)
```
VITE_API_URL=https://nexusai-api.onrender.com
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

> 🔑 **ML_SERVICE_KEY** e **JULIA_SERVICE_KEY** devem ser iguais entre a API e os respectivos serviços.

### 3.4 Ordem de deploy

Render sobe em ordem de dependência. Recomendado:
1. ML Python (`nexusai-ml`)
2. Statistics Julia (`nexusai-stats`)
3. API (`nexusai-api`)
4. Worker (`nexusai-worker`)
5. Web Frontend (`nexusai-web`)

### 3.5 Health checks

| Serviço | Caminho |
|---------|---------|
| API | `/api/v1/health` |
| ML | `/health` |
| Julia | `/health` |
| Web | `/` |

---

## 4️⃣ Deploy alternativo: Docker Compose (qualquer servidor)

Se preferir rodar em seu próprio servidor (VPS, Docker, etc.):

```bash
# 1. Clone o repositório
git clone <seu-repo>
cd nexusai

# 2. Configure variáveis
cp .env.example .env
cp apps/web/.env.example apps/web/.env
# Edite ambos com seus valores reais

# 3. Suba Redis
docker run -d -p 6379:6379 --name nexusai-redis redis:7-alpine

# 4. Instale dependências
npm install

# 5. Aplique migrações
npm run db:migrate up --workspace=apps/api

# 6. Suba os serviços (terminais separados ou Docker Compose)
npm run dev --workspace=apps/api      # API :3001
npm run worker --workspace=apps/api   # Worker
npm run dev --workspace=apps/web      # Front :3000
```

Ou use Docker Compose (criar `docker-compose.yml` na raiz se necessário).

---

## 5️⃣ Deploy alternativo: plataformas específicas

### Railway
1. Conecte o GitHub no Railway
2. Crie serviços separados para cada pasta (`apps/api`, `apps/web`, etc.)
3. Defina variáveis de ambiente em cada serviço
4. Adicione PostgreSQL e Redis como serviços do Railway

### Fly.io
1. `fly launch` na raiz
2. Crie apps separados: `nexusai-api`, `nexusai-web`, `nexusai-ml`, `nexusai-stats`
3. Defina secrets com `fly secrets set`

### Docker manual (qualquer VPS)
Cada serviço tem seu próprio `Dockerfile`. Build e rode individualmente.

---

## 6️⃣ Variáveis de ambiente resumidas

### Backend (`.env` / Render)
| Variável | Obrigatória | Exemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Sim | `postgresql://...:6543/postgres` |
| `SUPABASE_URL` | Sim | `https://ref.supabase.co` |
| `SUPABASE_ANON_KEY` | Sim | `...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | `...` |
| `CORS_ORIGIN` | Sim | `https://nexusai-web.onrender.com` |
| `REDIS_URL` | Para jobs | `redis://...` |
| `ML_SERVICE_URL` | Para ML | `https://nexusai-ml.onrender.com` |
| `ML_SERVICE_KEY` | Para ML | `segredo_qualquer` |
| `JULIA_SERVICE_URL` | Para Julia | `https://nexusai-stats.onrender.com` |
| `JULIA_SERVICE_KEY` | Para Julia | `segredo_qualquer` |

### Frontend (`apps/web/.env`)
| Variável | Obrigatória | Exemplo |
|----------|-------------|---------|
| `VITE_API_URL` | Sim | `https://nexusai-api.onrender.com` |
| `VITE_SUPABASE_URL` | Sim | `https://ref.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Sim | `...` |

---

## 7️⃣ Checklist pós-deploy

- [ ] Banco migrado (`npm run db:migrate up`)
- [ ] Auth do Supabase configurado (Email + redirect URLs)
- [ ] Bucket `datasets` criado (privado)
- [ ] Redis rodando (para jobs)
- [ ] ML Python respondendo `/health`
- [ ] Julia respondendo `/health`
- [ ] API respondendo `/api/v1/health`
- [ ] Frontend carregando em `https://nexusai-web.onrender.com`
- [ ] Login/cadastro funcionando
- [ ] Upload de CSV funcionando
- [ ] Jobs assíncronos funcionando

---

## 8️⃣ Estrutura final do repositório

```
nexusai/
├── apps/
│   ├── api/          # Express + TypeScript (porta 3001)
│   └── web/          # TanStack Start (porta 3000)
├── packages/
│   └── shared/       # Tipos TypeScript compartilhados
├── services/
│   ├── ml-python/    # FastAPI (porta 8000)
│   └── statistics-julia/  # Julia (porta 8001)
├── database/
│   └── migrations/   # SQL versionados
├── supabase/         # Config do Supabase (local)
├── render.yaml       # Blueprint do Render
├── .env              # Variáveis locais (não commitar)
└── DEPLOY.md         # Este arquivo
```

---

## 🆘 Problemas comuns no deploy

| Problema | Solução |
|----------|---------|
| CORS error | Confira `CORS_ORIGIN` = URL do frontend no Render |
| Jobs ficam em `queued` | Verifique `REDIS_URL` e se o Worker está rodando |
| ML/Julia 503 | Confira `ML_SERVICE_KEY`/`JULIA_SERVICE_KEY` iguais em ambos os lados |
| Upload falha | Confirme bucket `datasets` como privado e `STORAGE_DRIVER=supabase` |
| 401 nas APIs | Verifique `SUPABASE_URL` e `SUPABASE_ANON_KEY` |
| Build falha | Rode `npm install` e `npm run build` localmente primeiro |

---

**Suporte:** Se algo quebrar, verifique os logs de cada serviço no Render Dashboard e os endpoints de `/health`.