"""
FastAPI Backend for TASA Exoplanet Checker.
Provides exoplanet ML prediction endpoints using the trained Gradient Boosting model.
"""

import json
import os
from typing import List, Optional
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model_pipeline.joblib")
META_PATH = os.path.join(BASE_DIR, "model_meta.json")
SAMPLES_PATH = os.path.join(BASE_DIR, "sample_kois.json")

# Load pipeline and metadata
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Trained model not found at {MODEL_PATH}. Run train_export.py first.")

pipeline = joblib.load(MODEL_PATH)

metadata = {}
if os.path.exists(META_PATH):
    with open(META_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)

sample_kois = []
if os.path.exists(SAMPLES_PATH):
    with open(SAMPLES_PATH, "r", encoding="utf-8") as f:
        sample_kois = json.load(f)

app = FastAPI(
    title="TASA Exoplanet Prediction API",
    description="Machine Learning service for predicting exoplanet confirmations using NASA Kepler telescope observations.",
    version="1.0.0"
)

# Enable CORS for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlanetFeatures(BaseModel):
    koi_period: float = Field(..., description="Orbital period in days (e.g. 129.95)")
    koi_duration: float = Field(..., description="Transit duration in hours (e.g. 4.0)")
    koi_depth: float = Field(..., description="Transit depth in parts per million (e.g. 500)")
    koi_prad: float = Field(..., description="Planet radius in Earth radii R⊕ (e.g. 1.17)")
    koi_model_snr: float = Field(..., description="Transit model signal-to-noise ratio (e.g. 35.0)")
    koi_steff: float = Field(..., description="Stellar effective temperature in Kelvin (e.g. 3788)")
    koi_time0bk: Optional[float] = Field(131.0, description="Transit epoch (BJD - 2454833.0)")
    koi_impact: Optional[float] = Field(0.5, description="Impact parameter (0.0 to 1.0+)")
    koi_teq: Optional[float] = Field(None, description="Equilibrium temperature in K (auto-estimated if omitted)")
    koi_insol: Optional[float] = Field(None, description="Insolation flux (Earth = 1, auto-estimated if omitted)")
    koi_slogg: Optional[float] = Field(4.4, description="Stellar surface gravity log10(cm/s^2)")
    koi_srad: Optional[float] = Field(1.0, description="Stellar radius in Solar radii R☉")
    koi_kepmag: Optional[float] = Field(14.0, description="Kepler band magnitude")

class PredictionResponse(BaseModel):
    prediction: str = Field(..., description="'CONFIRMED' or 'FALSE POSITIVE'")
    probability: float = Field(..., description="Exoplanet probability (0.0 to 1.0)")
    confidence_pct: str = Field(..., description="Confidence percentage formatted")
    is_exoplanet: bool = Field(..., description="True if probability >= 0.5")
    verdict_badge: str = Field(..., description="Display label for the verdict")
    color: str = Field(..., description="Hex color tone: #b9dba9 (sage) or #e8b97a (amber)")
    categories: dict = Field(..., description="Derived astronomical categories")
    key_insights: List[str] = Field(..., description="Natural language explanations of model decision")
    top_features: List[dict] = Field(..., description="Key feature values with context")

def compute_derived_categories(period: float, prad: float, steff: float, kepmag: float) -> dict:
    # 1. Orbit type
    if period <= 10.0:
        orbite = "short"
    elif period <= 100.0:
        orbite = "medium"
    else:
        orbite = "long"

    # 2. Planet type
    if prad <= 1.25:
        planete = "earth_like"
    elif prad <= 2.0:
        planete = "super_earth"
    elif prad <= 6.0:
        planete = "neptune_like"
    else:
        planete = "jupiter_like"

    # 3. Star type
    if steff <= 5200.0:
        etoile = "cool"
    elif steff <= 6000.0:
        etoile = "sun_like"
    else:
        etoile = "hot"

    # 4. Brightness
    if kepmag <= 13.0:
        luminosite = "bright"
    elif kepmag <= 15.0:
        luminosite = "medium"
    else:
        luminosite = "faint"

    return {
        "type_orbite": orbite,
        "type_planete": planete,
        "type_etoile": etoile,
        "luminosite": luminosite
    }

def generate_insights(f: PlanetFeatures, prob: float, is_exo: bool) -> List[str]:
    insights = []
    
    # SNR insight (top feature in permutation importance)
    if f.koi_model_snr >= 20.0:
        insights.append(f"Strong signal-to-noise ratio ({f.koi_model_snr:.1f} SNR), well above detection threshold.")
    elif f.koi_model_snr >= 10.0:
        insights.append(f"Moderate signal-to-noise ratio ({f.koi_model_snr:.1f} SNR), clear transit detected.")
    else:
        insights.append(f"Low signal-to-noise ratio ({f.koi_model_snr:.1f} SNR), high susceptibility to background noise.")

    # Planet radius insight
    if f.koi_prad <= 2.0:
        insights.append(f"Terrestrial size ({f.koi_prad:.2f} Earth radii), consistent with rocky/super-Earth planets.")
    elif f.koi_prad <= 6.0:
        insights.append(f"Sub-Neptune / Neptune size ({f.koi_prad:.2f} Earth radii), common for exoplanets.")
    elif f.koi_prad <= 15.0:
        insights.append(f"Gas giant radius ({f.koi_prad:.2f} Earth radii), comparable to Jupiter.")
    else:
        insights.append(f"Unusually large radius ({f.koi_prad:.1f} Earth radii), typical of eclipsing binary stars.")

    # Transit depth & duration
    if f.koi_depth > 10000:
        insights.append(f"Deep transit ({f.koi_depth:,.0f} ppm): large dip often points to stellar eclipse or giant planet.")
    else:
        insights.append(f"Transit depth of {f.koi_depth:,.0f} ppm is consistent with planetary occlusion.")

    # Period
    if f.koi_period < 1.0:
        insights.append(f"Ultra-short orbital period ({f.koi_period:.2f} days), tight stellar orbit.")
    else:
        insights.append(f"Orbital period is {f.koi_period:.2f} days.")

    return insights

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "TASA ML API",
        "model_loaded": pipeline is not None
    }

@app.get("/api/model/info")
def model_info():
    return {
        "metadata": metadata,
        "sample_count": len(sample_kois)
    }

@app.get("/api/samples")
def get_samples(disposition: Optional[str] = None):
    """Retrieve sample Kepler objects to test the model without typing manual numbers."""
    if disposition:
        return [s for s in sample_kois if s.get("actual_disposition", "").upper() == disposition.upper()]
    return sample_kois

@app.post("/api/predict", response_model=PredictionResponse)
def predict_exoplanet(features: PlanetFeatures):
    try:
        cats = compute_derived_categories(
            period=features.koi_period,
            prad=features.koi_prad,
            steff=features.koi_steff,
            kepmag=features.koi_kepmag or 14.0
        )

        teq = features.koi_teq
        if teq is None:
            # Simple approximation of equilibrium temperature if not provided
            teq = 278.0 * ((features.koi_srad or 1.0) ** 0.5) / ((features.koi_period / 365.25) ** 0.25)

        insol = features.koi_insol
        if insol is None:
            insol = ((features.koi_steff / 5778.0) ** 4) * ((features.koi_srad or 1.0) ** 2) / ((features.koi_period / 365.25) ** (4/3))

        # Build feature DataFrame matching trained ColumnTransformer columns
        row = {
            "koi_period": features.koi_period,
            "koi_time0bk": features.koi_time0bk if features.koi_time0bk is not None else 131.0,
            "koi_impact": features.koi_impact if features.koi_impact is not None else 0.5,
            "koi_duration": features.koi_duration,
            "koi_depth": features.koi_depth,
            "koi_prad": features.koi_prad,
            "koi_teq": teq,
            "koi_insol": insol,
            "koi_model_snr": features.koi_model_snr,
            "koi_steff": features.koi_steff,
            "koi_slogg": features.koi_slogg if features.koi_slogg is not None else 4.4,
            "koi_srad": features.koi_srad if features.koi_srad is not None else 1.0,
            "koi_kepmag": features.koi_kepmag if features.koi_kepmag is not None else 14.0,
            "type_orbite": cats["type_orbite"],
            "type_planete": cats["type_planete"],
            "type_etoile": cats["type_etoile"],
            "luminosite": cats["luminosite"]
        }

        df_input = pd.DataFrame([row])

        # Predict probability
        probs = pipeline.predict_proba(df_input)[0]
        prob_exo = float(probs[1])
        is_exo = prob_exo >= 0.5
        prediction = "CONFIRMED" if is_exo else "FALSE POSITIVE"

        insights = generate_insights(features, prob_exo, is_exo)

        top_features = [
            {"name": "Signal-to-Noise (SNR)", "value": f"{features.koi_model_snr:.1f}"},
            {"name": "Planet Radius", "value": f"{features.koi_prad:.2f} R⊕ ({cats['type_planete'].replace('_', ' ')})"},
            {"name": "Orbital Period", "value": f"{features.koi_period:.2f} d ({cats['type_orbite']})"},
            {"name": "Transit Duration", "value": f"{features.koi_duration:.2f} hrs"},
            {"name": "Transit Depth", "value": f"{features.koi_depth:,.0f} ppm"},
            {"name": "Host Star Temp", "value": f"{features.koi_steff:,.0f} K ({cats['type_etoile']})"}
        ]

        return PredictionResponse(
            prediction=prediction,
            probability=round(prob_exo, 4),
            confidence_pct=f"{prob_exo * 100:.1f}%" if is_exo else f"{(1 - prob_exo) * 100:.1f}%",
            is_exoplanet=is_exo,
            verdict_badge="Confirmed Exoplanet" if is_exo else "False Positive",
            color="#b9dba9" if is_exo else "#e8b97a",
            categories=cats,
            key_insights=insights,
            top_features=top_features
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
