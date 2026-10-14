"""Pydantic schemas for the internal ML API.

The Node.js backend is the only caller. Every request carries the dataset
rows explicitly — the ML service never touches the filesystem, user paths,
or the database.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

TaskType = Literal["regression", "classification"]

# Explicit allow-lists. The service NEVER imports classes dynamically.
REGRESSION_MODELS = ("linear_regression", "random_forest_regressor")
CLASSIFICATION_MODELS = ("logistic_regression", "random_forest_classifier")
ALLOWED_MODELS = REGRESSION_MODELS + CLASSIFICATION_MODELS

# Hard caps enforced even if the caller sends larger values.
MAX_ROWS = 200_000
MAX_COLUMNS = 200


class TrainRequest(BaseModel):
    task_type: TaskType
    model_type: str = Field(min_length=1, max_length=64)
    target_column: str = Field(min_length=1, max_length=200)
    feature_columns: list[str] = Field(min_length=1, max_length=100)
    columns: list[str] = Field(min_length=2, max_length=MAX_COLUMNS)
    rows: list[list[str]] = Field(min_length=1, max_length=MAX_ROWS)
    test_size: float = Field(default=0.2, ge=0.1, le=0.5)
    random_state: int = Field(default=42, ge=0, le=2**31 - 1)

    @field_validator("feature_columns", "columns")
    @classmethod
    def _non_empty_names(cls, v: list[str]) -> list[str]:
        if any(not name.strip() for name in v):
            raise ValueError("column names must be non-empty")
        return v

    @model_validator(mode="after")
    def _check_consistency(self) -> "TrainRequest":
        if self.target_column in self.feature_columns:
            raise ValueError("target_column must not be listed in feature_columns")
        unknown = [c for c in [self.target_column, *self.feature_columns] if c not in self.columns]
        if unknown:
            raise ValueError(f"unknown columns: {unknown}")
        if len(set(self.feature_columns)) != len(self.feature_columns):
            raise ValueError("feature_columns contains duplicates")
        width = len(self.columns)
        for i, row in enumerate(self.rows):
            if len(row) != width:
                raise ValueError(f"row {i} has {len(row)} fields, expected {width}")
            for cell in row:
                if len(cell) > 10_000:
                    raise ValueError("cell exceeds maximum length")
        if self.task_type == "regression" and self.model_type not in REGRESSION_MODELS:
            raise ValueError(f"model '{self.model_type}' is not a regression model")
        if self.task_type == "classification" and self.model_type not in CLASSIFICATION_MODELS:
            raise ValueError(f"model '{self.model_type}' is not a classification model")
        return self


class NumericMetrics(BaseModel):
    mae: float
    rmse: float
    # R² can be undefined (e.g. constant target in test set) — null, never NaN.
    r2: float | None
    train_samples: int
    test_samples: int


class ClassificationMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1: float
    averaging: str
    train_samples: int
    test_samples: int
    confusion_matrix: list[list[int]]
    labels: list[str]


class PredictionSummary(BaseModel):
    count: int
    actual_mean: float | None = None
    predicted_mean: float | None = None
    # Small sample of (actual, predicted) pairs for display, never the full set.
    sample: list[list[float | str]] = Field(default_factory=list, max_length=50)


class TrainResponse(BaseModel):
    task_type: TaskType
    model_type: str
    target_column: str
    feature_columns: list[str]
    test_size: float
    random_state: int
    metrics: NumericMetrics | ClassificationMetrics
    predictions_summary: PredictionSummary
    train_seconds: float
    library_versions: dict[str, str]
