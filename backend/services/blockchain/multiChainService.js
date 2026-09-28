const SUPPORTED_CHAINS = {
  ETH: {
    name: 'Ethereum',
    type: 'evm'
  },

  BNB: {
    name: 'BNB Chain',
    type: 'evm'
  },

  POLYGON: {
    name: 'Polygon',
    type: 'evm'
  },

  ARBITRUM: {
    name: 'Arbitrum',
    type: 'evm'
  },

  BASE: {
    name: 'Base',
    type: 'evm'
  },

  BTC: {
    name: 'Bitcoin',
    type: 'bitcoin'
  }
};

function isSupportedChain(chain) {
  return Boolean(SUPPORTED_CHAINS[chain]);
}

function getChainInfo(chain) {
  return SUPPORTED_CHAINS[chain] || null;
}

module.exports = {
  SUPPORTED_CHAINS,
  isSupportedChain,
  getChainInfo
};