# NexusAI - Guia de Execução Local

## 📋 Pré-requisitos

| Ferramenta | Versão Mínima | Verificar |
|------------|---------------|-----------|
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |
| Supabase CLI (opcional) | - | `supabase --version` |
| Python | 3.12+ | `python --version` |
| Julia | 1.12+ | `julia --version` |

---

## 1️⃣ Configurar Supabase (Obrigatório)

### Opção A: Supabase Cloud (Recomendado para começar)
1. Acesse [supabase.com](https://supabase.com) e crie conta/projeto
2. No Dashboard do projeto, vá em **Settings > API**
3. Copie:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` (frontend)
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`
4. Vá em **Settings > Database** → **Connection string** (URI)
   - Use a string "Transaction pooler" (porta 6543)
   - Substitua `[YOUR-PASSWORD]` pela senha do banco
   - Cole em `DATABASE_URL`

### Opção B: Supabase Local (Docker)
```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar stack local
supabase start

# As credenciais serão mostradas no output
# DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 2️⃣ Editar Arquivos .env

### Backend (.env na raiz)
```bash
# Edite este arquivo com suas credenciais reais:
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.SEU_REF.supabase.co:6543/postgres
SUPABASE_URL=https://SEU_REF.supabase.co
SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

### Frontend (apps/web/.env)
```bash
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```
O frontend atual é o TanStack Start em `apps/web` (porta 3000, mesma do `CORS_ORIGIN` do backend).

### ML Python (services/ml-python/.env)
```bash
# Já configurado para local com chave padrão
ML_SERVICE_KEY=dev-ml-service-key
```

### Statistics Julia (services/statistics-julia/.env)
```bash
# Já configurado para local com chave padrão
JULIA_SERVICE_KEY=dev-julia-service-key
```

> **Importante**: As chaves `ML_SERVICE_KEY` e `JULIA_SERVICE_KEY` devem ser **idênticas** entre o backend (.env) e os respectivos serviços.

---

## 3️⃣ Subir Redis (Obrigatório para Jobs)

```bash
# Opção 1: Docker (recomendado)
docker run -d -p 6379:6379 --name nexusai-redis redis:7-alpine

# Opção 2: Redis local instalado
redis-server --port 6379
```

Verificar: `docker logs nexusai-redis` ou `redis-cli ping` (deve retornar PONG)

---

## 4️⃣ Aplicar Migrações do Banco

```bash
# Na raiz do projeto
npm run db:migrate up
```

Isso criará as tabelas: `profiles`, `projects`, `datasets`, `experiments`, `model_runs`, `analysis_runs`, `jobs`, `schema_migrations`

---

## 5️⃣ Instalar Dependências

```bash
# Na raiz - instala tudo (workspaces)
npm install

# Ou separadamente:
npm install --workspace=apps/api
npm install --workspace=apps/web
npm install --workspace=packages/shared
```

---

## 6️⃣ Executar Serviços (Terminais Separados)

### Terminal 1 - API Backend
```bash
npm run dev --workspace=apps/api
# Roda em http://localhost:3001
# Health: http://localhost:3001/api/v1/health
```

### Terminal 2 - Worker (Jobs Assíncronos)
```bash
npm run worker --workspace=apps/api
# Conecta no Redis e processa fila
```

### Terminal 3 - Frontend (novo, TanStack Start em apps/web)
```bash
npm run dev --workspace=apps/web
# Roda em http://localhost:3000 (porta fixa no script dev)
```

### Terminal 4 - ML Python (Opcional - para treinamento)
```bash
cd services/ml-python
python -m venv .venv
.venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Roda em http://localhost:8000
# Health: http://localhost:8000/health
```

### Terminal 5 - Statistics Julia (Opcional - para análises)
```bash
cd services/statistics-julia
julia --project=. setup_deps.jl  # Primeira vez apenas
julia --project=. src/server.jl
# Roda em http://localhost:8001
# Health: http://localhost:8001/health
```

---

## 7️⃣ Configurar Auth no Supabase

No painel do Supabase > **Authentication > Providers**:
1. Ative **Email**
2. Em **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/reset-password`

---

## 8️⃣ Testar Tudo

1. Acesse **http://localhost:3000** → Landing page
2. Clique **Cadastre-se** → Crie conta
3. Após login → **Dashboard** com métricas reais
4. **Projetos** → Criar projeto
5. **Dataset** → Upload CSV → Ver estatísticas/gráficos
6. **Análises** → Rodar describe/correlação (sync ou background)
7. **Experimentos** → Criar regressão/classificação → Treinar
8. **Jobs** → Ver histórico em `/jobs`

---

## 🔧 Comandos Úteis

```bash
# Ver logs da API
npm run dev --workspace=apps/api 2>&1 | head -50

# Rodar testes
npm run test

# Lint + Typecheck
npm run lint && npm run typecheck

# Build produção
npm run build

# Migrações
npm run db:migrate up      # Aplicar
npm run db:migrate down    # Rollback (nome da migração)

# Parar Redis
docker stop nexusai-redis && docker rm nexusai-redis

# Reset banco local (Supabase CLI)
supabase db reset
```

---

## ⚠️ Problemas Comuns

| Problema | Solução |
|----------|---------|
| `DATABASE_URL` inválida | Verifique senha, host, porta no Supabase |
| `SUPABASE_URL` erro 401 | Confira se copiou a URL correta (não a de API) |
| Jobs ficam em `queued` | Worker não está rodando ou Redis não acessível |
| ML service 503 | Serviço Python não subiu ou `ML_SERVICE_KEY` diferente |
| Julia service 503 | Serviço Julia não subiu ou `JULIA_SERVICE_KEY` diferente |
| CORS error | `CORS_ORIGIN=http://localhost:3000` no .env do backend |
| Migration falha | `DATABASE_URL` deve apontar para banco vazio ou existente |

---

## 📁 Estrutura de Portas Locais

| Serviço | Porta | Health Check |
|---------|-------|--------------|
| Frontend (Next.js) | 3000 | http://localhost:3000 |
| API (Express) | 3001 | http://localhost:3001/api/v1/health |
| Redis | 6379 | `redis-cli ping` |
| ML Python | 8000 | http://localhost:8000/health |
| Statistics Julia | 8001 | http://localhost:8001/health |

---

## 🚀 Tudo Pronto!

Após configurar, você terá:
- ✅ Dashboard com métricas reais
- ✅ Upload/Análise de CSV
- ✅ Treinamento ML (regressão/classificação)
- ✅ Análises estatísticas (Julia)
- ✅ Jobs assíncronos com Redis/BullMQ
- ✅ Histórico de execuções em `/jobs`