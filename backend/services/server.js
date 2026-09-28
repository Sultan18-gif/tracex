// backend/server.js

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

console.log("🔥 THIS IS THE CHAIN SENTRY SERVER.JS");

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Crypto Fraud Investigation Backend is running"
  });
});

// Routes
const walletRoutes = require("./routes/walletRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const caseRoutes = require("./routes/caseRoutes");
const reportRoutes = require("./routes/reportRoutes");
const vaspRoutes = require("./routes/vaspRoutes");

const webauthnRoutes = require("./routes/webauthnRoutes");

console.log("✅ WebAuthn routes loaded");

// Mount routes
app.use("/api/wallets", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/vasps", vaspRoutes);

app.use("/api/webauthn", webauthnRoutes);

// Server
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});