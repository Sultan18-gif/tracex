// backend/routes/walletRoutes.js
const express = require("express");
const { analyzeWallet, getWallets } = require("../controllers/walletController");

const router = express.Router();

// GET /api/wallets - Fetch all analyzed wallets
router.get("/", getWallets);

// POST /api/wallets/analyze - Analyze and save a new wallet address
router.post("/analyze", analyzeWallet);

module.exports = router;