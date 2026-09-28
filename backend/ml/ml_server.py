from fastapi import FastAPI
from pydantic import BaseModel

try:
    # Works when imported as ml.ml_server from the backend project.
    from .feature_engineering import build_features
    from .fraud_model import predict
except ImportError:
    # Vercel builds this service with backend/ml as its project root.
    from feature_engineering import build_features
    from fraud_model import predict


app = FastAPI(title="Chain Sentry ML Engine")


class TransactionRequest(BaseModel):
    transactions: list


@app.get("/")
def root():
    return {
        "message": "Chain Sentry ML Engine is running"
    }


@app.post("/predict")
def predict_wallet(data: TransactionRequest):
    features = build_features(data.transactions)

    result = predict(features)

    return {
        "anomaly": result["anomaly"],
        "score": result["score"],
        "features": {
            "transactionCount": features[0],
            "totalValue": features[1],
            "uniqueReceivers": features[2],
            "averageTransactionValue": features[3],
            "zeroValueTransactions": features[4],
            "rapidTransactions": features[5],
            "mixerInteractions": features[6],
            "bridgeInteractions": features[7],
            "intermediaryHops": features[8],
        }
    }
