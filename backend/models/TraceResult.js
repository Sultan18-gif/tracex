const mongoose = require('mongoose');

const TraceResultSchema = new mongoose.Schema({
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
  reportedWallet: { type: String, required: true },
  chain: {
  type: String,
  required: true
},
  victimCountry: { type: String, required: true },

  status: {
    type: String,
    enum: ['matched', 'mixer_terminated', 'depth_limit_reached', 'privacy_coin'],
    required: true
  },
  hops: { type: Number, default: 0 },
  path: [{ type: String }],
  clusterIds: [{ type: String }],
  confidence: { type: Number, min: 0, max: 1 },

  exchangeName: { type: String },
  exchangeCountry: { type: String },
  depositWalletLabel: { type: String },
  jurisdictionRiskTier: { type: String, enum: ['low', 'watchlist', 'high'] },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TraceResult', TraceResultSchema);