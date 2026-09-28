const KNOWN_BRIDGES = [
  /*
    Add verified bridge contracts here.

    Example structure:

    {
      name: 'Bridge Name',
      chain: 'ETH',
      address: '0x...',
      destinationChain: 'BNB'
    }
  */
];

function detectBridge(transaction) {
  if (!transaction || !transaction.to || !transaction.chain) {
    return null;
  }

  const bridge = KNOWN_BRIDGES.find(
    item =>
      item.chain === transaction.chain &&
      item.address.toLowerCase() === transaction.to.toLowerCase()
  );

  if (!bridge) {
    return null;
  }

  return {
    detected: true,
    name: bridge.name,
    sourceChain: transaction.chain,
    destinationChain: bridge.destinationChain
  };
}

module.exports = {
  detectBridge
};