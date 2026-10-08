const { db } = require("../firebase");
const { getWalletTransactions } = require("../services/blockchain/transactionService");

/*
  Calculate wallet risk from real transaction statistics.
*/
const calculateRiskScore = (
  txCount,
  totalEth,
  zeroValueTxCount
) => {
  let score = 0;

  // Transaction activity
  if (txCount > 1000) {
    score += 30;
  } else if (txCount > 200) {
    score += 15;
  }

  // Zero-value transactions
  if (zeroValueTxCount > 50) {
    score += 40;
  } else if (zeroValueTxCount > 10) {
    score += 20;
  }

  // Total ETH transferred
  if (totalEth > 100) {
    score += 30;
  }

  score = Math.min(score, 100);

  let level = "Low";

  if (score >= 70) {
    level = "Critical";
  } else if (score >= 40) {
    level = "High";
  } else if (score >= 20) {
    level = "Medium";
  }

  return {
    score,
    level,
  };
};


/*
  POST /api/wallets/analyze

  Analyze a wallet using Etherscan transaction data.
*/
const analyzeWallet = async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({
      error: "Wallet address is required",
    });
  }

  try {
    const normalizedAddress =
      walletAddress.trim().toLowerCase();

    // Use the shared Etherscan V2 client. The previous V1 request is retired
    // and can return a 500 even when the transaction endpoint succeeds.
    const txs = await getWalletTransactions(normalizedAddress, "ETH");

    /*
      Transaction statistics
    */
    const txCount = txs.length;

    const zeroValueTxs = txs.filter(
      (tx) =>
        Number(tx.amount || 0) === 0
    ).length;

    const totalEth = txs.reduce(
      (total, tx) => total + (Number.isFinite(Number(tx.amount)) ? Number(tx.amount) : 0),
      0
    );

    /*
      Calculate risk
    */
    const risk = calculateRiskScore(
      txCount,
      totalEth,
      zeroValueTxs
    );

    /*
      Unique counterparties
    */
    const counterparties = new Set();

    txs.forEach((tx) => {
      if (tx.sender) {
        counterparties.add(
          tx.sender.toLowerCase()
        );
      }

      if (tx.receiver) {
        counterparties.add(
          tx.receiver.toLowerCase()
        );
      }
    });

    /*
      Wallet analysis result
    */
    const walletData = {
      address: normalizedAddress,

      txCount,

      zeroValueTxs,

      totalEthTransacted:
        totalEth.toFixed(4),

      uniqueCounterparties:
        counterparties.size,

      riskScore: risk.score,

      riskLevel: risk.level,

      analyzedAt:
        new Date().toISOString(),
    };

    /*
      Save investigation to Firebase
    */
    let id = null;
    let persisted = false;
    if (db) {
      const docRef = await db.collection("tracked_wallets").add(walletData);
      id = docRef.id;
      persisted = true;
    }

    return res.status(200).json({
      id,
      ...walletData,
      persisted,
      message: persisted
        ? "Wallet analyzed and saved successfully"
        : "Wallet analyzed. Firebase persistence is not configured.",
    });

  } catch (error) {
    console.error(
      "Wallet Analysis Error:",
      error.response?.data ||
        error.message
    );

    return res.status(error.statusCode || 500).json({
      error: error.message || "Failed to analyze wallet address",
    });
  }
};


/*
  GET /api/wallets
*/
const getWallets = async (req, res) => {
  try {
    const snapshot = await db
      .collection("tracked_wallets")
      .get();

    const wallets = snapshot.docs.map(
      (doc) => ({
        id: doc.id,
        ...doc.data(),
      })
    );

    return res.json(wallets);

  } catch (error) {
    console.error(
      "Get Wallets Error:",
      error.message
    );

    return res.status(500).json({
      error: error.message,
    });
  }
};


module.exports = {
  analyzeWallet,
  getWallets,
};
