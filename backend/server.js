const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const {
  db,
  configurationError,
} = require("./firebase");

const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
  if (!db) {
    return res.status(503).json({
      message:
        "Crypto Fraud Investigation Backend is running",
      firebase: "not_configured",
      details: configurationError,
    });
  }

  try {
    await db
      .collection("_health_check")
      .limit(1)
      .get();

    return res.json({
      message:
        "Crypto Fraud Investigation Backend is running",
      firebase: "connected",
    });
  } catch (error) {
    console.error(
      "Firestore health check failed:",
      error
    );

    return res.status(503).json({
      message:
        "Crypto Fraud Investigation Backend is running",
      firebase: "unavailable",
      error:
        error.code ||
        "firestore_request_failed",
    });
  }
});

/* =========================================================
   FIREBASE DEPENDENT ROUTES
========================================================= */

app.use(
  [
    "/api/cases",
    "/api/vasps",
    "/api/reports",
  ],
  (req, res, next) => {
    if (db) {
      return next();
    }

    return res.status(503).json({
      error:
        "Firestore is unavailable. Configure a valid Firebase service-account key.",
      details: configurationError,
    });
  }
);

/* =========================================================
   ROUTES
========================================================= */

const walletRoutes =
  require("./routes/walletRoutes");

const transactionRoutes =
  require("./routes/transactionRoutes");

const caseRoutes =
  require("./routes/caseRoutes");

const reportRoutes =
  require("./routes/reportRoutes");

const vaspRoutes =
  require("./routes/vaspRoutes");

const webauthnRoutes =
  require("./routes/webauthnRoutes");
  console.log("Firebase module resolution check:");

try {
  console.log(
    "Firebase path:",
    require.resolve("./firebase.js")
  );
} catch (error) {
  console.error(
    "Firebase module cannot be resolved:",
    error.message
  );
}

/* API routes */

app.use(
  "/api/wallets",
  walletRoutes
);

app.use(
  "/api/transactions",
  transactionRoutes
);

app.use(
  "/api/cases",
  caseRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

app.use(
  "/api/vasps",
  vaspRoutes
);

app.use(
  "/api/webauthn",
  webauthnRoutes
);

/* =========================================================
   SERVE REACT FRONTEND
========================================================= */

const frontendDist = path.resolve(
  __dirname,
  "../frontend/dist"
);

if (fs.existsSync(frontendDist)) {
  console.log(
    `Serving frontend from: ${frontendDist}`
  );

  app.use(
    express.static(frontendDist)
  );

  /*
     React Router fallback.

     Any request that isn't an API request
     gets the React index.html.
  */

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api/")
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        frontendDist,
        "index.html"
      ),
      (error) => {
        if (error) {
          next(error);
        }
      }
    );
  });
} else {
  console.warn(
    `Frontend build not found: ${frontendDist}`
  );

  console.warn(
    "Run 'npm run build' inside the frontend directory before starting the production server."
  );
}

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      error: "Route not found",
      path: req.originalUrl,
    });
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      error:
        "Internal server error",
      message:
        error.message ||
        "Unknown server error",
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

const PORT =
  process.env.PORT || 5001;

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      " TraceX Crypto Fraud Investigation"
    );
    console.log(
      "=========================================="
    );
    console.log(
      ` Server: http://localhost:${PORT}`
    );
    console.log(
      ` Frontend: http://localhost:${PORT}`
    );
    console.log(
      ` API: http://localhost:${PORT}/api`
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);