const {
  getWalletTransactions
} = require("./transactionService");

const {
  analyzeDeFiTransactions
} = require("./defiDetector");

const {
  analyzePrivacyTransactions
} = require("./privacyDetector");

async function traceAcrossChains(walletAddress, chains = ["ETH"]) {
  if (!walletAddress) {
    throw new Error("Wallet address is required");
  }

  const results = [];

  for (const chain of chains) {
    try {
      const transactions = await getWalletTransactions(
        walletAddress,
        chain
      );

      const defi = analyzeDeFiTransactions(transactions);

      const privacy =
        analyzePrivacyTransactions(transactions);

      results.push({
        chain,
        success: true,
        transactionCount: transactions.length,
        transactions,
        defi,
        privacy
      });

    } catch (error) {
      results.push({
        chain,
        success: false,
        transactionCount: 0,
        transactions: [],
        defi: {
          detected: false,
          count: 0,
          interactions: []
        },
        privacy: {
          detected: false,
          count: 0,
          interactions: []
        },
        error: error.message
      });
    }
  }

  const allTransactions = results.flatMap(
    result => result.transactions
  );

  return {
    walletAddress,
    chains,
    totalTransactions: allTransactions.length,
    chainResults: results,

    defiInteractions: results.flatMap(
      result => result.defi.interactions
    ),

    privacyInteractions: results.flatMap(
      result => result.privacy.interactions
    )
  };
}

module.exports = {
  traceAcrossChains
};