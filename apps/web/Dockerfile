# NexusAI Web — Dockerfile produção (TanStack Start / Nitro)
# Build da RAIZ: docker build -t nexusai-web -f apps/web/Dockerfile .
# Run: docker run -p 3000:3000 -e VITE_API_URL=http://localhost:3001 nexusai-web

FROM node:22-bookworm-slim AS builder
WORKDIR /srv/web
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=@nexusai/web
COPY apps/web/ ./apps/web/
ARG VITE_API_URL=http://localhost:3001
ARG VITE_SUPABASE_URL=https://dummy.supabase.co
ARG VITE_SUPABASE_ANON_KEY=dummy-key
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
WORKDIR /srv/web/apps/web
RUN npm run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /srv/web
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 --shell /sbin/nologin appuser
COPY --from=builder --chown=appuser:nodejs /srv/web/apps/web/.output ./.output
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
