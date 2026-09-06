const axios = require('axios');
const { clusterAddresses } = require('./clustering');
const { lookupExchange, isMixerAddress } = require('./exchangeLookup');

const MAX_DEPTH = 12;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

async function getOutgoingTransactions(address, chain) {
  if (chain !== 'ETH') {
    throw new Error(`getOutgoingTransactions not implemented for chain: ${chain}`);
  }

  const url = 'https://api.etherscan.io/api';
  const { data } = await axios.get(url, {
    params: {
      module: 'account',
      action: 'txlist',
      address,
      sort: 'asc',
      apikey: ETHERSCAN_API_KEY
    }
  });

  if (data.status !== '1' || !Array.isArray(data.result)) return [];

  return data.result
    .filter(tx => tx.from.toLowerCase() === address.toLowerCase() && tx.to)
    .map(tx => ({
      to: tx.to.toLowerCase(),
      from: tx.from.toLowerCase(),
      value: tx.value,
      hash: tx.hash,
      inputAddresses: [tx.from.toLowerCase()]
    }));
}

async function traceWallet(reportedWallet, chain, maxDepth = MAX_DEPTH) {
  const start = reportedWallet.toLowerCase();
  const queue = [{ address: start, depth: 0, path: [] }];
  const visited = new Set([start]);
  const allTxs = [];

  while (queue.length > 0) {
    const { address, depth, path } = queue.shift();
    const currentPath = [...path, address];

    if (isMixerAddress(address)) {
      return buildResult('mixer_terminated', currentPath, allTxs, depth, null);
    }

    const exchangeMatch = lookupExchange(address);
    if (exchangeMatch) {
      return buildResult('matched', currentPath, allTxs, depth, exchangeMatch);
    }

    if (depth >= maxDepth) continue;

    let outgoing = [];
    try {
      outgoing = await getOutgoingTransactions(address, chain);
    } catch (err) {
      console.error(`Trace fetch failed at ${address}:`, err.message);
      continue;
    }

    allTxs.push(...outgoing);

    for (const tx of outgoing) {
      if (!visited.has(tx.to)) {
        visited.add(tx.to);
        queue.push({ address: tx.to, depth: depth + 1, path: currentPath });
      }
    }
  }

  return buildResult('depth_limit_reached', [start], allTxs, maxDepth, null);
}

function buildResult(status, path, allTxs, hops, exchangeMatch) {
  const clusters = clusterAddresses(allTxs);
  const relevantCluster = clusters.find(c => c.members.includes(path[path.length - 1]));

  return {
    status,
    hops,
    path,
    clusterIds: relevantCluster ? [relevantCluster.clusterId] : [],
    confidence: status === 'matched' ? Math.max(0.5, 1 - hops * 0.05) : 0,
    exchangeMatch
  };
}

module.exports = { traceWallet };