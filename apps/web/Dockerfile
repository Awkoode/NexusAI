# NexusAI Web — Multi-stage Dockerfile for production (Next.js standalone output)
# Build from REPO ROOT: docker build -t nexusai-web -f apps/web/Dockerfile .
# Run:   docker run -p 3000:3000 --env-file .env.local nexusai-web

# ============================================
# Base stage
# ============================================
FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /srv/web

# ============================================
# Build stage — install deps, build shared + web
# ============================================
FROM base AS builder

# Install TypeScript globally for shared package build
RUN npm install -g typescript

# Install ALL dependencies (including dev) for all workspaces
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspaces

# Copy source code
COPY apps/web/ ./apps/web/
COPY packages/shared/ ./packages/shared/
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json

# Build shared package first
RUN tsc --project packages/shared/tsconfig.json

# Install web app dependencies locally (for tailwindcss, path aliases)
WORKDIR /srv/web/apps/web
RUN npm install --workspace=@nexusai/web

# Build web app
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

# ============================================
# Production dependencies stage
# ============================================
FROM base AS prod-deps

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspaces --filter @nexusai/web --filter @nexusai/shared --omit=dev

# ============================================
# Runner stage — minimal production image
# ============================================
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /srv/web

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 --shell /sbin/nologin nextjs

# Copy production node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /srv/web/node_modules ./node_modules

# Copy standalone output from builder
COPY --from=builder --chown=nextjs:nodejs /srv/web/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /srv/web/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /srv/web/apps/web/public ./public

# Copy shared package
COPY --from=builder --chown=nextjs:nodejs /srv/web/packages/shared/dist ./node_modules/@nexusai/shared

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]