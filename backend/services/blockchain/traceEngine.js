const {
  getWalletTransactions
} = require('./transactionService');

const MAX_HOPS = 5;

async function traceWallet(wallet, chain) {
  const visited = new Set();
  const path = [];

  let currentWallet = wallet;
  let currentChain = chain;
  let hops = 0;

  while (hops < MAX_HOPS) {

    // Prevent tracing the same wallet repeatedly
    const visitKey = `${currentChain}:${currentWallet}`;

    if (visited.has(visitKey)) {
      return {
        status: 'depth_limit_reached',
        hops,
        path,
        clusterIds: [],
        confidence: 0.5
      };
    }

    visited.add(visitKey);
    path.push(currentWallet);

    const transactions = await getWalletTransactions(
      currentWallet,
      currentChain
    );

    if (!transactions || transactions.length === 0) {
      return {
        status: 'depth_limit_reached',
        hops,
        path,
        clusterIds: [],
        confidence: 0.3
      };
    }

    // Find the next destination wallet
    const nextTransaction = findNextTransaction(
      transactions,
      currentWallet
    );

    if (!nextTransaction) {
      return {
        status: 'depth_limit_reached',
        hops,
        path,
        clusterIds: [],
        confidence: 0.4
      };
    }

    currentWallet = nextTransaction.to;

    // Detect chain change
    if (nextTransaction.chain) {
      currentChain = nextTransaction.chain;
    }

    hops++;
  }

  return {
    status: 'depth_limit_reached',
    hops,
    path,
    clusterIds: [],
    confidence: 0.5
  };
}

function findNextTransaction(transactions, currentWallet) {

  const outgoing = transactions.filter(
    tx =>
      tx.from &&
      tx.from.toLowerCase() === currentWallet.toLowerCase() &&
      tx.to
  );

  if (outgoing.length === 0) {
    return null;
  }

  // For initial implementation,
  // follow the largest outgoing transfer.
  return outgoing.sort(
    (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
  )[0];
}

module.exports = {
  traceWallet
};