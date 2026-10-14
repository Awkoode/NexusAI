"""Internal ML API. Only the Node.js backend calls this service."""

import math

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas.training import (
    ALLOWED_MODELS,
    TrainRequest,
    TrainResponse,
)
from app.services import training as training_service
from app.services import descriptive as descriptive_service

app = FastAPI(title="NexusAI ML Service", version=settings.SERVICE_VERSION)


async def require_service_key(x_ml_service_key: str | None = Header(default=None)) -> None:
    if not x_ml_service_key or x_ml_service_key != settings.ML_SERVICE_KEY:
        raise HTTPException(status_code=401, detail="invalid service credentials")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.SERVICE_NAME, "version": settings.SERVICE_VERSION}


@app.get("/models", dependencies=[Depends(require_service_key)])
async def list_models() -> dict[str, list[str]]:
    return {"models": list(ALLOWED_MODELS)}


@app.post(
    "/train",
    dependencies=[Depends(require_service_key)],
    response_model=TrainResponse,
)
async def train(payload: TrainRequest) -> TrainResponse:
    try:
        return training_service.train(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # never leak tracebacks or paths
        raise HTTPException(status_code=500, detail="training failed") from exc


@app.exception_handler(ValidationError)
async def validation_handler(_request: object, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": "invalid training request"})


class StatisticsRequest(BaseModel):
    columns: dict[str, list[float | int | None]]
    options: dict[str, str] | None = None


def _clean_columns(columns: dict[str, list]) -> tuple[list[str], dict[str, list[float | None]]]:
    if not columns:
        raise HTTPException(status_code=422, detail="at least one column is required")
    if len(columns) > 50:
        raise HTTPException(status_code=422, detail="at most 50 columns are allowed")
    cleaned: dict[str, list[float | None]] = {}
    for name, values in columns.items():
        if not name.strip() or len(name) > 200:
            raise HTTPException(status_code=422, detail="invalid column name")
        if not isinstance(values, list) or len(values) > 100_000:
            raise HTTPException(status_code=422, detail=f"invalid values for column {name}")
        out: list[float | None] = []
        for v in values:
            if v is None:
                out.append(None)
            elif isinstance(v, bool):
                raise HTTPException(status_code=422, detail=f"column {name} contains a boolean")
            else:
                try:
                    f = float(v)
                except (TypeError, ValueError) as exc:
                    raise HTTPException(status_code=422, detail=f"column {name} is not numeric") from exc
                if not math.isfinite(f):
                    raise HTTPException(status_code=422, detail=f"column {name} is not finite")
                out.append(f)
        cleaned[name] = out
    if sum(len(v) for v in cleaned.values()) == 0:
        raise HTTPException(status_code=422, detail="no observations provided")
    return list(cleaned.keys()), cleaned


@app.post("/statistics/describe", dependencies=[Depends(require_service_key)])
async def statistics_describe(payload: StatisticsRequest) -> dict:
    names, cleaned = _clean_columns(payload.columns)
    return {
        "columns": [descriptive_service.describe_column(n, cleaned[n]) for n in names],
        "conventions": {
            "std": "sample (ddof=1)",
            "quantiles": "linear interpolation",
            "missing": "excluded per column; JSON null only",
        },
    }


@app.post("/statistics/correlation", dependencies=[Depends(require_service_key)])
async def statistics_correlation(payload: StatisticsRequest) -> dict:
    names, cleaned = _clean_columns(payload.columns)
    matrix: list[list[float | None]] = []
    pair_n: list[list[int]] = []
    warnings: list[str] = []
    for a in names:
        row: list[float | None] = []
        nrow: list[int] = []
        for b in names:
            la = cleaned[a]
            lb = cleaned[b]
            if a == b:
                xs = [v for v in la if v is not None]
                r, n = (1.0, len(xs)) if len(xs) >= 2 and len(set(xs)) > 1 else (None, len(xs))
                if r is None:
                    warnings.append(f'column "{a}" has no variation: diagonal undefined')
            else:
                px = [x for x, y in zip(la, lb) if x is not None and y is not None]
                py = [y for x, y in zip(la, lb) if x is not None and y is not None]
                r, n = descriptive_service.pearson(px, py)
                if r is None:
                    warnings.append(f"pair ({a}, {b}): correlation undefined (n={n})")
            row.append(r)
            nrow.append(n)
        matrix.append(row)
        pair_n.append(nrow)
    return {
        "columns": names, "matrix": matrix, "pair_n": pair_n,
        "missing_policy": "pairwise", "method": "pearson",
        "warnings": sorted(set(warnings)),
    }


@app.post("/statistics/covariance", dependencies=[Depends(require_service_key)])
async def statistics_covariance(payload: StatisticsRequest) -> dict:
    names, cleaned = _clean_columns(payload.columns)
    matrix: list[list[float | None]] = []
    pair_n: list[list[int]] = []
    warnings: list[str] = []
    for a in names:
        row: list[float | None] = []
        nrow: list[int] = []
        for b in names:
            la = cleaned[a]
            lb = cleaned[b]
            px = [x for x, y in zip(la, lb) if x is not None and y is not None]
            py = [y for x, y in zip(la, lb) if x is not None and y is not None]
            c, n = descriptive_service.sample_covariance(px, py)
            if c is None:
                warnings.append(f"pair ({a}, {b}): covariance undefined (n={n})")
            row.append(c)
            nrow.append(n)
        matrix.append(row)
        pair_n.append(nrow)
    return {
        "columns": names, "matrix": matrix, "pair_n": pair_n,
        "missing_policy": "pairwise", "method": "sample covariance (denominator n-1)",
        "warnings": sorted(set(warnings)),
    }
