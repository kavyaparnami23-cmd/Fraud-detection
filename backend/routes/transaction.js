const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");
const Transaction = require("../models/transaction");
const auth = require("../middleware/middleware");

const router = express.Router();

const requiredFields = [
  "transaction_amount",
  "account_age",
  "transaction_type",
  "time_of_transaction",
  "device_used",
  "location",
  "payment_method",
  "number_of_transactions_last_24h",
  "previous_fraudulent_transactions",
];

const transactionTypeOptions = [
  "ATM Withdrawal",
  "Bank Transfer",
  "Bill Payment",
  "Online Purchase",
  "POS Payment",
];
const deviceOptions = ["Desktop", "Mobile", "Tablet", "Unknown"];
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
  "Unknown",
];

const simulations = new Map();

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** JWT can carry `id` as string; Mongo may store userId as ObjectId or string — match both. */
function transactionUserScope(userFromJwt) {
  const raw = userFromJwt?.id ?? userFromJwt?._id ?? userFromJwt?.userId;
  if (raw == null || raw === "") {
    return { $expr: { $eq: [1, 0] } };
  }
  const str = String(raw).trim();
  if (mongoose.Types.ObjectId.isValid(str) && new mongoose.Types.ObjectId(str).toString() === str) {
    const oid = new mongoose.Types.ObjectId(str);
    return { userId: { $in: [oid, str] } };
  }
  return { userId: str };
}

function normalizeUserIdForStorage(userFromJwt) {
  const raw = userFromJwt?.id ?? userFromJwt?._id ?? userFromJwt?.userId;
  if (raw == null || raw === "") return null;
  const str = String(raw).trim();
  if (mongoose.Types.ObjectId.isValid(str) && new mongoose.Types.ObjectId(str).toString() === str) {
    return new mongoose.Types.ObjectId(str);
  }
  return str;
}

function normalizePayload(input) {
  const missing = requiredFields.filter((field) => input[field] === undefined || input[field] === "");
  if (missing.length > 0) {
    return {
      error: {
        error: "Missing required fields",
        missing_fields: missing,
      },
    };
  }

  const payload = {
    transaction_amount: Number(input.transaction_amount),
    account_age: Number(input.account_age),
    number_of_transactions_last_24h: Number(input.number_of_transactions_last_24h),
    previous_fraudulent_transactions: Number(input.previous_fraudulent_transactions),
    transaction_type: String(input.transaction_type),
    time_of_transaction: String(input.time_of_transaction),
    device_used: String(input.device_used),
    location: String(input.location),
    payment_method: String(input.payment_method),
  };

  const numericFields = [
    "transaction_amount",
    "account_age",
    "number_of_transactions_last_24h",
    "previous_fraudulent_transactions",
  ];

  for (const field of numericFields) {
    if (Number.isNaN(payload[field])) {
      return {
        error: {
          error: `Invalid numeric value for field ${field}`,
        },
      };
    }
  }

  return { payload };
}

async function scoreAndPersistTransaction({ payload, userId, source = "manual", simulationId = null }) {
  const startedAt = Date.now();
  const mlResponse = await axios.post(process.env.ML_SERVICE_URL, payload);
  const {
    prediction = 0,
    fraud_probability = 0,
    supervised_probability = fraud_probability,
    anomaly_score = 0,
    final_score = fraud_probability,
    risk_level = "Low",
    alert_triggered = false,
    reason_codes = [],
  } = mlResponse.data || {};

  const transaction = await Transaction.create({
    transactionId: crypto.randomUUID(),
    userId,
    source,
    simulationId,
    model_input: payload,
    prediction,
    fraud_score: fraud_probability,
    supervised_score: supervised_probability,
    anomaly_score,
    final_score,
    risk_level,
    alert_triggered,
    reason_codes,
    processing_latency_ms: Date.now() - startedAt,
  });

  return {
    transaction,
    response: {
      id: transaction._id,
      transaction_id: transaction.transactionId,
      prediction,
      fraud_probability,
      supervised_probability,
      anomaly_score,
      final_score,
      risk_level,
      alert_triggered,
      reason_codes,
      createdAt: transaction.createdAt,
    },
  };
}

function buildSyntheticTransaction(forceHighRisk = false) {
  const riskyAmount = 3000 + Math.random() * 5000;
  const normalAmount = 20 + Math.random() * 2500;
  const manyTransactions = Math.floor(18 + Math.random() * 20);
  const fewTransactions = Math.floor(Math.random() * 8);
  const priorFraud = Math.floor(2 + Math.random() * 5);

  return {
    transaction_amount: Number((forceHighRisk ? riskyAmount : normalAmount).toFixed(2)),
    account_age: forceHighRisk
      ? Math.floor(1 + Math.random() * 12)
      : Math.floor(12 + Math.random() * 120),
    transaction_type: forceHighRisk ? pickRandom(["ATM Withdrawal", "Online Purchase"]) : pickRandom(transactionTypeOptions),
    time_of_transaction: String(forceHighRisk ? pickRandom(["0", "1", "2", "3", "4", "23"]) : Math.floor(Math.random() * 24)),
    device_used: forceHighRisk ? pickRandom(["Unknown", "Mobile"]) : pickRandom(deviceOptions),
    location: pickRandom(locationOptions),
    payment_method: forceHighRisk ? pickRandom(["Unknown", "Credit Card"]) : pickRandom(paymentOptions),
    number_of_transactions_last_24h: forceHighRisk ? manyTransactions : fewTransactions,
    previous_fraudulent_transactions: forceHighRisk ? priorFraud : Math.floor(Math.random() * 2),
  };
}

/** Server-side random pressure for synthetic “fraud-like” traffic each tick (not user-controlled). */
function sampleRandomFraudPressure() {
  return 0.1 + Math.random() * 0.55;
}

async function runSimulation({ simulationId, userId, count, durationSeconds }) {
  const job = simulations.get(simulationId);
  if (!job) {
    return;
  }

  const intervalMs = Math.max(150, Math.floor((durationSeconds * 1000) / count));

  const timer = setInterval(async () => {
    const state = simulations.get(simulationId);
    if (!state) {
      clearInterval(timer);
      return;
    }

    if (state.processed >= state.total) {
      state.status = "completed";
      state.completedAt = new Date();
      clearInterval(timer);
      return;
    }

    try {
      const forceHighRisk = Math.random() < sampleRandomFraudPressure();
      const payload = buildSyntheticTransaction(forceHighRisk);
      const { response } = await scoreAndPersistTransaction({
        payload,
        userId,
        source: "simulation",
        simulationId,
      });

      state.processed += 1;
      if (response.prediction === 1) {
        state.flagged += 1;
      }
      if (response.alert_triggered) {
        state.alerts += 1;
      }
      state.lastEventAt = response.createdAt;
    } catch (error) {
      state.processed += 1;
      state.failures += 1;
      state.lastError = error.response?.data?.error || error.message;
    }

    if (state.processed >= state.total) {
      state.status = "completed";
      state.completedAt = new Date();
      clearInterval(timer);
    }
  }, intervalMs);

  job.timer = timer;
}

router.post("/", auth, async (req, res) => {
  const { payload, error } = normalizePayload(req.body);
  if (error) {
    return res.status(400).json(error);
  }

  try {
    const { response } = await scoreAndPersistTransaction({
      payload,
      userId: normalizeUserIdForStorage(req.user),
      source: "manual",
    });

    return res.json(response);
  } catch (requestError) {
    const statusCode = requestError.response?.status || 500;
    const details = requestError.response?.data || { error: "ML service unavailable" };
    return res.status(statusCode).json(details);
  }
});

router.get("/history", auth, async (req, res) => {
  const limit = clamp(Number(req.query.limit) || 50, 1, 250);

  const transactions = await Transaction.find(transactionUserScope(req.user))
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return res.json(
    transactions.map((tx) => ({
      id: tx._id,
      transaction_id: tx.transactionId,
      source: tx.source,
      simulation_id: tx.simulationId,
      prediction: tx.prediction,
      fraud_probability: tx.fraud_score,
      supervised_probability: tx.supervised_score,
      anomaly_score: tx.anomaly_score,
      final_score: tx.final_score,
      risk_level: tx.risk_level,
      alert_triggered: tx.alert_triggered,
      reason_codes: tx.reason_codes || [],
      processing_latency_ms: tx.processing_latency_ms,
      amount: tx.model_input?.transaction_amount,
      location: tx.model_input?.location,
      payment_method: tx.model_input?.payment_method,
      transaction_type: tx.model_input?.transaction_type,
      createdAt: tx.createdAt,
    }))
  );
});

router.get("/stats", auth, async (req, res) => {
  try {
  const scope = transactionUserScope(req.user);
  const defaultLimit = 3000;
  const maxLimit = 10000;
  const limit = clamp(Number(req.query.limit) || defaultLimit, 1, maxLimit);

  const [totalInDatabase, transactions] = await Promise.all([
    Transaction.countDocuments(scope),
    Transaction.find(scope).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);

  const amounts = transactions
    .map((tx) => tx.model_input?.transaction_amount)
    .filter((n) => n != null && !Number.isNaN(Number(n)));
  const totals = {
    total_transactions: transactions.length,
    fraudulent_transactions: transactions.filter((tx) => tx.prediction === 1).length,
    high_risk_transactions: transactions.filter((tx) => tx.risk_level === "High").length,
    medium_risk_transactions: transactions.filter((tx) => tx.risk_level === "Medium").length,
    manual_transactions: transactions.filter((tx) => tx.source === "manual").length,
    simulation_transactions: transactions.filter((tx) => tx.source === "simulation").length,
    alerts_triggered: transactions.filter((tx) => tx.alert_triggered).length,
    average_fraud_score: transactions.length
      ? Number(
          (
            transactions.reduce((sum, tx) => sum + (tx.final_score ?? tx.fraud_score ?? 0), 0) /
            transactions.length
          ).toFixed(4)
        )
      : 0,
    average_transaction_amount: amounts.length
      ? Number((amounts.reduce((sum, n) => sum + Number(n), 0) / amounts.length).toFixed(2))
      : 0,
  };

  const risk_distribution = [
    { label: "Low", value: transactions.filter((tx) => tx.risk_level === "Low").length },
    { label: "Medium", value: transactions.filter((tx) => tx.risk_level === "Medium").length },
    { label: "High", value: transactions.filter((tx) => tx.risk_level === "High").length },
  ];

  const byField = (fieldName, maxEntries = 20) => {
    const counts = new Map();
    for (const tx of transactions) {
      const key = tx.model_input?.[fieldName] || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, maxEntries);
  };

  const ordered = [...transactions].reverse();

  function buildActivityBuckets(chrono) {
    if (chrono.length === 0) return [];
    const bucketCount = Math.min(14, Math.max(4, Math.ceil(chrono.length / 12)));
    const size = Math.ceil(chrono.length / bucketCount);
    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      const slice = chrono.slice(i * size, (i + 1) * size);
      if (!slice.length) break;
      buckets.push({
        count: slice.length,
        fraud: slice.filter((t) => t.prediction === 1).length,
      });
    }
    return buckets;
  }

  const sparkLen = Math.min(150, Math.max(24, ordered.length));
  const fraud_scores = ordered
    .slice(-sparkLen)
    .map((tx) => Number((tx.final_score ?? tx.fraud_score ?? 0).toFixed(4)));
  const activity_buckets = buildActivityBuckets(ordered);

  const uidForJob = normalizeUserIdForStorage(req.user);
  const simulation_status = [...simulations.values()]
    .filter((job) => String(job.userId) === String(uidForJob ?? req.user.id))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, 5)
    .map((job) => ({
      simulation_id: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      flagged: job.flagged,
      alerts: job.alerts,
      failures: job.failures,
      duration_seconds: job.durationSeconds,
      startedAt: job.startedAt,
      completedAt: job.completedAt || null,
      lastError: job.lastError || null,
    }));

  return res.json({
    totals: {
      ...totals,
      fraud_rate: totals.total_transactions
        ? Number((totals.fraudulent_transactions / totals.total_transactions).toFixed(4))
        : 0,
    },
    meta: {
      total_in_database: totalInDatabase,
      analytics_sample_size: transactions.length,
      analytics_limit_requested: limit,
    },
    charts: {
      risk_distribution,
      by_location: byField("location"),
      by_payment_method: byField("payment_method"),
      by_transaction_type: byField("transaction_type"),
      kpi_series: {
        fraud_scores,
        activity_buckets,
      },
    },
    simulation_status,
  });
  } catch (e) {
    console.error("GET /stats error:", e);
    return res.status(500).json({ error: "Failed to load stats", message: e.message });
  }
});

router.post("/simulate", auth, async (req, res) => {
  const count = clamp(Number(req.body.count) || 100, 10, 1000);
  const durationSeconds = clamp(Number(req.body.durationSeconds) || 120, 10, 600);

  const simulationId = crypto.randomUUID();
  const job = {
    id: simulationId,
    userId: normalizeUserIdForStorage(req.user) ?? req.user.id,
    status: "running",
    total: count,
    processed: 0,
    flagged: 0,
    alerts: 0,
    failures: 0,
    durationSeconds,
    startedAt: new Date(),
  };

  simulations.set(simulationId, job);
  runSimulation({
    simulationId,
    userId: normalizeUserIdForStorage(req.user) ?? req.user.id,
    count,
    durationSeconds,
  });

  return res.status(202).json({
    simulation_id: simulationId,
    status: "running",
    total: count,
    duration_seconds: durationSeconds,
    fraud_mix: "server_random",
  });
});

router.get("/simulate/:id", auth, async (req, res) => {
  const job = simulations.get(req.params.id);

  const uid = normalizeUserIdForStorage(req.user) ?? req.user.id;
  if (!job || String(job.userId) !== String(uid)) {
    return res.status(404).json({ error: "Simulation not found" });
  }

  return res.json({
    simulation_id: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    flagged: job.flagged,
    alerts: job.alerts,
    failures: job.failures,
    duration_seconds: job.durationSeconds,
    startedAt: job.startedAt,
    completedAt: job.completedAt || null,
    lastError: job.lastError || null,
  });
});

module.exports = router;
