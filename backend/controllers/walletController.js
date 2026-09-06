// backend/controllers/walletController.js
const axios = require("axios");
const { db } = require("../firebase");

// Utility function to calculate wallet risk score
const calculateRiskScore = (txCount, totalEth, zeroValueTxCount) => {
  let score = 0;

  if (txCount > 1000) score += 30;
  else if (txCount > 200) score += 15;

  if (zeroValueTxCount > 50) score += 40;
  else if (zeroValueTxCount > 10) score += 20;

  if (totalEth > 100) score += 30;

  if (score >= 70) return "Critical";
  if (score >= 40) return "High";
  if (score >= 20) return "Medium";
  return "Low";
};

// POST /api/wallets/analyze
const analyzeWallet = async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Wallet address is required" });
  }

  try {
    const apiKey = process.env.ETHERSCAN_API_KEY || "YourApiKeyToken";
    const etherscanUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${apiKey}`;

    const response = await axios.get(etherscanUrl);
    const txs = response.data.result || [];

    const txCount = Array.isArray(txs) ? txs.length : 0;
    const zeroValueTxs = Array.isArray(txs)
      ? txs.filter((tx) => tx.value === "0").length
      : 0;

    const totalWei = Array.isArray(txs)
      ? txs.reduce((acc, tx) => acc + BigInt(tx.value || 0), BigInt(0))
      : BigInt(0);
    const totalEth = Number(totalWei) / 1e18;

    const riskScore = calculateRiskScore(txCount, totalEth, zeroValueTxs);

    const walletData = {
      address: walletAddress.toLowerCase(),
      txCount,
      zeroValueTxs,
      totalEthTransacted: totalEth.toFixed(4),
      riskScore,
      analyzedAt: new Date().toISOString(),
    };

    const docRef = await db.collection("tracked_wallets").add(walletData);

    res.status(200).json({
      id: docRef.id,
      ...walletData,
      message: "Wallet analyzed and saved successfully",
    });
  } catch (error) {
    console.error("Wallet Analysis Error:", error.message);
    res.status(500).json({ error: "Failed to analyze wallet address" });
  }
};

// GET /api/wallets
const getWallets = async (req, res) => {
  try {
    const snapshot = await db.collection("tracked_wallets").get();
    const wallets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(wallets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  analyzeWallet,
  getWallets,
};