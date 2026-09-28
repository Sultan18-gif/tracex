const fs = require('fs');
const path = require('path');

const riskPath = path.join(__dirname, '../../../data/fatf_risk_list.json');
let riskList = { high: [], watchlist: [], low: [] };

try {
  riskList = JSON.parse(fs.readFileSync(riskPath, 'utf-8'));
} catch (err) {
  console.warn('fatf_risk_list.json not found — jurisdictionRisk defaults to "low"');
}

function getJurisdictionRisk(countryCode) {
  if (!countryCode) return 'low';
  const code = countryCode.toUpperCase();
  if (riskList.high.includes(code)) return 'high';
  if (riskList.watchlist.includes(code)) return 'watchlist';
  return 'low';
}

module.exports = { getJurisdictionRisk };