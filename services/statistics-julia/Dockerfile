# NexusAI Statistics Julia Service — Multi-stage Dockerfile
# Build: docker build -t nexusai-stats ./services/statistics-julia
# Run:   docker run -p 8001:8001 --env-file .env nexusai-stats

# ============================================
# Base stage — Julia with precompilation
# ============================================
FROM julia:1.12-bookworm AS base

ENV JULIA_PKG_PRECOMPILE_AUTO=0 \
    JULIA_DEPOT_PATH=/srv/stats/.julia

WORKDIR /srv/stats

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Dependencies stage — precompile packages
# ============================================
FROM base AS deps

COPY Project.toml Manifest.toml ./
RUN julia --project=. -e 'using Pkg; Pkg.instantiate(); Pkg.precompile()'

# ============================================
# Runner stage
# ============================================
FROM base AS runner

COPY --from=deps /srv/stats/.julia /srv/stats/.julia
COPY src ./src

# Create non-root user
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid 1001 --shell /sbin/nologin appuser && \
    chown -R appuser:appgroup /srv/stats

USER appuser

# Render and most hosts inject PORT; default matches local dev.
ENV PORT=8001
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD julia -e 'import Downloads; Downloads.download("http://127.0.0.1:" * get(ENV, "PORT", "8001") * "/health")' || exit 1

CMD ["julia", "--project=.", "src/server.jl"]
