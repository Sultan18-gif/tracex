// Detect known DeFi protocol interactions.
// This does NOT interact with DeFi protocols.
// It only identifies known contract addresses in transactions.

const KNOWN_DEFI_PROTOCOLS = {
  // Add verified protocol contract addresses here.
  // Example structure:
  //
  // "0xcontractaddress": {
  //   name: "Protocol Name",
  //   type: "DEX"
  // }
};

function normalize(address) {
  return String(address || "").trim().toLowerCase();
}

function detectDeFiInteraction(transaction) {
  const receiver = normalize(
    transaction.receiver ||
    transaction.to ||
    transaction.destination
  );

  if (!receiver) {
    return {
      detected: false,
      protocol: null,
      type: null
    };
  }

  const protocol = KNOWN_DEFI_PROTOCOLS[receiver];

  if (!protocol) {
    return {
      detected: false,
      protocol: null,
      type: null
    };
  }

  return {
    detected: true,
    protocol: protocol.name,
    type: protocol.type,
    contractAddress: receiver
  };
}

function analyzeDeFiTransactions(transactions) {
  const interactions = [];

  for (const tx of transactions || []) {
    const result = detectDeFiInteraction(tx);

    if (result.detected) {
      interactions.push({
        transactionHash:
          tx.hash ||
          tx.txHash ||
          tx.transactionHash ||
          null,
        ...result
      });
    }
  }

  return {
    detected: interactions.length > 0,
    count: interactions.length,
    interactions
  };
}

module.exports = {
  detectDeFiInteraction,
  analyzeDeFiTransactions
};