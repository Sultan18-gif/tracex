// backend/server.js  

const express = require("express");  
const cors = require("cors");  
const fs = require("fs");
const path = require("path");
require("dotenv").config();  
const { db, configurationError } = require("./firebase");
  
const app = express();  
  
// Middleware  
app.use(cors());  
app.use(express.json());  
  
// Backend health check.
app.get("/api/health", async (req, res) => {
  if (!db) {
    return res.status(503).json({
      message: "Crypto Fraud Investigation Backend is running",
      firebase: "not_configured",
      details: configurationError,
    });
  }

  try {
    // Force a harmless read so this endpoint checks Firestore access, not
    // merely whether the Firebase Admin SDK initialized.
    await db.collection("_health_check").limit(1).get();
    return res.json({
      message: "Crypto Fraud Investigation Backend is running",
      firebase: "connected",
    });
  } catch (error) {
    console.error("Firestore health check failed:", error);
    return res.status(503).json({
      message: "Crypto Fraud Investigation Backend is running",
      firebase: "unavailable",
      error: error.code || "firestore_request_failed",
    });
  }
});  

// Let the API and health check start without Firebase credentials, while
// returning an actionable response from endpoints that require Firestore.
app.use(["/api/wallets", "/api/cases", "/api/vasps"], (req, res, next) => {
  if (db) return next();
  return res.status(503).json({
    error: "Firestore is unavailable. Configure a valid Firebase service-account key.",
    details: configurationError,
  });
});
  
// Routes  
const walletRoutes = require("./routes/walletRoutes");  
const transactionRoutes = require("./routes/transactionRoutes");  
const caseRoutes = require("./routes/caseRoutes");  
const reportRoutes = require("./routes/reportRoutes");  
const vaspRoutes = require("./routes/vaspRoutes");  

// WebAuthn routes
const webauthnRoutes = require("./routes/webauthnRoutes");  
  
app.use("/api/wallets", walletRoutes);  
app.use("/api/transactions", transactionRoutes);  
app.use("/api/cases", caseRoutes);  
app.use("/api/reports", reportRoutes);  
app.use("/api/vasps", vaspRoutes);  

// WebAuthn
app.use("/api/webauthn", webauthnRoutes);  

// Serve the Vite production build from this same public origin when deployed.
const frontendDist = path.resolve(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDist, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}
  
// Server port  
const PORT = process.env.PORT || 5001;  
  
app.listen(PORT, () => {  
  console.log(`Server running on http://localhost:${PORT}`);  
});
