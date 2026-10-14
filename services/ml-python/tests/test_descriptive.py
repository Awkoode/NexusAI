"""Tests for the descriptive-statistics endpoints used in comparison."""

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)
AUTH = {"X-ML-Service-Key": settings.ML_SERVICE_KEY}

COLUMNS = {
    "x": [1.0, 2.0, 3.0, 4.0],
    "y": [2.0, 4.0, 6.0, 8.0],
    "c": [7.0, 7.0, 7.0, 7.0],
}


def test_describe_endpoint():
    response = client.post("/statistics/describe", json={"columns": COLUMNS}, headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    by_name = {c["name"]: c for c in body["columns"]}
    assert by_name["x"]["mean"] == 2.5
    assert by_name["x"]["count"] == 4
    assert by_name["c"]["std"] == 0.0
    assert body["conventions"]["std"] == "sample (ddof=1)"


def test_describe_requires_auth():
    response = client.post("/statistics/describe", json={"columns": COLUMNS})
    assert response.status_code == 401


def test_describe_rejects_strings():
    response = client.post(
        "/statistics/describe", json={"columns": {"x": ["a", 1.0]}}, headers=AUTH
    )
    assert response.status_code == 422


def test_correlation_endpoint():
    response = client.post("/statistics/correlation", json={"columns": COLUMNS}, headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    idx = {name: i for i, name in enumerate(body["columns"])}
    assert body["matrix"][idx["x"]][idx["y"]] == 1.0
    # constant column: undefined, not zero
    assert body["matrix"][idx["x"]][idx["c"]] is None
    assert body["pair_n"][idx["x"]][idx["y"]] == 4


def test_covariance_endpoint():
    response = client.post(
        "/statistics/covariance",
        json={"columns": {"x": [1.0, 2.0, 3.0], "y": [1.0, 2.0, 3.0]}},
        headers=AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["matrix"][0][0] == 1.0  # sample var([1,2,3]) = 1
    assert "n-1" in body["method"]
