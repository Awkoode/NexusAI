"""ML training pipelines with strict leakage prevention.

Rules enforced here:
- train/test split happens FIRST, on raw string data;
- every preprocessor (imputer/encoder/scaler) is fitted on the TRAIN split only;
- the target column is never part of the features;
- categoricals are one-hot encoded, numerics are median-imputed;
- all metrics are computed on the TEST split only.
"""

import time

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.config import settings
from app.schemas.training import (
    ClassificationMetrics,
    NumericMetrics,
    PredictionSummary,
    TrainRequest,
    TrainResponse,
)

MISSING_TOKENS = {"", "na", "n/a", "null", "none", "nan", "?"}

# A column is treated as numeric only when every non-missing value parses as a
# number. Identifier-like codes (ZIPs, zero-padded IDs) are the caller's
# responsibility: the API exposes the detected type and lets the user pick features.
NUMERIC_RE = r"^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$"


def _normalize_frame(columns: list[str], rows: list[list[str]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=columns, dtype=str)
    # Normalize common missing-value spellings to NaN (case-insensitive).
    lowered = df.apply(lambda s: s.str.strip().str.lower())
    mask = lowered.isin(MISSING_TOKENS)
    df = df.mask(mask, np.nan)
    return df


def _split_column_kinds(df: pd.DataFrame, feature_columns: list[str]) -> tuple[list[str], list[str]]:
    numeric_cols: list[str] = []
    categorical_cols: list[str] = []
    for col in feature_columns:
        series = df[col].dropna()
        if len(series) == 0:
            categorical_cols.append(col)
            continue
        if series.astype(str).str.match(NUMERIC_RE).all():
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)
    return numeric_cols, categorical_cols


def _to_numeric_frame(df: pd.DataFrame, numeric_cols: list[str]) -> pd.DataFrame:
    out = df.copy()
    for col in numeric_cols:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def _build_preprocessor(numeric_cols: list[str], categorical_cols: list[str]) -> ColumnTransformer:
    transformers = []
    if numeric_cols:
        transformers.append(("num", SimpleImputer(strategy="median"), numeric_cols))
    if categorical_cols:
        transformers.append(
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_cols,
            )
        )
    if not transformers:
        raise ValueError("no usable feature columns")
    return ColumnTransformer(transformers=transformers)


def _safe_float(value: float) -> float | None:
    if value is None:
        return None
    f = float(value)
    return f if np.isfinite(f) else None


def train_regression(req: TrainRequest) -> TrainResponse:
    started = time.perf_counter()
    df = _normalize_frame(req.columns, req.rows)

    target = pd.to_numeric(df[req.target_column], errors="coerce")
    valid = target.notna() & target.apply(lambda v: np.isfinite(float(v)))
    df = df.loc[valid].reset_index(drop=True)
    target = target.loc[valid].reset_index(drop=True)

    n_valid = int(len(df))
    if n_valid < 10:
        raise ValueError(f"not enough valid target rows for training (found {n_valid}, need >= 10)")
    if float(target.nunique()) < 2:
        raise ValueError("target column has no variation: regression requires at least 2 distinct values")

    numeric_cols, categorical_cols = _split_column_kinds(df, req.feature_columns)
    if not numeric_cols and not categorical_cols:
        raise ValueError("no usable feature columns after type detection")

    X = _to_numeric_frame(df[req.feature_columns], numeric_cols)
    y = target.astype(float)

    test_size = req.test_size
    # Guarantee at least 2 test rows so R² stays defined when possible.
    min_test_fraction = 2 / n_valid
    if test_size < min_test_fraction:
        test_size = min_test_fraction

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=req.random_state
    )
    if len(y_test) < 2:
        raise ValueError("test split too small: need at least 2 test rows")

    preprocessor = _build_preprocessor(numeric_cols, categorical_cols)
    model = (
        LinearRegression()
        if req.model_type == "linear_regression"
        else RandomForestRegressor(n_estimators=100, random_state=req.random_state)
    )
    pipe = Pipeline(steps=[("preprocess", preprocessor), ("model", model)])
    pipe.fit(X_train, y_train)
    preds = pipe.predict(X_test)

    mae = float(mean_absolute_error(y_test, preds))
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    try:
        r2_raw = float(r2_score(y_test, preds))
    except Exception:
        r2_raw = float("nan")

    actual = y_test.to_numpy(dtype=float)
    sample_n = min(20, len(actual))
    sample = [[float(actual[i]), float(preds[i])] for i in range(sample_n)]

    import sklearn
    import pandas as _pd

    return TrainResponse(
        task_type="regression",
        model_type=req.model_type,
        target_column=req.target_column,
        feature_columns=req.feature_columns,
        test_size=req.test_size,
        random_state=req.random_state,
        metrics=NumericMetrics(
            mae=mae,
            rmse=rmse,
            r2=_safe_float(r2_raw),
            train_samples=int(len(X_train)),
            test_samples=int(len(X_test)),
        ),
        predictions_summary=PredictionSummary(
            count=int(len(actual)),
            actual_mean=_safe_float(float(np.mean(actual))),
            predicted_mean=_safe_float(float(np.mean(preds))),
            sample=sample,
        ),
        train_seconds=time.perf_counter() - started,
        library_versions={
            "scikit-learn": sklearn.__version__,
            "pandas": _pd.__version__,
            "numpy": np.__version__,
        },
    )


def train_classification(req: TrainRequest) -> TrainResponse:
    started = time.perf_counter()
    df = _normalize_frame(req.columns, req.rows)

    target = df[req.target_column].astype(str)
    valid = df[req.target_column].notna()
    df = df.loc[valid].reset_index(drop=True)
    target = target.loc[valid].reset_index(drop=True)

    labels = sorted(target.unique().tolist())
    if len(labels) < 2:
        raise ValueError("target column needs at least 2 classes for classification")

    numeric_cols, categorical_cols = _split_column_kinds(df, req.feature_columns)
    if not numeric_cols and not categorical_cols:
        raise ValueError("no usable feature columns after type detection")

    X = _to_numeric_frame(df[req.feature_columns], numeric_cols)
    y = target

    # Stratified split when every class has >= 2 samples, else plain split.
    min_class_count = int(y.value_counts().min())
    stratify = y if min_class_count >= 2 else None
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=req.test_size, random_state=req.random_state, stratify=stratify
        )
    except ValueError as exc:
        raise ValueError(f"could not create a valid train/test split: {exc}") from exc

    if len(y_test) < 1 or len(y_train) < 1:
        raise ValueError("train/test split produced an empty set")

    preprocessor = _build_preprocessor(numeric_cols, categorical_cols)
    model = (
        LogisticRegression(max_iter=1000)
        if req.model_type == "logistic_regression"
        else RandomForestClassifier(n_estimators=100, random_state=req.random_state)
    )
    pipe = Pipeline(steps=[("preprocess", preprocessor), ("model", model)])
    pipe.fit(X_train, y_train)
    preds = pipe.predict(X_test)

    averaging = "binary" if len(labels) == 2 else "weighted"
    # Binary string labels need an explicit positive class: by convention the
    # lexicographically larger label (documented in the service README).
    pos_label = labels[1] if len(labels) == 2 else 1
    accuracy = float(accuracy_score(y_test, preds))
    precision = float(
        precision_score(y_test, preds, average=averaging, pos_label=pos_label, zero_division=0)
    )
    recall = float(
        recall_score(y_test, preds, average=averaging, pos_label=pos_label, zero_division=0)
    )
    f1 = float(f1_score(y_test, preds, average=averaging, pos_label=pos_label, zero_division=0))
    cm = confusion_matrix(y_test, preds, labels=labels).tolist()

    sample_n = min(20, len(y_test))
    y_test_list = y_test.tolist()
    preds_list = preds.tolist() if hasattr(preds, "tolist") else list(preds)
    sample = [[str(y_test_list[i]), str(preds_list[i])] for i in range(sample_n)]

    import sklearn
    import pandas as _pd

    return TrainResponse(
        task_type="classification",
        model_type=req.model_type,
        target_column=req.target_column,
        feature_columns=req.feature_columns,
        test_size=req.test_size,
        random_state=req.random_state,
        metrics=ClassificationMetrics(
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1=f1,
            averaging=averaging,
            train_samples=int(len(X_train)),
            test_samples=int(len(X_test)),
            confusion_matrix=cm,
            labels=labels,
        ),
        predictions_summary=PredictionSummary(
            count=int(len(y_test)),
            actual_mean=None,
            predicted_mean=None,
            sample=sample,
        ),
        train_seconds=time.perf_counter() - started,
        library_versions={
            "scikit-learn": sklearn.__version__,
            "pandas": _pd.__version__,
            "numpy": np.__version__,
        },
    )


def train(req: TrainRequest) -> TrainResponse:
    if len(req.rows) > settings.MAX_TRAIN_ROWS:
        raise ValueError(f"dataset exceeds the {settings.MAX_TRAIN_ROWS} row training limit")
    if len(req.columns) > settings.MAX_TRAIN_COLUMNS:
        raise ValueError(f"dataset exceeds the {settings.MAX_TRAIN_COLUMNS} column training limit")
    if len(req.feature_columns) > settings.MAX_FEATURES:
        raise ValueError(f"select at most {settings.MAX_FEATURES} feature columns")
    if req.task_type == "regression":
        return train_regression(req)
    return train_classification(req)
