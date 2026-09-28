const express = require("express");

const {
  getTransactions,
  analyzeTransactions,
  analyzeMultiChainTransactions
} = require("../controllers/transactionController");

const router = express.Router();


// ML analysis
router.post("/:address/analyze", analyzeTransactions);


// Multi-chain analysis
router.get("/:address/multi-chain", analyzeMultiChainTransactions);


// Normal transactions
router.get("/:address", getTransactions);


module.exports = router;