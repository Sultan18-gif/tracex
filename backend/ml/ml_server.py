"""HTTP service for the supplied wallet-risk models.

Run from backend/ml with: uvicorn ml_server:app --host 127.0.0.1 --port 8000
"""

from fastapi import FastAPI
from pydantic import BaseModel

try:
    from .predictor import model_status, predict_risk
except ImportError:
    from predictor import model_status, predict_risk


app = FastAPI(title="Chain Sentry AI Risk Engine", version="1.0")


class WalletFeatures(BaseModel):
    tx_count: float = 0
    incoming_tx_count: float = 0
    outgoing_tx_count: float = 0
    total_received: float = 0
    total_sent: float = 0
    unique_counterparties: float = 0
    avg_transaction_value: float = 0
    max_transaction_value: float = 0
    wallet_age_days: float = 0
    dormant_days: float = 0
    sanction_exposure: float = 0
    mixer_exposure: float = 0
    phishing_exposure: float = 0
    drainer_exposure: float = 0
    dex_ratio: float = 0
    defi_ratio: float = 0
    cex_ratio: float = 0
    rapid_transfer_ratio: float = 0
    fan_in: float = 0
    fan_out: float = 0


@app.get("/")
def root():
    return {"service": "Chain Sentry AI/ML Risk Engine", "status": "online"}


@app.get("/health")
def health():
    return model_status()


@app.post("/predict")
def predict(features: WalletFeatures):
    return predict_risk(features.model_dump())
