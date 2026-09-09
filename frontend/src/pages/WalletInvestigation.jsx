import { useState } from "react";


const demoWallet = {
  address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  label: "Lazarus Group Suspect #4",
  balance: "1,420.5 ETH ($4.82M)",
  network: "Ethereum Mainnet",
  firstSeen: "2024-03-12",
  lastActive: "12 mins ago",
  riskScore: 98,
  tags: ["Tornado.Cash Depositor", "OFAC Sanctioned", "Phishing Drainer"],
  exposure: [
    { label: "Sanctioned mixers (Tornado)", pct: 58, color: "high" },
    { label: "DEX / DeFi pools", pct: 27, color: "info" },
    { label: "CEX off-ramps", pct: 15, color: "low" },
  ],
};

export default function WalletInvestigation() {
  const [address, setAddress] = useState(demoWallet.address);

  return (
    <div className="cs-page">
      <div className="cs-page-header">
        <h1>Deep wallet forensics &amp; risk score</h1>
        <p>Inspect address history, sanctions status, connected counterparties, and mixer exposure.</p>
      </div>

      <div className="cs-search-bar">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter EVM or Solana address (0x...)"
        />
        <button className="cs-primary-btn">Run deep analysis</button>
      </div>

      <div className="cs-inspector-grid">
        <section className="cs-panel">
          <div className="cs-inspector-top">
            <span className="cs-table-muted">Target address label</span>
            <span className="cs-badge cs-badge-high">Critical</span>
          </div>

          <h2 className="cs-inspector-name">{demoWallet.label}</h2>
          <p
  className="cs-badge-high"
  style={{ fontSize: "12px", margin: "4px 0 20px" }}
>{demoWallet.address}</p>

          <div className="cs-inspector-fields">
            <div><span>Portfolio balance</span><strong>{demoWallet.balance}</strong></div>
            <div><span>Blockchain network</span><strong>{demoWallet.network}</strong></div>
            <div><span>First interaction</span><strong>{demoWallet.firstSeen}</strong></div>
            <div><span>Last active</span><strong>{demoWallet.lastActive}</strong></div>
          </div>

          <div className="cs-tag-row">
            {demoWallet.tags.map((tag) => (
              <span className="cs-tag-pill" key={tag}>{tag}</span>
            ))}
          </div>
        </section>

        <section className="cs-panel">
          <p className="cs-panel-subtext" style={{ marginBottom: "4px" }}>OFAC / AML risk index</p>
          <div className="cs-risk-score">
            <span>{demoWallet.riskScore}</span>
            <span className="cs-risk-score-max">/ 100</span>
          </div>
          <p className="cs-badge-high" style={{ fontSize: "12px", margin: "4px 0 20px" }}>
            High threat: severe exposure to sanctioned mixers and illicit drainer contracts.
          </p>

          <p className="cs-panel-subtext" style={{ marginBottom: "8px" }}>Counterparty exposure breakdown</p>
          {demoWallet.exposure.map((row) => (
            <div className="cs-exposure-row" key={row.label}>
              <div className="cs-exposure-label">
                <span>{row.label}</span>
                <span>{row.pct}%</span>
              </div>
              <div className="cs-exposure-track">
                <div className={`cs-exposure-fill cs-exposure-${row.color}`} style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}

          <div className="cs-inspector-actions">
            <button className="cs-secondary-btn">Graph connections</button>
            <button className="cs-secondary-btn">Generate audit</button>
          </div>
        </section>

        <section className="cs-panel">
          <p className="cs-panel-subtext" style={{ marginBottom: "12px" }}>Investigative actions</p>
          <div className="cs-action-list">
            <button className="cs-action-row">
              <div>
                <p className="cs-row-title">Issue subpoena request</p>
                <p className="cs-row-subtext">Target Binance &amp; Kraken KYC off-ramps</p>
              </div>
              <span>›</span>
            </button>
            <button className="cs-action-row">
              <div>
                <p className="cs-row-title">Add to blacklist alerting</p>
                <p className="cs-row-subtext">Receive real-time push alerts on fund movement</p>
              </div>
              <span>›</span>
            </button>
            <button className="cs-action-row">
              <div>
                <p className="cs-row-title">Export raw transaction data</p>
                <p className="cs-row-subtext">Download formatted CSV / JSON for court filing</p>
              </div>
              <span>›</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}