"""Descriptive statistics over inline numeric columns.

Same-data counterpart to the Julia engine's /v1/statistics/* endpoints, used
by the Node backend for Python x Julia comparison. Conventions match the
Julia service: sample variance/std (ddof=1), linear-interpolated quantiles,
pairwise missing handling, undefined results as null.
"""

import math

import numpy as np


def _clean(values: list) -> list[float]:
    out: list[float] = []
    for v in values:
        if v is None:
            continue
        if isinstance(v, bool):
            raise ValueError("boolean values are not numeric")
        try:
            f = float(v)
        except (TypeError, ValueError) as exc:
            raise ValueError("non-numeric value in column") from exc
        if not math.isfinite(f):
            raise ValueError("non-finite value in column")
        out.append(f)
    return out


def _finite_or_none(value: float | None) -> float | None:
    if value is None:
        return None
    f = float(value)
    return f if math.isfinite(f) else None


def describe_column(name: str, values: list) -> dict:
    cleaned = _clean(values)
    missing = len(values) - len(cleaned)
    n = len(cleaned)
    warnings: list[str] = []
    if n == 0:
        return {
            "name": name, "count": 0, "missing": missing,
            "mean": None, "median": None, "std": None, "variance": None,
            "min": None, "max": None, "q1": None, "q3": None,
            "distinct": 0, "warnings": warnings + [f'column "{name}" has no valid observations'],
        }
    arr = np.asarray(cleaned, dtype=float)
    distinct = int(len(set(cleaned)))
    if distinct == 1:
        warnings.append(f'column "{name}" is constant')
    if n >= 2:
        std_v: float | None = float(np.std(arr, ddof=1))
        var_v: float | None = float(np.var(arr, ddof=1))
        q1: float | None = float(np.quantile(arr, 0.25, method="linear"))
        q3: float | None = float(np.quantile(arr, 0.75, method="linear"))
    else:
        std_v = var_v = q1 = q3 = None
        warnings.append(f'column "{name}" has a single observation: std/var/quartiles undefined')
    return {
        "name": name, "count": n, "missing": missing,
        "mean": _finite_or_none(float(np.mean(arr))),
        "median": _finite_or_none(float(np.median(arr))),
        "std": _finite_or_none(std_v) if std_v is not None else None,
        "variance": _finite_or_none(var_v) if var_v is not None else None,
        "min": _finite_or_none(float(np.min(arr))),
        "max": _finite_or_none(float(np.max(arr))),
        "q1": _finite_or_none(q1) if q1 is not None else None,
        "q3": _finite_or_none(q3) if q3 is not None else None,
        "distinct": distinct, "warnings": warnings,
    }


def pearson(xs: list[float], ys: list[float]) -> tuple[float | None, int]:
    if len(xs) < 2:
        return None, len(xs)
    arr_x = np.asarray(xs, dtype=float)
    arr_y = np.asarray(ys, dtype=float)
    denom = float(np.sqrt(np.sum((arr_x - arr_x.mean()) ** 2) * np.sum((arr_y - arr_y.mean()) ** 2)))
    if denom == 0.0:
        return None, len(xs)
    r = float(np.sum((arr_x - arr_x.mean()) * (arr_y - arr_y.mean())) / denom)
    return (r if math.isfinite(r) else None), len(xs)


def sample_covariance(xs: list[float], ys: list[float]) -> tuple[float | None, int]:
    if len(xs) < 2:
        return None, len(xs)
    arr_x = np.asarray(xs, dtype=float)
    arr_y = np.asarray(ys, dtype=float)
    c = float(np.sum((arr_x - arr_x.mean()) * (arr_y - arr_y.mean())) / (len(xs) - 1))
    return (c if math.isfinite(c) else None), len(xs)
