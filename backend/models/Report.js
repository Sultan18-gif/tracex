const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  caseId: String,

  walletAddress: String,

  riskLevel: String,

  findings: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Report", reportSchema);