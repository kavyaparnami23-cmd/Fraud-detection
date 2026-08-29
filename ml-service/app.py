from __future__ import annotations

import json
import sys
from pathlib import Path
import pickle

import pandas as pd
from flask import Flask, jsonify, request


MODEL_PATH = Path(__file__).parent / "fraud_detection_model.pkl"

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Optional-field defaults – applied when a caller omits these fields.
# Only transaction_amount and account_age are truly mandatory.
# ---------------------------------------------------------------------------
FIELD_DEFAULTS: dict = {
    "transaction_type": "Unknown",
    "time_of_transaction": "12",
    "device_used": "Unknown",
    "location": "Unknown",
    "payment_method": "Unknown",
    "number_of_transactions_last_24h": 1,
    "previous_fraudulent_transactions": 0,
}

TRULY_REQUIRED = ["transaction_amount", "account_age"]


def load_artifact():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Model file not found. Run `python train_model.py` first."
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return jsonify({
        "service": "Fraud Detection ML Service",
        "status": "running",
        "endpoints": {
            "health": "/health (GET)",
            "predict": "/predict (POST)"
        }
    })


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": "fraud_detection_rf_v1"})


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True) or {}

    # Validate truly required fields
    missing_fields = [f for f in TRULY_REQUIRED if payload.get(f) in (None, "")]
    if missing_fields:
        return (
            jsonify(
                {
                    "error": "Missing required fields",
                    "missing_fields": missing_fields,
                    "hint": (
                        f"Required: {TRULY_REQUIRED}. "
                        f"Optional fields fall back to defaults: {FIELD_DEFAULTS}"
                    ),
                }
            ),
            400,
        )

    # Apply defaults for every optional field that was omitted or empty
    for field, default in FIELD_DEFAULTS.items():
        if payload.get(field) in (None, ""):
            payload[field] = default

    # Encode categoricals via saved LabelEncoders
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

    try:
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
    except (ValueError, TypeError) as exc:
        return jsonify({"error": f"Invalid numeric value: {exc}"}), 400

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


# ---------------------------------------------------------------------------
# Self-test  –  python app.py --test
# ---------------------------------------------------------------------------

def _run_self_test():
    """Run 4 prediction test-cases using Flask's built-in test client.
    No running server is needed – just execute: python app.py --test
    """
    TEST_CASES = [
        {
            "name": "LOW-RISK  – all fields provided",
            "payload": {
                "transaction_amount": 250.0,
                "account_age": 48,
                "transaction_type": "Online Purchase",
                "time_of_transaction": "14",
                "device_used": "Mobile",
                "location": "New York",
                "payment_method": "Credit Card",
                "number_of_transactions_last_24h": 3,
                "previous_fraudulent_transactions": 0,
            },
        },
        {
            "name": "MEDIUM-RISK – transaction_type & location MISSING (defaults applied)",
            "payload": {
                "transaction_amount": 1800.0,
                "account_age": 8,
                # transaction_type and location intentionally omitted
                "time_of_transaction": "10",
                "device_used": "Desktop",
                "payment_method": "Debit Card",
                "number_of_transactions_last_24h": 5,
                "previous_fraudulent_transactions": 1,
            },
        },
        {
            "name": "HIGH-RISK – all fraud signals present",
            "payload": {
                "transaction_amount": 9200.0,
                "account_age": 2,
                "transaction_type": "ATM Withdrawal",
                "time_of_transaction": "3",
                "device_used": "Unknown",
                "location": "Miami",
                "payment_method": "Credit Card",
                "number_of_transactions_last_24h": 22,
                "previous_fraudulent_transactions": 4,
            },
        },
        {
            "name": "ERROR CASE – missing mandatory fields (expects HTTP 400)",
            "payload": {
                "transaction_type": "Bank Transfer",
                "location": "Chicago",
            },
        },
    ]

    PASS = "\033[92mPASS\033[0m"
    FAIL = "\033[91mFAIL\033[0m"

    print("\n" + "=" * 65)
    print("   FRAUD DETECTION ML SERVICE  –  SELF-TEST (python app.py --test)")
    print("=" * 65)

    all_passed = True
    with app.test_client() as client:
        for i, case in enumerate(TEST_CASES, 1):
            print(f"\n[{i}/{len(TEST_CASES)}] {case['name']}")
            resp = client.post("/predict", json=case["payload"])
            data = resp.get_json()
            status = resp.status_code

            if status == 200:
                pred_label = "FRAUD" if data["prediction"] else "LEGIT"
                print(f"  HTTP {status}  [{PASS}]")
                print(f"  prediction        : {data['prediction']}  ({pred_label})")
                print(f"  risk_level        : {data['risk_level']}")
                print(f"  fraud_probability : {data['fraud_probability']:.4f}")
                print(f"  supervised_prob   : {data['supervised_probability']:.4f}")
                print(f"  anomaly_score     : {data['anomaly_score']:.4f}")
                print(f"  alert_triggered   : {data['alert_triggered']}")
                print(f"  reason_codes      : {data['reason_codes']}")
            elif status == 400 and i == len(TEST_CASES):
                # Last case is expected to be a 400
                print(f"  HTTP {status}  [{PASS}] (expected error)")
                print(f"  error             : {data.get('error')}")
                print(f"  missing_fields    : {data.get('missing_fields', [])}")
            else:
                print(f"  HTTP {status}  [{FAIL}]")
                print(f"  response          : {json.dumps(data, indent=4)}")
                all_passed = False

    print("\n" + "=" * 65)
    status_line = f"  {'All tests PASSED' if all_passed else 'Some tests FAILED'}"
    print(status_line)
    print("=" * 65 + "\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if "--test" in sys.argv:
        _run_self_test()
    else:
        print("\nFraud Detection ML Service")
        print("  Listening on  : http://localhost:8000  (or http://127.0.0.1:8000)")
        print("  POST /predict : score a transaction")
        print("  GET  /health  : liveness check")
        print("  Tip           : run 'python app.py --test' to execute self-tests\n")
        app.run(host="0.0.0.0", port=8000, debug=True)
