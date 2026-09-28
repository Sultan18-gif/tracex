import os
import joblib
import numpy as np

from sklearn.ensemble import IsolationForest

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "model.pkl"
)


def create_training_data():
    """
    Creates synthetic NORMAL wallet behaviour for the demo model.

    This is only a demo training dataset.
    It should NOT be presented as real-world fraud training data.
    """

    rng = np.random.default_rng(42)

    samples = 1000

    data = np.column_stack([
        rng.poisson(25, samples),             # transaction count
        rng.gamma(2, 5, samples),             # total value
        rng.poisson(8, samples),              # unique receivers
        rng.normal(2, 1, samples).clip(0),    # average transaction value
        rng.poisson(1, samples),              # zero value transactions
        rng.poisson(2, samples),              # rapid transactions
        rng.poisson(1, samples),              # mixer interactions
        rng.poisson(1, samples),              # bridge interactions
        rng.poisson(2, samples),              # intermediary hops
    ])

    return data


def train_model():

    training_data = create_training_data()

    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42
    )

    model.fit(training_data)

    joblib.dump(model, MODEL_PATH)

    print("ML model trained successfully.")
    print(f"Model saved to: {MODEL_PATH}")


def predict(features):
    if not os.path.exists(MODEL_PATH):
        train_model()

    model = joblib.load(MODEL_PATH)

    values = np.array(features, dtype=float).reshape(1, -1)

    prediction = model.predict(values)[0]
    raw_score = model.decision_function(values)[0]

    ml_score = int(np.clip(50 - (raw_score * 100), 0, 100))

    return {
        "anomaly": bool(prediction == -1),
        "score": int(ml_score)
    }

if __name__ == "__main__":
    train_model()