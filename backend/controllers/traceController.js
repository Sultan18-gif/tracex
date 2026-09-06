const TraceResult = require('../models/TraceResult');
const Report = require('../models/Report');
const { traceWallet } = require('../models/services/traceEngine');
const { buildMapPayload } = require('../models/services/mapPayloadBuilder');
const { getJurisdictionRisk } = require('../models/services/jurisdictionRisk');

async function runTrace(req, res) {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const { wallet, chain, country } = report;
    const traceResult = await traceWallet(wallet, chain);

    const saved = await TraceResult.create({
      reportId: report._id,
      reportedWallet: wallet,
      chain,
      victimCountry: country,
      status: traceResult.status,
      hops: traceResult.hops,
      path: traceResult.path,
      clusterIds: traceResult.clusterIds,
      confidence: traceResult.confidence,
      exchangeName: traceResult.exchangeMatch?.exchangeName,
      exchangeCountry: traceResult.exchangeMatch?.exchangeCountry,
      depositWalletLabel: traceResult.exchangeMatch?.depositWalletLabel,
      jurisdictionRiskTier: traceResult.exchangeMatch
        ? getJurisdictionRisk(traceResult.exchangeMatch.exchangeCountry)
        : undefined
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error('runTrace error:', err);
    res.status(500).json({ error: 'Trace failed' });
  }
}

async function getMapData(req, res) {
  try {
    const trace = await TraceResult.findById(req.params.id);
    if (!trace) return res.status(404).json({ error: 'Trace result not found' });

    const payload = buildMapPayload(
      {
        status: trace.status,
        confidence: trace.confidence,
        exchangeMatch: trace.exchangeCountry
          ? { exchangeName: trace.exchangeName, exchangeCountry: trace.exchangeCountry }
          : null
      },
      trace.victimCountry
    );

    res.json(payload);
  } catch (err) {
    console.error('getMapData error:', err);
    res.status(500).json({ error: 'Could not load map data' });
  }
}

module.exports = { runTrace, getMapData };