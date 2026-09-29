const axios = require("axios");

async function getWalletTransactions(address, chain) {
  if (!address) {
    throw new Error("Wallet address is required");
  }

  switch (chain) {
    case "ETH":
      return getEthereumTransactions(address);

    case "BTC":
      throw new Error("Bitcoin integration is not configured yet");

    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

async function getEthereumTransactions(address) {
  if (!process.env.ETHERSCAN_API_KEY) {
    const error = new Error("Ethereum transaction lookup is not configured. Add ETHERSCAN_API_KEY to the Vercel project environment variables and redeploy.");
    error.statusCode = 503;
    throw error;
  }

  const response = await axios.get("https://api.etherscan.io/v2/api", {
    params: {
      chainid: "1",
      module: "account",
      action: "txlist",
      address,
      startblock: 0,
      endblock: 999999999,
      page: 1,
      offset: 100,
      sort: "desc",
      apikey: process.env.ETHERSCAN_API_KEY,
    },
  });

  const data = response.data;

  if (data.status !== "1") {
    if (
      data.message &&
      data.message.toLowerCase().includes("no transactions")
    ) {
      return [];
    }

    const error = new Error(data.result || data.message || "Etherscan API error");
    error.statusCode = 502;
    throw error;
  }

  return data.result.map((tx) => ({
    sender: tx.from,
    receiver: tx.to,
    amount: Number(tx.value) / 1e18,
    hash: tx.hash,
    currency: "ETH",
    timestamp: Number(tx.timeStamp),
    blockNumber: Number(tx.blockNumber),
    gas: tx.gas,
    gasPrice: tx.gasPrice,
    gasUsed: tx.gasUsed,
    status: tx.isError === "0" ? "Success" : "Failed",
  }));
}

async function getBitcoinTransactions(address) {
  throw new Error("Bitcoin integration is not configured yet");
}

module.exports = {
  getWalletTransactions,
};
