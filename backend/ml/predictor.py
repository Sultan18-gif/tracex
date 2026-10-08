"""Inference wrapper for the supplied fraud and anomaly models."""

from pathlib import Path

import joblib
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

FEATURES = [
    "tx_count", "incoming_tx_count", "outgoing_tx_count", "total_received",
    "total_sent", "unique_counterparties", "avg_transaction_value",
    "max_transaction_value", "wallet_age_days", "dormant_days",
    "sanction_exposure", "mixer_exposure", "phishing_exposure",
    "drainer_exposure", "dex_ratio", "defi_ratio", "cex_ratio",
    "rapid_transfer_ratio", "fan_in", "fan_out",
]


def _load_models():
    fraud_path = MODEL_DIR / "fraud_model.pkl"
    anomaly_path = MODEL_DIR / "anomaly_model.pkl"
    missing = [path.name for path in (fraud_path, anomaly_path) if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing trained model file(s): {', '.join(missing)}")
    return joblib.load(fraud_path), joblib.load(anomaly_path)


fraud_model, anomaly_model = _load_models()
# The supplied estimators were trained with parallel workers enabled. Keep
# inference single-threaded so the API also works in constrained deployments.
fraud_model.n_jobs = 1
anomaly_model.n_jobs = 1


def predict_risk(features):
    row = {}
    for feature in FEATURES:
        value = float(features.get(feature, 0) or 0)
        # Models must never receive NaN or infinite values from an upstream
        # transaction provider. Treat invalid observations as unavailable.
        row[feature] = value if pd.notna(value) and value not in (float("inf"), float("-inf")) else 0.0
    values = pd.DataFrame([row], columns=FEATURES)

    fraud_classes = list(fraud_model.classes_)
    fraud_probability = float(fraud_model.predict_proba(values)[0][fraud_classes.index(1)])
    anomaly_prediction = anomaly_model.predict(values)[0]
    anomaly_score = 1.0 if anomaly_prediction == -1 else 0.0

    ml_score = fraud_probability * 75 + anomaly_score * 25
    aml_bonus = (
        row["sanction_exposure"] * 25
        + row["mixer_exposure"] * 20
        + row["phishing_exposure"] * 15
        + row["drainer_exposure"] * 15
    )
    final_score = min(100, (ml_score + aml_bonus) * 10)
    risk_level = "Critical" if final_score >= 80 else "High" if final_score >= 60 else "Medium" if final_score >= 35 else "Low"

    reasons = []
    if row["sanction_exposure"] > 0.20: reasons.append("Significant exposure to sanctioned entities")
    if row["mixer_exposure"] > 0.20: reasons.append("High mixer-related transaction exposure")
    if row["phishing_exposure"] > 0.15: reasons.append("Connections associated with phishing activity")
    if row["drainer_exposure"] > 0.15: reasons.append("Potential crypto-drainer exposure detected")
    if row["rapid_transfer_ratio"] > 0.30: reasons.append("Rapid fund movement pattern detected")
    if row["fan_out"] > 100: reasons.append("High number of outgoing counterparties")
    if anomaly_prediction == -1: reasons.append("Transaction behavior is anomalous")
    if not reasons: reasons.append("No major high-risk behavioral indicator detected")

    return {
        "riskScore": round(final_score, 2),
        "riskLevel": risk_level,
        "mlFraudProbability": round(fraud_probability * 100, 2),
        "anomalyScore": round(anomaly_score * 100, 2),
        "modelConfidence": round(abs(fraud_probability - 0.5) * 200, 2),
        "reasons": reasons,
        "features": row,
    }


def model_status():
    """Small, non-sensitive readiness payload for service health checks."""
    return {
        "status": "ready",
        "featureCount": len(FEATURES),
        "fraudClassifier": type(fraud_model).__name__,
        "anomalyDetector": type(anomaly_model).__name__,
    }
