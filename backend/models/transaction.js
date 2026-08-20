const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    index: true,
  },
  userId: mongoose.Schema.Types.ObjectId,
  source: {
    type: String,
    default: "manual",
  },
  simulationId: String,
  model_input: {
    transaction_amount: Number,
    account_age: Number,
    transaction_type: String,
    time_of_transaction: String,
    device_used: String,
    location: String,
    payment_method: String,
    number_of_transactions_last_24h: Number,
    previous_fraudulent_transactions: Number,
  },
  prediction: Number,
  fraud_score: Number,
  supervised_score: Number,
  anomaly_score: Number,
  final_score: Number,
  risk_level: String,
  alert_triggered: {
    type: Boolean,
    default: false,
  },
  reason_codes: {
    type: [String],
    default: [],
  },
  processing_latency_ms: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);
