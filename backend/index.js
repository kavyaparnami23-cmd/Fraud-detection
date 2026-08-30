require("dotenv").config();
const express = require("express");
const cors = require("cors");
const passport = require("passport");

const connectDB = require("./models/db");

const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transaction");

const app = express();

/* DB */
connectDB();

/* Middleware */
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(passport.initialize());

/* Routes */
app.use("/auth", authRoutes);
app.use("/api/transaction", transactionRoutes);

app.get("/", (_, res) => res.send("Backend running"));

app.listen(5000, () =>
  console.log("Backend running on port 5000")
);
