const tagLabel = {
  mixer: "Mixer",
  cex: "CEX",
  bridge: "Bridge",
};

const tagClass = {
  mixer: "cs-badge-high",
  cex: "cs-badge-medium",
  bridge: "cs-badge-info",
};

export default function TransactionTable({ transactions = [], onInspect }) {
  if (!transactions.length) {
    return <p className="cs-table-muted">No transactions to display.</p>;
  }

  return (
    <table className="cs-table">
      <thead>
        <tr>
          <th>Txn hash</th>
          <th>Timestamp</th>
          <th>Flow path</th>
          <th>Value</th>
          <th>Risk tag</th>
          <th style={{ textAlign: "right" }}>Inspect</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.hash}>
            <td className="cs-table-mono cs-table-link">{tx.hash}</td>
            <td className="cs-table-muted">{tx.time}</td>
            <td className="cs-table-mono">
              {tx.from} <span className="cs-table-arrow">→</span> {tx.to}
            </td>
            <td className="cs-table-mono">{tx.value}</td>
            <td>
              <span className={`cs-badge ${tagClass[tx.tag] || "cs-badge-neutral"}`}>
                {tagLabel[tx.tag] || tx.tag}
              </span>
            </td>
            <td style={{ textAlign: "right" }}>
              <button className="cs-link-btn" onClick={() => onInspect?.(tx)}>
                View
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}