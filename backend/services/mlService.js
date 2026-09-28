const axios = require("axios");

// Vercel injects ML_SERVICE_URL through a private service binding in production.
// Keep the local URL as a fallback for running the Python ML server locally.
const ML_API_URL = (
  process.env.ML_SERVICE_URL ||
  process.env.ML_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

async function analyzeTransactionsWithML(transactions) {
  if (!Array.isArray(transactions)) {
    throw new Error("Transactions must be an array");
  }

  const response = await axios.post(
    `${ML_API_URL}/predict`,
    {
      transactions
    },
    {
      timeout: 10000
    }
  );

  return response.data;
}

module.exports = {
  analyzeTransactionsWithML
};
