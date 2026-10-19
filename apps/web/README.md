# NexusAI Web

Frontend da plataforma NexusAI — TanStack Start (React 19 + Vite), React Query, Tailwind CSS v4 + shadcn-ui, Supabase Auth.

Fala com o backend em `VITE_API_URL` (default `http://localhost:3001`, prefixo `/api/v1`). Nunca chama os microserviços (ML :8000, Julia :8001) diretamente.

## Desenvolvimento

```sh
cd apps/web
npm run dev        # http://localhost:3000 (porta fixa, bate com o CORS do backend)
```

## Variáveis (`apps/web/.env`, ver `.env.example`)

```sh
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

## Scripts

```sh
npm run dev        # dev (porta 3000)
npm run build      # build produção (.output/ via Nitro)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest
```

## Rotas

`/` (landing ou dashboard) · `/auth/login|signup|forgot-password|reset-password` · `/projects` · `/projects/$projectId` · `/projects/$projectId/datasets/$datasetId` · `/projects/$projectId/experiments/$experimentId` · `/jobs`
