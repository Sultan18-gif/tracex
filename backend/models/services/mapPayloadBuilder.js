const { getJurisdictionRisk } = require('./jurisdictionRisk');

function buildMapPayload(traceResult, victimCountry) {
  const base = {
    status: traceResult.status,
    victimCountry,
    confidence: traceResult.confidence || 0
  };

  if (traceResult.status !== 'matched' || !traceResult.exchangeMatch) {
    return { ...base, exchangeCountry: null, riskTier: null };
  }

  const { exchangeCountry } = traceResult.exchangeMatch;

  return {
    ...base,
    exchangeName: traceResult.exchangeMatch.exchangeName,
    exchangeCountry,
    riskTier: getJurisdictionRisk(exchangeCountry)
  };
}

module.exports = { buildMapPayload };