const axios = require("axios");

// Vercel injects ML_SERVICE_URL through a private service binding in production.
const ML_API_URL = (
  process.env.ML_SERVICE_URL ||
  process.env.ML_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

// Small, explicit attribution set for high-confidence demo/test detection.
// Unrecognised addresses remain unattributed; never infer an entity from an
// address pattern alone.
const ATTRIBUTED_ADDRESSES = {
  // Tornado Cash ETH 0.1 denomination pool.
  "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": "mixer",
  // Uniswap V2 Router 02.
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "dex",
};

function numericValue(transaction) {
  const value = Number(
    transaction?.amount ??
    transaction?.value ??
    transaction?.valueEth ??
    transaction?.ethValue ??
    0
  );
  return Number.isFinite(value) ? value : 0;
}

function transactionTime(transaction) {
  const value = Number(transaction?.timestamp ?? transaction?.timeStamp ?? 0);
  // Etherscan returns seconds; JavaScript dates use milliseconds.
  return Number.isFinite(value) && value > 0 ? value * 1000 : null;
}

function includesAny(value, terms) {
  const normalized = String(value || "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function buildWalletFeatures(transactions, walletAddress) {
  const wallet = String(walletAddress || "").toLowerCase();
  const rows = Array.isArray(transactions) ? transactions : [];
  const counterparties = new Set();
  const incomingCounterparties = new Set();
  const outgoingCounterparties = new Set();
  const timestamps = [];
  let incoming = 0;
  let outgoing = 0;
  let totalReceived = 0;
  let totalSent = 0;
  let maxValue = 0;
  let mixerInteractions = 0;
  let phishingInteractions = 0;
  let drainerInteractions = 0;
  let dexInteractions = 0;
  let defiInteractions = 0;
  let cexInteractions = 0;

  for (const transaction of rows) {
    const sender = String(transaction?.sender ?? transaction?.from ?? "").toLowerCase();
    const receiver = String(transaction?.receiver ?? transaction?.to ?? "").toLowerCase();
    const value = numericValue(transaction);
    const counterparty = sender === wallet ? receiver : sender;
    const joined = `${sender} ${receiver}`;
    const attribution = ATTRIBUTED_ADDRESSES[sender] || ATTRIBUTED_ADDRESSES[receiver];

    maxValue = Math.max(maxValue, value);
    if (counterparty) counterparties.add(counterparty);

    if (receiver === wallet) {
      incoming += 1;
      totalReceived += value;
      if (sender) incomingCounterparties.add(sender);
    }
    if (sender === wallet) {
      outgoing += 1;
      totalSent += value;
      if (receiver) outgoingCounterparties.add(receiver);
    }

    if (attribution === "mixer" || includesAny(joined, ["tornado", "mixer"])) mixerInteractions += 1;
    if (includesAny(joined, ["phish", "scam"])) phishingInteractions += 1;
    if (includesAny(joined, ["drainer", "drain"])) drainerInteractions += 1;
    if (attribution === "dex" || includesAny(joined, ["uniswap", "sushiswap", "pancakeswap", "dex"])) dexInteractions += 1;
    if (includesAny(joined, ["aave", "compound", "maker", "defi"])) defiInteractions += 1;
    if (includesAny(joined, ["binance", "coinbase", "kraken", "exchange"])) cexInteractions += 1;

    const time = transactionTime(transaction);
    if (time) timestamps.push(time);
  }

  timestamps.sort((a, b) => a - b);
  const rapidTransfers = timestamps.slice(1).filter((time, index) => time - timestamps[index] <= 60 * 60 * 1000).length;
  const latestTransaction = timestamps.at(-1);
  const earliestTransaction = timestamps[0];
  const now = Date.now();
  const count = rows.length;

  return {
    tx_count: count,
    incoming_tx_count: incoming,
    outgoing_tx_count: outgoing,
    total_received: totalReceived,
    total_sent: totalSent,
    unique_counterparties: counterparties.size,
    avg_transaction_value: count ? (totalReceived + totalSent) / count : 0,
    max_transaction_value: maxValue,
    wallet_age_days: earliestTransaction ? Math.max(1, (now - earliestTransaction) / 86400000) : 0,
    dormant_days: latestTransaction ? Math.max(0, (now - latestTransaction) / 86400000) : 0,
    sanction_exposure: 0,
    mixer_exposure: count ? mixerInteractions / count : 0,
    phishing_exposure: count ? phishingInteractions / count : 0,
    drainer_exposure: count ? drainerInteractions / count : 0,
    dex_ratio: count ? dexInteractions / count : 0,
    defi_ratio: count ? defiInteractions / count : 0,
    cex_ratio: count ? cexInteractions / count : 0,
    rapid_transfer_ratio: count ? rapidTransfers / count : 0,
    fan_in: incomingCounterparties.size,
    fan_out: outgoingCounterparties.size,
  };
}

async function analyzeTransactionsWithML(transactions, walletAddress) {
  if (!Array.isArray(transactions)) {
    throw new Error("Transactions must be an array");
  }

  const features = buildWalletFeatures(transactions, walletAddress);
  const response = await axios.post(`${ML_API_URL}/predict`, features, {
    timeout: 10000,
  });

  return response.data;
}

module.exports = {
  analyzeTransactionsWithML,
  buildWalletFeatures,
};
