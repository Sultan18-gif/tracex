// Detect observable interactions with known
// privacy-enhancing / mixer-related addresses.
//
// This does NOT attempt to break privacy mechanisms.
// It only flags known addresses or observable patterns.

const KNOWN_PRIVACY_SERVICES = {
  // Add verified addresses here.
  //
  // "0xaddress": {
  //   name: "Known Privacy Service",
  //   type: "Mixer"
  // }
};

function normalize(address) {
  return String(address || "").trim().toLowerCase();
}

function detectPrivacyInteraction(transaction) {
  const receiver = normalize(
    transaction.receiver ||
    transaction.to ||
    transaction.destination
  );

  const sender = normalize(
    transaction.sender ||
    transaction.from ||
    transaction.source
  );

  const addressesToCheck = [sender, receiver].filter(Boolean);

  for (const address of addressesToCheck) {
    const service = KNOWN_PRIVACY_SERVICES[address];

    if (service) {
      return {
        detected: true,
        service: service.name,
        type: service.type,
        matchedAddress: address
      };
    }
  }

  // Existing demo/rule-based detection
  if (
    receiver.includes("tornado") ||
    receiver.includes("mixer") ||
    receiver.includes("privacy")
  ) {
    return {
      detected: true,
      service: "Detected Privacy/Mixer Pattern",
      type: "Privacy Service",
      matchedAddress: receiver
    };
  }

  return {
    detected: false,
    service: null,
    type: null,
    matchedAddress: null
  };
}

function analyzePrivacyTransactions(transactions) {
  const interactions = [];

  for (const tx of transactions || []) {
    const result = detectPrivacyInteraction(tx);

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
  detectPrivacyInteraction,
  analyzePrivacyTransactions
};