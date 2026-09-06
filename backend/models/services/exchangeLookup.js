const fs = require('fs');
const path = require('path');

const labelsPath = path.join(__dirname, '../../../data/exchange_labels.json');
let exchangeLabels = {};

try {
  exchangeLabels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
} catch (err) {
  console.warn('exchange_labels.json not found — exchangeLookup will return no matches');
}

function isMixerAddress(address) {
  const knownMixers = (exchangeLabels.__mixers || []);
  return knownMixers.includes(address.toLowerCase());
}

function lookupExchange(address) {
  const entry = exchangeLabels[address.toLowerCase()];
  if (!entry) return null;
  return {
    exchangeName: entry.exchangeName,
    exchangeCountry: entry.country,
    depositWalletLabel: entry.label
  };
}

module.exports = { lookupExchange, isMixerAddress };