const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true
  },

  blockchain: {
    type: String,
    required: true
  },

  riskLevel: {
    type: String,
    default: "Unknown"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Wallet", walletSchema);