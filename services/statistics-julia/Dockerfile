FROM julia:1.12-bookworm

ENV JULIA_PKG_PRECOMPILE_AUTO=0

WORKDIR /srv/stats

COPY Project.toml Manifest.toml ./
RUN julia --project=. -e 'using Pkg; Pkg.instantiate(); Pkg.precompile()'

COPY src ./src

# Render and most hosts inject PORT; default matches local dev.
ENV PORT=8001
EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD julia -e 'import Downloads; Downloads.download("http://127.0.0.1:" * get(ENV, "PORT", "8001") * "/health")' || exit 1

CMD ["julia", "--project=.", "src/server.jl"]
