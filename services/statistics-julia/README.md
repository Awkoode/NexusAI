# NexusAI Statistics Engine (Julia)

Independent statistical computation service. **Only the Node.js API calls this service**
(via the `X-Julia-Service-Key` header); the frontend never talks to it directly.

## Stack

- Julia **1.12.0** (pinned via `juliaup`; Docker base `julia:1.12-bookworm`)
- `HTTP.jl` + `JSON3.jl` (see `Project.toml` / `Manifest.toml`, reproducible)
- `Statistics`, `LinearAlgebra`, `Test` from the Julia standard library
- No ML libraries: this service does statistics and numerical validation only

## Run locally

```powershell
# one-time setup (resolves UUIDs, writes Manifest.toml)
julia --project=. setup_deps.jl

# start the server
$env:JULIA_SERVICE_KEY = "dev-julia-service-key"
$env:PORT = "8001"
julia --project=. src/server.jl
```

Health check: `GET http://127.0.0.1:8001/health` (reports Julia version).

Tests: `julia --project=. test/runtests.jl` (69 tests).

## API (internal)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | none | Liveness probe (+ Julia version) |
| `POST` | `/v1/statistics/describe` | service key | Per-column descriptive stats |
| `POST` | `/v1/statistics/correlation` | service key | Pearson matrix + per-pair n |
| `POST` | `/v1/statistics/covariance` | service key | Sample covariance matrix + per-pair n |
| `POST` | `/v1/linear-algebra/analyze` | service key | Rank, det, κ₂, SVD, eigenvalues |

Request contract (`describe`/`correlation`/`covariance`):

```json
{
  "columns": { "x": [1.0, 2.0, null, 4.0] },
  "options": { "missing_policy": "pairwise" }
}
```

- Missing values: JSON `null` only. Strings/booleans are rejected (422).
- Limits: ≤50 columns, ≤100k values/column, ≤1M values total, body ≤10 MB.
- Linear algebra: `{ "matrix": [[1.0, 2.0], [3.0, 4.0]] }`, max 200×200.

## Conventions (stable, tested)

- Variance/std are **sample** statistics (÷ n−1); single-observation columns return `null` + warning.
- Quantiles use **linear interpolation** (same method as NumPy `linear` and the Python service).
- `mean`/`median`/`min`/`max` over valid values only; empty columns return `null` + warning.
- Pearson `r` is `null` (never 0) when undefined: fewer than 2 pairs or zero variance.
  The diagonal is 1.0 only for columns with variation, else `null`.
- Covariance is **sample** (÷ n−1), matching the Python service.
- Missing policy: `pairwise` (default; per-pair n reported) or `listwise`.
- Non-finite results serialize as `null` — responses never contain `NaN`/`Infinity`.

## Linear algebra notes

- `rank`, 2-norm condition number κ₂ = σmax/σmin, top-20 singular values (truncation flagged).
- `determinant` only for square matrices; `eigenvalues` only for (approximately) symmetric
  matrices (`is_approx_symmetric`, tolerance 1e-10 scaled).
- No matrix inverse is offered: inverses of singular/ill-conditioned matrices are
  numerically meaningless. Rank-deficiency and κ₂ > 1e12 produce explicit warnings.

## Security

- Service key required on all `/v1/*` routes (401 otherwise).
- No filesystem/database access; no user paths; no `eval`/`include` of request data.
- Errors are sanitized (no tracebacks or paths); logs carry no dataset contents.
