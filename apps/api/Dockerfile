
# NexusAI API — Multi-stage Dockerfile
# Build from repository root:
# docker build -t nexusai-api -f apps/api/Dockerfile .

FROM node:22-bookworm-slim AS base

WORKDIR /srv/api

# ============================================
# Dependencies — production only
# ============================================
FROM base AS deps

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci \
    --workspace=apps/api \
    --workspace=packages/shared \
    --include-workspace-root \
    --omit=dev

# ============================================
# Builder — development dependencies included
# ============================================
FROM base AS builder

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci \
    --workspace=apps/api \
    --workspace=packages/shared \
    --include-workspace-root \
    --include=dev

COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Build dependency first, then API
RUN npm run build --workspace=packages/shared \
    && npm run build --workspace=apps/api

# ============================================
# Runner — production
# ============================================
FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /srv/api

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid 1001 --shell /sbin/nologin nextjs

COPY --from=deps /srv/api/node_modules ./node_modules
COPY --from=builder /srv/api/apps/api/dist ./dist
COPY --from=builder /srv/api/apps/api/package.json ./package.json
COPY --from=builder /srv/api/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /srv/api/packages/shared/dist ./packages/shared/dist

RUN chown -R nextjs:nodejs /srv/api

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
