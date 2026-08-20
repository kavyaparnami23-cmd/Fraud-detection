import { useMemo, useState } from "react";
import api from "../api";

const initialForm = {
  transaction_amount: "",
  account_age: "",
  transaction_type: "",
  time_of_transaction: "",
  device_used: "",
  location: "",
  payment_method: "",
  number_of_transactions_last_24h: "",
  previous_fraudulent_transactions: "",
};

const numericFields = [
  { key: "transaction_amount", label: "Transaction amount", step: "0.01" },
  { key: "account_age", label: "Account age (months)" },
  {
    key: "number_of_transactions_last_24h",
    label: "Transactions (last 24h)",
  },
  {
    key: "previous_fraudulent_transactions",
    label: "Prior fraudulent txs",
  },
];

const transactionTypeOptions = [
  "ATM Withdrawal",
  "Bank Transfer",
  "Bill Payment",
  "Online Purchase",
  "POS Payment",
];

const deviceOptions = ["Desktop", "Mobile", "Tablet", "Unknown", "Unknown Device"];
const locationOptions = [
  "Boston",
  "Chicago",
  "Houston",
  "Los Angeles",
  "Miami",
  "New York",
  "San Francisco",
  "Seattle",
  "Unknown",
];
const paymentOptions = [
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "UPI",
  "Invalid Method",
  "Unknown",
];

const fieldClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--accent)]/25";

export default function TransactionForm({ onTransactionProcessed }) {
  const [formData, setFormData] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, h) => String(h)),
    []
  );

  const submitTransaction = async () => {
    try {
      setLoading(true);
      const payload = {
        ...formData,
        transaction_amount: Number(formData.transaction_amount),
        account_age: Number(formData.account_age),
        number_of_transactions_last_24h: Number(formData.number_of_transactions_last_24h),
        previous_fraudulent_transactions: Number(formData.previous_fraudulent_transactions),
      };
      const res = await api.post("/api/transaction", payload);
      setResult(res.data);
      setFormData(initialForm);
      onTransactionProcessed?.(res.data);
    } catch (err) {
      alert(err?.response?.data?.error || "Error submitting transaction");
    } finally {
      setLoading(false);
    }
  };

  const setField = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Manual scoring</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Score a single transaction and inspect hybrid output and reason codes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {numericFields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">
            {field.label}
            <input
              className={fieldClass}
              type="number"
              step={field.step || "1"}
              placeholder="0"
              value={formData[field.key]}
              onChange={setField(field.key)}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">
          Transaction type
          <select className={fieldClass} value={formData.transaction_type} onChange={setField("transaction_type")}>
            <option value="">Select…</option>
            {transactionTypeOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">
          Hour (0–23)
          <select className={fieldClass} value={formData.time_of_transaction} onChange={setField("time_of_transaction")}>
            <option value="">Select…</option>
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">
          Device
          <select className={fieldClass} value={formData.device_used} onChange={setField("device_used")}>
            <option value="">Select…</option>
            {deviceOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">
          Location
          <select className={fieldClass} value={formData.location} onChange={setField("location")}>
            <option value="">Select…</option>
            {locationOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">
          Payment method
          <select className={fieldClass} value={formData.payment_method} onChange={setField("payment_method")}>
            <option value="">Select…</option>
            {paymentOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={submitTransaction}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--accent-contrast)] shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Scoring…" : "Submit & score"}
      </button>

      {result && (
        <div className="mt-6 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4 text-sm">
          <p>
            <span className="text-[var(--muted)]">Prediction</span>{" "}
            <span className="font-semibold">{result.prediction === 1 ? "Fraudulent" : "Legitimate"}</span>
          </p>
          <p>
            <span className="text-[var(--muted)]">Fraud probability</span>{" "}
            <span className="font-semibold tabular-nums">{(result.fraud_probability * 100).toFixed(2)}%</span>
          </p>
          <p>
            <span className="text-[var(--muted)]">Supervised</span>{" "}
            <span className="font-semibold tabular-nums">
              {((result.supervised_probability ?? 0) * 100).toFixed(2)}%
            </span>
          </p>
          <p>
            <span className="text-[var(--muted)]">Anomaly</span>{" "}
            <span className="font-semibold tabular-nums">{((result.anomaly_score ?? 0) * 100).toFixed(2)}%</span>
          </p>
          <p>
            <span className="text-[var(--muted)]">Risk</span>{" "}
            <span className="font-semibold">{result.risk_level}</span>
          </p>
          {result.reason_codes?.length > 0 && (
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">Reasons: </span>
              {result.reason_codes.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
