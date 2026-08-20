from __future__ import annotations

from pathlib import Path
import pickle

import pandas as pd
from flask import Flask, jsonify, request


MODEL_PATH = Path(__file__).parent / "fraud_detection_model.pkl"

app = Flask(__name__)


def load_artifact():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Model file not found. Run `python3 train_model.py` first."
        )
    with MODEL_PATH.open("rb") as f:
        return pickle.load(f)


artifact = load_artifact()
model = artifact["model"]
anomaly_model = artifact.get("anomaly_model")
imputer = artifact["imputer"]
feature_columns = artifact["feature_columns"]
categorical_columns = set(artifact.get("categorical_columns", []))
label_encoders = artifact.get("label_encoders", {})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}

    required_fields = [
        "transaction_amount",
        "account_age",
        "transaction_type",
        "time_of_transaction",
        "device_used",
        "location",
        "payment_method",
        "number_of_transactions_last_24h",
        "previous_fraudulent_transactions",
    ]

    missing_fields = [f for f in required_fields if payload.get(f) in (None, "")]
    if missing_fields:
        return (
            jsonify(
                {
                    "error": "Missing required fields",
                    "missing_fields": missing_fields,
                }
            ),
            400,
        )

    # Accept human labels for categoricals, encode using saved LabelEncoders.
    def encode(col_name: str, value):
        if col_name not in categorical_columns:
            return float(value)
        le = label_encoders.get(col_name)
        if le is None:
            return float(value)
        s = str(value) if value is not None else "Unknown"
        if s not in le.classes_:
            s = "Unknown" if "Unknown" in le.classes_ else le.classes_[0]
        return float(le.transform([s])[0])

    row = {
        "Transaction_Amount": float(payload["transaction_amount"]),
        "Account_Age": float(payload["account_age"]),
        "Number_of_Transactions_Last_24H": float(payload["number_of_transactions_last_24h"]),
        "Previous_Fraudulent_Transactions": float(payload["previous_fraudulent_transactions"]),
        "Transaction_Type": encode("Transaction_Type", payload["transaction_type"]),
        "Time_of_Transaction": encode("Time_of_Transaction", payload["time_of_transaction"]),
        "Device_Used": encode("Device_Used", payload["device_used"]),
        "Location": encode("Location", payload["location"]),
        "Payment_Method": encode("Payment_Method", payload["payment_method"]),
    }

    input_df = pd.DataFrame([row])[feature_columns]
    transformed = imputer.transform(input_df)

    supervised_probability = float(model.predict_proba(transformed)[0][1])
    model_prediction = int(model.predict(transformed)[0])

    anomaly_score = 0.0
    if anomaly_model is not None:
        raw_anomaly_score = float(anomaly_model.decision_function(transformed)[0])
        anomaly_score = max(0.0, min(1.0, (0.2 - raw_anomaly_score) / 0.4))

    reason_codes = []
    heuristic_score = 0.0
    if float(payload["transaction_amount"]) >= 3000:
        heuristic_score += 0.15
        reason_codes.append("high_amount")
    if float(payload["number_of_transactions_last_24h"]) >= 15:
        heuristic_score += 0.15
        reason_codes.append("high_velocity")
    if float(payload["previous_fraudulent_transactions"]) >= 2:
        heuristic_score += 0.2
        reason_codes.append("prior_fraud_history")
    if str(payload["device_used"]) == "Unknown":
        heuristic_score += 0.1
        reason_codes.append("unknown_device")
    if str(payload["time_of_transaction"]) in {"0", "1", "2", "3", "4", "23"}:
        heuristic_score += 0.05
        reason_codes.append("odd_transaction_hour")

    final_score = min(
        1.0,
        max(
            supervised_probability,
            (supervised_probability * 0.6) + (anomaly_score * 0.25) + heuristic_score,
        ),
    )

    prediction = int(final_score >= 0.5 or model_prediction == 1)
    alert_triggered = final_score >= 0.8

    risk_level = "Low"
    if final_score >= 0.8:
        risk_level = "High"
    elif final_score >= 0.45:
        risk_level = "Medium"

    return jsonify(
        {
            "prediction": prediction,
            "fraud_probability": final_score,
            "supervised_probability": supervised_probability,
            "anomaly_score": anomaly_score,
            "final_score": final_score,
            "risk_level": risk_level,
            "alert_triggered": alert_triggered,
            "reason_codes": reason_codes,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
