from __future__ import annotations

from pathlib import Path
import pickle

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


DATASET_PATH = Path(__file__).parent / "Fraud Detection Dataset.csv"
MODEL_PATH = Path(__file__).parent / "fraud_detection_model.pkl"

TARGET_COLUMN = "Fraudulent"
DROP_COLUMNS = ["Transaction_ID", "User_ID"]

CATEGORICAL_COLUMNS = [
    "Transaction_Type",
    "Time_of_Transaction",
    "Device_Used",
    "Location",
    "Payment_Method",
]

FEATURE_COLUMNS = [
    "Transaction_Amount",
    "Transaction_Type",
    "Time_of_Transaction",
    "Device_Used",
    "Location",
    "Previous_Fraudulent_Transactions",
    "Account_Age",
    "Number_of_Transactions_Last_24H",
    "Payment_Method",
]


def train_and_save_model() -> None:
    df = pd.read_csv(DATASET_PATH)
    df = df.drop(columns=DROP_COLUMNS, errors="ignore")

    # Match notebook behavior: LabelEncode categoricals after fillna("Unknown") + astype(str)
    label_encoders: dict[str, LabelEncoder] = {}
    for col in CATEGORICAL_COLUMNS:
        df[col] = df[col].fillna("Unknown").astype(str)
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        label_encoders[col] = le

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].copy()

    # Numeric columns may have missing values -> impute
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce")

    imputer = SimpleImputer(strategy="median")
    X_imputed = imputer.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_imputed,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    contamination = float(df[TARGET_COLUMN].mean()) if TARGET_COLUMN in df else 0.1
    contamination = min(max(contamination, 0.01), 0.25)
    anomaly_model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=200,
    )
    anomaly_model.fit(X_imputed)

    accuracy = model.score(X_test, y_test)

    artifact = {
        "model": model,
        "anomaly_model": anomaly_model,
        "imputer": imputer,
        "feature_columns": FEATURE_COLUMNS,
        "categorical_columns": CATEGORICAL_COLUMNS,
        "label_encoders": label_encoders,
        "accuracy": accuracy,
    }

    with MODEL_PATH.open("wb") as f:
        pickle.dump(artifact, f)

    print(f"Model trained and saved to: {MODEL_PATH}")
    print(f"Validation accuracy: {accuracy:.4f}")


if __name__ == "__main__":
    train_and_save_model()
