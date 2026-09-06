const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  hash: String,

  sender: String,

  receiver: String,

  amount: Number,

  blockchain: String,

  timestamp: Date
});

module.exports = mongoose.model(
  "Transaction",
  transactionSchema
);