const {
  getWalletTransactions
} = require("../services/blockchain/transactionService");

const {
  analyzeTransactionsWithML
} = require("../services/mlService");

const {
  traceAcrossChains
} = require("../services/blockchain/multiChainTracer");


// =====================================================
// GET TRANSACTIONS
// Existing endpoint - keeps returning an array
// =====================================================

const getTransactions = async (req, res) => {
  try {
    const { address } = req.params;
    const chain = req.query.chain || "ETH";

    const transactions = await getWalletTransactions(
      address,
      chain
    );

    res.json(transactions);

  } catch (error) {
    console.error(
      "getTransactions error:",
      error
    );

    res.status(500).json({
      message: "Unable to fetch transactions",
      error: error.message
    });
  }
};


// =====================================================
// AI / ML TRANSACTION ANALYSIS
// POST /api/transactions/:address/analyze
// =====================================================

const analyzeTransactions = async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        message: "Wallet address is required"
      });
    }

    const chain = req.query.chain || "ETH";

    // Fetch real blockchain transactions
    const transactions = await getWalletTransactions(
      address,
      chain
    );

    // Send transactions to Python ML engine
    const mlAnalysis = await analyzeTransactionsWithML(
      transactions
    );

    res.json({
      walletAddress: address,
      chain,
      transactionCount: transactions.length,

      mlAnalysis,

      transactions
    });

  } catch (error) {
    console.error(
      "Transaction ML analysis error:",
      error
    );

    res.status(500).json({
      message: "Unable to perform ML transaction analysis",
      error: error.message
    });
  }
};


// =====================================================
// MULTI-CHAIN ANALYSIS
// =====================================================

const analyzeMultiChainTransactions = async (req, res) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        message: "Wallet address is required"
      });
    }

    const chainsParam = req.query.chains || "ETH";

    const chains = chainsParam
      .split(",")
      .map(chain => chain.trim().toUpperCase())
      .filter(Boolean);

    const result = await traceAcrossChains(
      address,
      chains
    );

    res.json(result);

  } catch (error) {
    console.error(
      "Multi-chain analysis error:",
      error
    );

    res.status(500).json({
      message: "Unable to perform multi-chain analysis",
      error: error.message
    });
  }
};


module.exports = {
  getTransactions,
  analyzeTransactions,
  analyzeMultiChainTransactions
};