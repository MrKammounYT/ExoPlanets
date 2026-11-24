"""
Unit and integration tests for TASA FastAPI backend.
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    print("✓ /api/health passed")

def test_model_info():
    res = client.get("/api/model/info")
    assert res.status_code == 200
    data = res.json()
    assert "metadata" in data
    assert "sample_count" in data
    assert data["sample_count"] > 0
    print("✓ /api/model/info passed")

def test_samples():
    res = client.get("/api/samples")
    assert res.status_code == 200
    samples = res.json()
    assert len(samples) > 0
    print(f"✓ /api/samples passed ({len(samples)} samples returned)")

def test_predict_confirmed_kepler186f():
    # Kepler-186 f approximate physical parameters
    payload = {
        "koi_period": 129.9441,
        "koi_duration": 4.1,
        "koi_depth": 500.0,
        "koi_prad": 1.17,
        "koi_model_snr": 35.0,
        "koi_steff": 3788.0,
        "koi_time0bk": 134.5,
        "koi_impact": 0.05,
        "koi_slogg": 4.7,
        "koi_srad": 0.52,
        "koi_kepmag": 14.6
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "prediction" in data
    assert "probability" in data
    assert "is_exoplanet" in data
    print(f"✓ /api/predict (Kepler-186 f) passed: verdict={data['prediction']}, prob={data['probability']:.4f}")

def test_predict_false_positive():
    # Large object (stellar binary) with high depth, huge radius
    payload = {
        "koi_period": 0.85,
        "koi_duration": 1.5,
        "koi_depth": 85000.0,
        "koi_prad": 35.0,
        "koi_model_snr": 5.2,
        "koi_steff": 6200.0,
        "koi_time0bk": 120.0,
        "koi_impact": 0.9,
        "koi_slogg": 4.2,
        "koi_srad": 1.2,
        "koi_kepmag": 13.5
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["prediction"] == "FALSE POSITIVE"
    print(f"✓ /api/predict (False Positive) passed: verdict={data['prediction']}, prob={data['probability']:.4f}")

if __name__ == "__main__":
    test_health()
    test_model_info()
    test_samples()
    test_predict_confirmed_kepler186f()
    test_predict_false_positive()
    print("\nAll backend API tests successfully passed!")
