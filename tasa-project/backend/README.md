# TASA FastAPI Backend

FastAPI service that serves real-time exoplanet classifications using the trained **Gradient Boosting Classifier** pipeline.

## Model Summary
- **Source:** Trained on Kepler Objects of Interest (`cumulative.csv` from NASA Exoplanet Archive).
- **Architecture:** Scikit-learn Pipeline with `ColumnTransformer` (median imputation, log1p transform on skewed features, standard scaling, and one-hot encoding) + `GradientBoostingClassifier`.
- **Performance:**
  - Accuracy: **93.5%**
  - F1-Score: **0.896**
  - AUC-ROC: **0.976**
- **Artifacts:**
  - `model_pipeline.joblib`: Serialized end-to-end scikit-learn pipeline.
  - `model_meta.json`: Training metrics, hyperparameter settings, and feature importances.
  - `sample_kois.json`: Curated collection of confirmed exoplanets, false positives, and candidates.

## How to Run

### 1. Start the FastAPI Server
From `tasa-project/backend`:
```powershell
py -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger API docs will be available at: http://127.0.0.1:8000/docs

### 2. Start the Frontend (Vite)
From `tasa-project/site`:
```powershell
npm run dev
```
Open http://localhost:5173 to interact with the website and ML Discovery Lab!

## API Endpoints

- `GET /api/health` — Service and model health status.
- `GET /api/model/info` — Metadata, model parameters, and training metrics.
- `GET /api/samples` — Curated sample Kepler Objects of Interest.
- `POST /api/predict` — Predicts whether a candidate signal is a confirmed exoplanet or false positive.
  ```json
  {
    "koi_period": 129.94,
    "koi_duration": 4.10,
    "koi_depth": 500,
    "koi_prad": 1.17,
    "koi_model_snr": 35.8,
    "koi_steff": 3788
  }
  ```
