"""
Train and export the exoplanet classification pipeline from cumulative.csv.
Uses the best Gradient Boosting Classifier parameters from Model.ipynb.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, roc_auc_score, accuracy_score

RANDOM_STATE = 42

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJ_ROOT = os.path.dirname(BASE_DIR)
DATA_PATH = os.path.join(PROJ_ROOT, "..", "cumulative.csv")
if not os.path.exists(DATA_PATH):
    DATA_PATH = os.path.join(BASE_DIR, "cumulative.csv")
    if not os.path.exists(DATA_PATH):
        DATA_PATH = "cumulative.csv"

print(f"Loading data from {DATA_PATH}...")
df = pd.read_csv(DATA_PATH)

# Remove CANDIDATE for training (target 1 = CONFIRMED, 0 = FALSE POSITIVE)
clean = df[df["koi_disposition"].isin(["CONFIRMED", "FALSE POSITIVE"])].copy()
clean["target"] = (clean["koi_disposition"] == "CONFIRMED").astype(int)

# Create derived astronomical categories
clean["type_orbite"] = pd.cut(clean["koi_period"], bins=[0, 10, 100, np.inf],
                              labels=["short", "medium", "long"]).astype(object)
clean["type_planete"] = pd.cut(clean["koi_prad"], bins=[0, 1.25, 2, 6, np.inf],
                               labels=["earth_like", "super_earth", "neptune_like", "jupiter_like"]).astype(object)
clean["type_etoile"] = pd.cut(clean["koi_steff"], bins=[0, 5200, 6000, np.inf],
                              labels=["cool", "sun_like", "hot"]).astype(object)
clean["luminosite"] = pd.cut(clean["koi_kepmag"], bins=[0, 13, 15, np.inf],
                             labels=["bright", "medium", "faint"]).astype(object)

main_num = ["koi_period", "koi_time0bk", "koi_impact", "koi_duration", "koi_depth",
            "koi_prad", "koi_teq", "koi_insol", "koi_model_snr",
            "koi_steff", "koi_slogg", "koi_srad", "koi_kepmag"]

log_cols = ["koi_period", "koi_duration", "koi_depth", "koi_prad", "koi_model_snr", "koi_insol"]
new_cats = ["type_orbite", "type_planete", "type_etoile", "luminosite"]

feature_cols = main_num + new_cats
X = clean[feature_cols]
y = clean["target"]

def make_preprocessor(num_cols, log_cols, cat_cols):
    plain_num = [c for c in num_cols if c not in log_cols]
    log_num   = [c for c in num_cols if c in log_cols]

    plain_pipe = Pipeline([("imputer", SimpleImputer(strategy="median")),
                           ("scaler", StandardScaler())])
    log_pipe   = Pipeline([("imputer", SimpleImputer(strategy="median")),
                           ("log", FunctionTransformer(np.log1p, feature_names_out="one-to-one")),
                           ("scaler", StandardScaler())])
    cat_pipe   = Pipeline([("imputer", SimpleImputer(strategy="most_frequent")),
                           ("onehot", OneHotEncoder(handle_unknown="ignore"))])

    return ColumnTransformer([("num", plain_pipe, plain_num),
                              ("lognum", log_pipe, log_num),
                              ("cat", cat_pipe, cat_cols)])

# Split to verify validation metrics
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)

# Best tuned parameters from notebook
gb_params = {
    "n_estimators": 487,
    "learning_rate": 0.0666,
    "max_depth": 5,
    "subsample": 0.7247,
    "random_state": RANDOM_STATE
}

pipeline = Pipeline([
    ("prep", make_preprocessor(main_num, log_cols, new_cats)),
    ("model", GradientBoostingClassifier(**gb_params))
])

print("Training pipeline on training split (80%)...")
pipeline.fit(X_train, y_train)

y_pred = pipeline.predict(X_test)
y_prob = pipeline.predict_proba(X_test)[:, 1]

acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc = roc_auc_score(y_test, y_prob)

print(f"Test Accuracy: {acc:.4f} (expected ~0.936)")
print(f"Test F1:       {f1:.4f} (expected ~0.898)")
print(f"Test AUC-ROC:  {auc:.4f} (expected ~0.978)")
print(classification_report(y_test, y_pred, target_names=["False Positive", "Confirmed"]))

# Train final production model on full dataset (7,316 samples) for best deployment generalization
print("Refitting final model on full verified dataset...")
final_pipeline = Pipeline([
    ("prep", make_preprocessor(main_num, log_cols, new_cats)),
    ("model", GradientBoostingClassifier(**gb_params))
])
final_pipeline.fit(X, y)

model_path = os.path.join(BASE_DIR, "model_pipeline.joblib")
joblib.dump(final_pipeline, model_path)
print(f"Model saved to {model_path}")

# Feature importances from final model
model_gb = final_pipeline.named_steps["model"]
prep_gb = final_pipeline.named_steps["prep"]
transformed_names = prep_gb.get_feature_names_out()
feat_importances = sorted(
    [{"feature": name, "importance": round(float(imp), 5)}
     for name, imp in zip(transformed_names, model_gb.feature_importances_)],
    key=lambda x: x["importance"], reverse=True
)

metadata = {
    "model_name": "Gradient Boosting Classifier",
    "params": gb_params,
    "metrics": {
        "test_accuracy": round(acc, 4),
        "test_f1": round(f1, 4),
        "test_auc_roc": round(auc, 4),
        "train_samples": len(clean),
        "confirmed_count": int(clean["target"].sum()),
        "false_positive_count": int((1 - clean["target"]).sum())
    },
    "features": {
        "raw_numeric": main_num,
        "log_transformed": log_cols,
        "derived_categories": new_cats
    },
    "top_importances": feat_importances[:10]
}

meta_path = os.path.join(BASE_DIR, "model_meta.json")
with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)
print(f"Metadata saved to {meta_path}")

# Export sample KOIs (curated subset of real Kepler objects including confirmed, false positive, and candidates)
sample_rows = []
for disposition in ["CONFIRMED", "FALSE POSITIVE", "CANDIDATE"]:
    sub = df[df["koi_disposition"] == disposition].dropna(subset=main_num)
    chosen = sub.head(15)
    for _, row in chosen.iterrows():
        sample_rows.append({
            "kepid": int(row["kepid"]) if pd.notnull(row["kepid"]) else None,
            "kepoi_name": str(row["kepoi_name"]),
            "kepler_name": str(row["kepler_name"]) if pd.notnull(row["kepler_name"]) else None,
            "actual_disposition": str(row["koi_disposition"]),
            "koi_period": float(row["koi_period"]) if pd.notnull(row["koi_period"]) else None,
            "koi_time0bk": float(row["koi_time0bk"]) if pd.notnull(row["koi_time0bk"]) else None,
            "koi_impact": float(row["koi_impact"]) if pd.notnull(row["koi_impact"]) else None,
            "koi_duration": float(row["koi_duration"]) if pd.notnull(row["koi_duration"]) else None,
            "koi_depth": float(row["koi_depth"]) if pd.notnull(row["koi_depth"]) else None,
            "koi_prad": float(row["koi_prad"]) if pd.notnull(row["koi_prad"]) else None,
            "koi_teq": float(row["koi_teq"]) if pd.notnull(row["koi_teq"]) else None,
            "koi_insol": float(row["koi_insol"]) if pd.notnull(row["koi_insol"]) else None,
            "koi_model_snr": float(row["koi_model_snr"]) if pd.notnull(row["koi_model_snr"]) else None,
            "koi_steff": float(row["koi_steff"]) if pd.notnull(row["koi_steff"]) else None,
            "koi_slogg": float(row["koi_slogg"]) if pd.notnull(row["koi_slogg"]) else None,
            "koi_srad": float(row["koi_srad"]) if pd.notnull(row["koi_srad"]) else None,
            "koi_kepmag": float(row["koi_kepmag"]) if pd.notnull(row["koi_kepmag"]) else None,
        })

samples_path = os.path.join(BASE_DIR, "sample_kois.json")
with open(samples_path, "w", encoding="utf-8") as f:
    json.dump(sample_rows, f, indent=2)
print(f"Exported {len(sample_rows)} sample KOIs to {samples_path}")
