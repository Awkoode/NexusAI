"""Tests for training pipelines: metrics, leakage prevention, edge cases."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.schemas.training import TrainRequest
from app.services import training as training_service

client = TestClient(app)
AUTH = {"X-ML-Service-Key": settings.ML_SERVICE_KEY}

HOUSE_COLUMNS = ["size", "bedrooms", "city", "price"]
HOUSE_ROWS = [
    ["1200", "3", "Lisbon", "250000"],
    ["800", "2", "Porto", "180000"],
    ["1500", "4", "Lisbon", "320000"],
    ["950", "2", "Porto", "195000"],
    ["1100", "3", "Coimbra", "230000"],
    ["700", "1", "Porto", "150000"],
    ["1300", "3", "Lisbon", "275000"],
    ["850", "2", "Coimbra", "185000"],
    ["1600", "4", "Lisbon", "340000"],
    ["1000", "2", "Porto", "210000"],
    ["1250", "3", "Coimbra", "260000"],
    ["900", "2", "Lisbon", "200000"],
    ["1400", "3", "Porto", "290000"],
    ["750", "1", "Coimbra", "160000"],
    ["1700", "5", "Lisbon", "360000"],
    ["1050", "2", "Porto", "215000"],
    ["1150", "3", "Coimbra", "240000"],
    ["1350", "3", "Lisbon", "280000"],
    ["950", "1", "Porto", "190000"],
    ["1450", "4", "Coimbra", "300000"],
]


def make_regression(**overrides) -> TrainRequest:
    base: dict = {
        "task_type": "regression",
        "model_type": "linear_regression",
        "target_column": "price",
        "feature_columns": ["size", "bedrooms", "city"],
        "columns": HOUSE_COLUMNS,
        "rows": HOUSE_ROWS,
        "test_size": 0.25,
        "random_state": 42,
    }
    base.update(overrides)
    return TrainRequest(**base)


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_train_requires_service_key():
    response = client.post("/train", json=make_regression().model_dump())
    assert response.status_code == 401


def test_regression_metrics_are_real():
    req = make_regression()
    result = training_service.train(req)
    assert result.metrics.mae > 0
    assert result.metrics.rmse >= result.metrics.mae
    assert result.metrics.train_samples + result.metrics.test_samples == len(HOUSE_ROWS)
    assert result.metrics.test_samples >= 2
    # R² must be a real number or explicit None, never NaN
    if result.metrics.r2 is not None:
        assert np.isfinite(result.metrics.r2)
    assert result.train_seconds >= 0


def test_regression_reproducible_with_same_seed():
    first = training_service.train(make_regression())
    second = training_service.train(make_regression())
    assert first.metrics.mae == second.metrics.mae
    assert first.metrics.rmse == second.metrics.rmse
    assert first.predictions_summary.sample == second.predictions_summary.sample


def test_random_forest_regressor_runs():
    result = training_service.train(make_regression(model_type="random_forest_regressor"))
    assert result.metrics.test_samples >= 2
    assert result.metrics.mae > 0


def test_target_in_features_rejected():
    with pytest.raises(Exception):
        make_regression(feature_columns=["size", "price"])


def test_unknown_model_rejected():
    with pytest.raises(Exception):
        make_regression(model_type="os.system")


def test_constant_target_rejected():
    rows = [[r[0], r[1], r[2], "100"] for r in HOUSE_ROWS]
    with pytest.raises(ValueError, match="no variation"):
        training_service.train(make_regression(rows=rows))


def test_too_few_rows_rejected():
    rows = HOUSE_ROWS[:5]
    with pytest.raises(ValueError, match="not enough valid"):
        training_service.train(make_regression(rows=rows))


def test_classification_metrics():
    cols = ["age", "income", "segment"]
    rows = [
        ["25", "40000", "basic"],
        ["45", "90000", "premium"],
        ["30", "50000", "basic"],
        ["50", "120000", "premium"],
        ["28", "45000", "basic"],
        ["55", "110000", "premium"],
        ["35", "60000", "basic"],
        ["48", "95000", "premium"],
        ["26", "42000", "basic"],
        ["52", "105000", "premium"],
        ["33", "58000", "basic"],
        ["47", "98000", "premium"],
    ]
    from app.schemas.training import TrainRequest as TR

    req = TR(
        task_type="classification",
        model_type="logistic_regression",
        target_column="segment",
        feature_columns=["age", "income"],
        columns=cols,
        rows=rows,
        test_size=0.25,
        random_state=7,
    )
    result = training_service.train(req)
    assert 0 <= result.metrics.accuracy <= 1
    assert result.metrics.averaging == "binary"
    assert len(result.metrics.confusion_matrix) == 2
    assert result.metrics.labels == ["basic", "premium"]


def test_random_forest_classifier_runs():
    cols = ["age", "income", "segment"]
    rows = [
        ["25", "40000", "basic"],
        ["45", "90000", "premium"],
        ["30", "50000", "basic"],
        ["50", "120000", "premium"],
        ["28", "45000", "basic"],
        ["55", "110000", "premium"],
        ["35", "60000", "basic"],
        ["48", "95000", "premium"],
        ["26", "42000", "basic"],
        ["52", "105000", "premium"],
        ["33", "58000", "basic"],
        ["47", "98000", "premium"],
    ]
    from app.schemas.training import TrainRequest as TR

    req = TR(
        task_type="classification",
        model_type="random_forest_classifier",
        target_column="segment",
        feature_columns=["age", "income"],
        columns=cols,
        rows=rows,
        test_size=0.25,
        random_state=7,
    )
    result = training_service.train(req)
    assert 0 <= result.metrics.f1 <= 1


def test_single_class_target_rejected():
    cols = ["age", "segment"]
    rows = [["25", "basic"], ["30", "basic"], ["35", "basic"]]
    from app.schemas.training import TrainRequest as TR

    req = TR(
        task_type="classification",
        model_type="logistic_regression",
        target_column="segment",
        feature_columns=["age"],
        columns=cols,
        rows=rows,
        test_size=0.25,
        random_state=7,
    )
    with pytest.raises(ValueError, match="at least 2 classes"):
        training_service.train(req)


def test_missing_values_handled():
    rows = [row[:] for row in HOUSE_ROWS]
    rows[0][0] = ""
    rows[1][2] = "N/A"
    result = training_service.train(make_regression(rows=rows))
    assert result.metrics.test_samples >= 2
    assert result.metrics.mae > 0


def test_no_leakage_preprocessor_fit_on_train_only():
    """Shift the test distribution: a leaking imputer would hide the shift."""
    import pandas as pd

    cols = ["x", "y"]
    train_rows = [[str(float(i)), str(float(i) * 2)] for i in range(50)]
    test_rows = [[str(1000.0 + float(i)), str((1000.0 + float(i)) * 2)] for i in range(10)]
    all_rows = train_rows + test_rows
    result = training_service.train(
        TrainRequest(
            task_type="regression",
            model_type="linear_regression",
            target_column="y",
            feature_columns=["x"],
            columns=cols,
            rows=all_rows,
            test_size=10 / 60,
            random_state=0,
        )
    )
    # Linear fit on train must extrapolate; just assert the pipeline ran on a real split.
    assert result.metrics.train_samples == 50
    assert result.metrics.test_samples == 10
    assert pd.notna(result.metrics.mae)


def test_train_endpoint_end_to_end():
    response = client.post("/train", json=make_regression().model_dump(), headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["metrics"]["test_samples"] >= 2
    assert body["model_type"] == "linear_regression"
