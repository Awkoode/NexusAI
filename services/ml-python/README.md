# NexusAI ML Service (Python + FastAPI)

Internal machine-learning engine. **Only the Node.js API calls this service** (via `X-ML-Service-Key`);
the frontend never talks to it directly.

## Stack

- Python **3.14** (pinned Docker base `python:3.14-slim`; local dev uses the system Python 3.14)
- FastAPI + Uvicorn, Pydantic v2, pandas, NumPy, scikit-learn — see `requirements.txt` (pinned)
- pytest + FastAPI TestClient

## Run locally

```bash
cd services/ml-python
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # Linux/macOS
cp .env.example .env
.venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check: `GET http://127.0.0.1:8000/health`

## API (internal)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | none | Liveness probe |
| `GET` | `/models` | `X-ML-Service-Key` | Allowed model identifiers |
| `POST` | `/train` | `X-ML-Service-Key` | Train + evaluate on inline rows |

`POST /train` body: `task_type` (`regression`|`classification`), `model_type`
(allow-listed, never a dynamic import), `target_column`, `feature_columns`,
`columns`, `rows` (strings), `test_size` (0.1–0.5), `random_state`.

## Algorithms

- Regression: `linear_regression`, `random_forest_regressor` (100 trees)
- Classification: `logistic_regression` (max_iter=1000), `random_forest_classifier` (100 trees)

## Pipeline & leakage prevention

1. Split train/test **first** on raw data (`train_test_split`, configurable seed).
2. Type detection per feature (numeric regex vs categorical); numerics median-imputed,
   categoricals most-frequent-imputed + one-hot encoded (`handle_unknown="ignore"`).
3. All preprocessors fit on **train only** via `Pipeline`/`ColumnTransformer`.
4. Metrics computed on **test only**; test metrics are never presented as train metrics.
5. Missing values (`""`, `na`, `n/a`, `null`, `none`, `nan`, `?`) → `NaN`, then imputed.
   Rows with missing/non-finite targets are dropped (documented, counted via sample sizes).
6. Binary classification: `average="binary"` with positive class = lexicographically
   larger label; multiclass: `average="weighted"`. The `averaging` field records the choice.

## Metrics

- Regression: MAE, RMSE, R² (`null` when undefined, e.g. constant test target — never `NaN`),
  train/test sample counts, wall-clock `train_seconds`.
- Classification: accuracy, precision, recall, F1, confusion matrix + labels.

## Limits

- Rows ≤ `MAX_TRAIN_ROWS` (200k), columns ≤ 200, features ≤ 100, cell ≤ 10k chars.
- Minimum 10 valid target rows; target needs ≥ 2 distinct values (regression) / classes.
- No model artifacts are persisted in this phase — only metrics and a ≤20-point
  prediction sample. Retraining is deterministic via `random_state`.

## Security

- No `eval`/`exec`/dynamic imports; model selection is an explicit allow-list.
- No filesystem or database access; datasets arrive as inline rows from Node,
  which already verified ownership.
- Error responses are sanitized (no tracebacks or paths).
- The service key lives only in backend env (`ML_SERVICE_KEY`).

## Tests

```bash
.venv/Scripts/python -m pytest tests -q
```
