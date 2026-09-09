import { useState } from "react";

export default function Transactions() {
  const [showFilters, setShowFilters] = useState(false);
  const [transactions, setTransactions] = useState([
    {
      id: "0x8f2a...3c91",
      time: "12 mins ago",
      flow: "0x71C7...976F → Tornado.Cash",
      value: "100.0 ETH",
      risk: "Mixer",
      riskClass: "cs-badge-high",
    },
    {
      id: "0x1a4b...9d22",
      time: "34 mins ago",
      flow: "0x1a4b...9f66 → Binance Hot 8",
      value: "45.0 ETH",
      risk: "CEX",
      riskClass: "cs-badge-medium",
    },
    {
      id: "0x9c88...1e44",
      time: "1 hr ago",
      flow: "0x71C7...976F → Stargate Router",
      value: "250,000 USDC",
      risk: "Bridge",
      riskClass: "cs-badge-info",
    },
  ]);

  const handleLoadMore = () => {
    setTransactions((current) => [
      ...current,
      {
        id: "0xa821...7b32",
        time: "2 hrs ago",
        flow: "0x92AB...112F → Uniswap",
        value: "75.5 ETH",
        risk: "DEX",
        riskClass: "cs-badge-neutral",
      },
      {
        id: "0xb431...8ca1",
        time: "3 hrs ago",
        flow: "0x31EF...88AC → Bridge",
        value: "120,000 USDC",
        risk: "Bridge",
        riskClass: "cs-badge-medium",
      },
    ]);
  };

  return (
    <div className="cs-page">

      {/* Page Header */}
      <div className="cs-page-header">
        <h1>Transaction hop tracer</h1>
        <p>
          Multi-hop ledger tracking mapping fund movements and cross-chain
          bridging activity.
        </p>
      </div>

      {/* Filters */}
      <div className="cs-search-bar">
        <button
          className="cs-primary-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          ⚙ Filters
        </button>
      </div>

      {showFilters && (
        <div className="cs-panel">
          <div className="cs-panel-header">
            <h2>Transaction filters</h2>
            <span>Live monitoring</span>
          </div>

          <div className="cs-search-bar">
            <input
              type="text"
              placeholder="Search transaction or wallet address..."
            />
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="cs-stat-grid">

        <div className="cs-stat-card">
          <div className="cs-stat-label">
            Transactions monitored
          </div>
          <div className="cs-stat-value">
            1,842
          </div>
          <div className="cs-stat-trend">
            +126 in the last 24 hours
          </div>
        </div>

        <div className="cs-stat-card">
          <div className="cs-stat-label">
            High-risk movements
          </div>
          <div className="cs-stat-value">
            378
          </div>
          <div className="cs-stat-trend">
            detected in the last hour
          </div>
        </div>

        <div className="cs-stat-card">
          <div className="cs-stat-label">
            Value tracked
          </div>
          <div className="cs-stat-value">
            $8.42M
          </div>
          <div className="cs-stat-trend">
            Across 14 monitored networks
          </div>
        </div>

        <div className="cs-stat-card">
          <div className="cs-stat-label">
            Cross-chain transfers
          </div>
          <div className="cs-stat-value">
            126
          </div>
          <div className="cs-stat-trend">
            23 active bridge movements
          </div>
        </div>

      </div>

      {/* Recent Activity */}
      <div className="cs-panel">

        <div className="cs-panel-header">
          <div>
            <h2>Recent transaction activity</h2>
            <p className="cs-panel-subtext">
              Monitor suspicious transfers and follow the movement of funds
              between addresses and services.
            </p>
          </div>

          <span>Live monitoring</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="cs-table">

            <thead>
              <tr>
                <th>Transaction</th>
                <th>Timestamp</th>
                <th>Flow path</th>
                <th>Value</th>
                <th>Risk tag</th>
                <th>Inspect</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction, index) => (
                <tr key={`${transaction.id}-${index}`}>

                  <td className="cs-table-mono">
                    {transaction.id}
                  </td>

                  <td className="cs-table-muted">
                    {transaction.time}
                  </td>

                  <td>
                    <span className="cs-table-mono">
                      {transaction.flow}
                    </span>
                  </td>

                  <td className="cs-table-mono">
                    {transaction.value}
                  </td>

                  <td>
                    <span className={`cs-badge ${transaction.riskClass}`}>
                      {transaction.risk}
                    </span>
                  </td>

                  <td>
                    <button className="cs-link-btn">
                      View details
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>

        {/* Footer */}
        <div className="cs-table-footer">
          <span className="cs-table-muted">
            Showing {transactions.length} of 1,842 monitored transactions
          </span>

          <button
            className="cs-primary-btn"
            onClick={handleLoadMore}
            style={{ marginLeft: "12px" }}
          >
            Load more transactions
          </button>
        </div>

      </div>

    </div>
  );
}