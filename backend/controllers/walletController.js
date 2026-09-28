const axios = require("axios");
const { db } = require("../firebase");

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

    const apiKey =
      process.env.ETHERSCAN_API_KEY ||
      "YourApiKeyToken";

    const etherscanUrl =
      `https://api.etherscan.io/api` +
      `?module=account` +
      `&action=txlist` +
      `&address=${encodeURIComponent(normalizedAddress)}` +
      `&startblock=0` +
      `&endblock=99999999` +
      `&page=1` +
      `&offset=100` +
      `&sort=desc` +
      `&apikey=${apiKey}`;

    const response = await axios.get(
      etherscanUrl
    );

    const txs = Array.isArray(response.data?.result)
      ? response.data.result
      : [];

    /*
      Transaction statistics
    */
    const txCount = txs.length;

    const zeroValueTxs = txs.filter(
      (tx) =>
        String(tx.value || "0") === "0"
    ).length;

    const totalWei = txs.reduce(
      (total, tx) => {
        try {
          return (
            total +
            BigInt(tx.value || "0")
          );
        } catch {
          return total;
        }
      },
      BigInt(0)
    );

    const totalEth =
      Number(totalWei) / 1e18;

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
      if (tx.from) {
        counterparties.add(
          tx.from.toLowerCase()
        );
      }

      if (tx.to) {
        counterparties.add(
          tx.to.toLowerCase()
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
    const docRef = await db
      .collection("tracked_wallets")
      .add(walletData);

    return res.status(200).json({
      id: docRef.id,
      ...walletData,

      message:
        "Wallet analyzed and saved successfully",
    });

  } catch (error) {
    console.error(
      "Wallet Analysis Error:",
      error.response?.data ||
        error.message
    );

    return res.status(500).json({
      error:
        "Failed to analyze wallet address",
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