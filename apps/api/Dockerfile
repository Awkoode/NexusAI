# NexusAI API — Multi-stage Dockerfile for production
# Build from REPO ROOT: docker build -t nexusai-api -f apps/api/Dockerfile .
# Run:   docker run -p 3001:3001 --env-file .env nexusai-api

# ============================================
# Base stage — shared dependencies
# ============================================
FROM node:22-bookworm-slim AS base

ENV NODE_ENV=production

WORKDIR /srv/api

# ============================================
# Dependencies stage — install only prod deps
# ============================================
FROM base AS deps

# Copy root package files and workspace packages
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies
RUN npm ci --workspaces --filter @nexusai/api --filter @nexusai/shared --omit=dev

# ============================================
# Build stage — compile TypeScript
# ============================================
FROM base AS builder

# Install TypeScript globally for build
RUN npm install -g typescript

# Copy root package files and workspace packages
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all deps (including dev) for build
RUN npm ci --workspaces --filter @nexusai/api --filter @nexusai/shared

# Install required types locally for TypeScript compilation
RUN npm install @types/pg @types/cors @types/node

# Copy source code
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json

# Build the shared package first, then the API
RUN tsc --project apps/api/tsconfig.json && tsc --project packages/shared/tsconfig.json

# ============================================
# Runner stage — minimal production image
# ============================================
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production

WORKDIR /srv/api

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid 1001 --shell /sbin/nologin nextjs

# Copy built artifacts and production node_modules
COPY --from=deps /srv/api/node_modules ./node_modules
COPY --from=builder /srv/api/apps/api/dist ./dist
COPY --from=builder /srv/api/packages/shared/dist ./node_modules/@nexusai/shared

# Copy package.json for metadata
COPY --from=builder /srv/api/apps/api/package.json ./package.json

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /srv/api

USER nextjs

EXPOSE 3001

# Health check for Render/container orchestration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# Start the API server
CMD ["node", "dist/index.js"]