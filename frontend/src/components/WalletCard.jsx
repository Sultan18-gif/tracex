export default function WalletCard({ wallet, onClick }) {
  if (!wallet) return null;

  const {
    name,
    address,
    riskScore,
    balance,
    network,
    lastActive,
  } = wallet;

  const riskClass =
    riskScore >= 80 ? "cs-badge-high" : riskScore >= 50 ? "cs-badge-medium" : "cs-badge-low";

  return (
    <div className="cs-row cs-wallet-row" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div>
        <div className="cs-row-title-line">
          <span className="cs-row-title">{name}</span>
          {typeof riskScore === "number" && (
            <span className={`cs-badge ${riskClass}`}>Risk score: {riskScore}/100</span>
          )}
        </div>
        <div className="cs-row-subtext">{address}</div>
      </div>

      {(balance || network || lastActive) && (
        <div className="cs-wallet-amount">
          {balance && <div className="cs-row-title">{balance}</div>}
          {(network || lastActive) && (
            <div className="cs-row-subtext">
              {network}
              {network && lastActive ? " • " : ""}
              {lastActive}
            </div>
          )}
        </div>
      )}
    </div>
  );
}