import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, analyzeWallet } from "../api";

const initialWallet = {
  address: "",
  label: "No wallet selected",
  balance: "—",
  network: "Ethereum Mainnet",
  firstSeen: "—",
  lastActive: "—",
  riskScore: 0,
  tags: [],
  exposure: [
    {
      label: "Sanctioned mixers (Tornado)",
      pct: 0,
      color: "high",
    },
    {
      label: "DEX / DeFi pools",
      pct: 0,
      color: "info",
    },
    {
      label: "CEX off-ramps",
      pct: 0,
      color: "low",
    },
  ],
};

function shortenAddress(address = "") {
  if (!address) return "Unknown";

  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatValue(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "0 ETH";
  }

  return `${numeric.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} ETH`;
}

function normalizeTransaction(tx = {}) {
  return {
    hash:
      tx.hash ||
      tx.txHash ||
      tx.transactionHash ||
      tx.id ||
      "",
    from:
      tx.from ||
      tx.sender ||
      "",
    to:
      tx.to ||
      tx.receiver ||
      "",
    value:
      tx.value ??
      tx.amount ??
      tx.valueEth ??
      tx.ethValue ??
      0,
    timestamp:
      tx.timestamp ||
      tx.timeStamp ||
      tx.blockTimestamp ||
      tx.createdAt ||
      null,
    status:
      tx.status ||
      "Confirmed",
  };
}

function calculateRisk(transactions = []) {
  if (!transactions.length) {
    return {
      score: 0,
      level: "Low",
      reason:
        "No transaction activity was returned for this address.",
    };
  }

  let score = 10;

  transactions.forEach((tx) => {
    const text = `${tx.from} ${tx.to}`.toLowerCase();

    if (
      text.includes("tornado") ||
      text.includes("mixer") ||
      text.includes("sanction")
    ) {
      score += 20;
    }

    if (
      text.includes("phishing") ||
      text.includes("drainer") ||
      text.includes("exploit")
    ) {
      score += 20;
    }

    if (
      text.includes("dex") ||
      text.includes("swap") ||
      text.includes("uniswap")
    ) {
      score += 4;
    }

    if (
      text.includes("binance") ||
      text.includes("kraken") ||
      text.includes("coinbase")
    ) {
      score += 3;
    }
  });

  if (transactions.length > 100) {
    score += 10;
  }

  if (transactions.length > 500) {
    score += 10;
  }

  score = Math.min(score, 100);

  let level = "Low";

  if (score >= 80) {
    level = "Critical";
  } else if (score >= 60) {
    level = "High";
  } else if (score >= 30) {
    level = "Medium";
  }

  return {
    score,
    level,
    reason:
      score >= 80
        ? "Severe exposure indicators detected across transaction counterparties."
        : score >= 60
        ? "Multiple elevated-risk transaction patterns detected."
        : score >= 30
        ? "Moderate transaction risk indicators detected."
        : "No significant high-risk transaction indicators detected.",
  };
}

export default function WalletInvestigation() {
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [wallet, setWallet] = useState(initialWallet);
  const [transactions, setTransactions] = useState([]);
  const [mlAnalysis, setMlAnalysis] = useState(null);
  const [analysisRun, setAnalysisRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const analysis = useMemo(() => {
    if (!analysisRun) {
      return {
        score: initialWallet.riskScore,
        level: "Low",
        reason:
          "Enter a wallet address to begin an investigation.",
      };
    }

    // Prefer the server-side model result whenever it is available. The
    // lightweight client calculation remains a useful fallback if the ML
    // service is unavailable during an investigation.
    if (mlAnalysis) {
      return {
        score: Number(mlAnalysis.riskScore) || 0,
        level: mlAnalysis.riskLevel || "Low",
        reason:
          mlAnalysis.reasons?.join(" ") ||
          "No major high-risk behavioral indicator detected.",
      };
    }

    return calculateRisk(transactions);
  }, [analysisRun, mlAnalysis, transactions]);

  const uniqueCounterparties = useMemo(() => {
    const values = new Set();

    transactions.forEach((tx) => {
      if (
        tx.from &&
        tx.from.toLowerCase() !== address.toLowerCase()
      ) {
        values.add(tx.from.toLowerCase());
      }

      if (
        tx.to &&
        tx.to.toLowerCase() !== address.toLowerCase()
      ) {
        values.add(tx.to.toLowerCase());
      }
    });

    return values.size;
  }, [transactions, address]);

  const totalTransferred = useMemo(() => {
    return transactions.reduce((total, tx) => {
      const value = Number(tx.value);

      return Number.isFinite(value)
        ? total + value
        : total;
    }, 0);
  }, [transactions]);

  const exposureBreakdown = useMemo(() => {
    const features = mlAnalysis?.features;
    const asPercentage = (value) =>
      Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 100);

    const mixerPct = asPercentage(
      Math.max(features?.sanction_exposure || 0, features?.mixer_exposure || 0)
    );
    const defiPct = asPercentage(
      Math.min(1, (features?.dex_ratio || 0) + (features?.defi_ratio || 0))
    );
    const cexPct = asPercentage(features?.cex_ratio);
    // Most addresses returned by a chain explorer have no reliable public
    // attribution. Show that fact explicitly instead of leaving the visual
    // empty or incorrectly assigning a wallet to an exchange/mixer.
    const unattributedPct = transactions.length
      ? Math.max(0, 100 - Math.min(100, mixerPct + defiPct + cexPct))
      : 0;

    return [
      {
        label: "Sanctioned mixers (Tornado)",
        pct: mixerPct,
        color: "high",
      },
      {
        label: "DEX / DeFi pools",
        pct: defiPct,
        color: "info",
      },
      {
        label: "CEX off-ramps",
        pct: cexPct,
        color: "low",
      },
      {
        label: `Unattributed counterparties (${uniqueCounterparties})`,
        pct: unattributedPct,
        color: "info",
      },
    ];
  }, [mlAnalysis, transactions.length, uniqueCounterparties]);

  const runDeepAnalysis = async () => {
    const targetAddress = address.trim();

    if (!targetAddress) {
      setError("Enter a wallet address before running the analysis.");
      return;
    }

    setLoading(true);
    setError("");
    setActionMessage("");
    setAnalysisRun(true);
    setMlAnalysis(null);

    try {
      const analyzedWallet = await analyzeWallet(targetAddress);

      const transactionResponse = await fetch(
        `${API_BASE_URL}/transactions/${encodeURIComponent(
          targetAddress
        )}`
      );

      let transactionData = [];

      if (transactionResponse.ok) {
        const transactionPayload = await transactionResponse.json();

        if (Array.isArray(transactionPayload)) {
          transactionData = transactionPayload;
        } else if (
          Array.isArray(transactionPayload.transactions)
        ) {
          transactionData = transactionPayload.transactions;
        }
      }

      const normalizedTransactions =
        transactionData.map(normalizeTransaction);

      setTransactions(normalizedTransactions);

      try {
        const mlResponse = await fetch(
          `${API_BASE_URL}/transactions/${encodeURIComponent(
            targetAddress
          )}/analyze`,
          {
            method: "POST",
          }
        );

        if (mlResponse.ok) {
          const mlData = await mlResponse.json();
          setMlAnalysis(mlData.mlAnalysis || null);
        } else {
          setMlAnalysis(null);
          console.error("ML analysis request failed");
        }
      } catch (mlError) {
        console.error("ML analysis failed:", mlError);
        setMlAnalysis(null);
      }

      setWallet({
        ...initialWallet,
        ...analyzedWallet,
        address: analyzedWallet.address || targetAddress,
        label: analyzedWallet.label || "Tracked wallet",
        balance:
          analyzedWallet.balance ||
          analyzedWallet.totalEthTransacted ||
          "0 ETH",
        network:
          analyzedWallet.network ||
          "Ethereum Mainnet",
        firstSeen:
          analyzedWallet.firstSeen ||
          analyzedWallet.analyzedAt ||
          "Unknown",
        lastActive:
          analyzedWallet.lastActive ||
          "Recently analyzed",
        tags: analyzedWallet.tags || [],
      });

      setActionMessage(
        `Deep analysis completed for ${shortenAddress(
          targetAddress
        )}.`
      );
    } catch (err) {
      console.error("Deep wallet analysis failed:", err);

      setError(
        err.message ||
          "Deep analysis could not be completed. Check that the backend is running."
      );

      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGraphConnections = () => {
    if (!wallet.address) {
      setError(
        "Run a wallet analysis before opening the graph."
      );
      return;
    }

    navigate(
      `/network?wallet=${encodeURIComponent(wallet.address)}&riskScore=${encodeURIComponent(
        analysis.score
      )}&riskLevel=${encodeURIComponent(analysis.level)}`
    );
  };

  const handleGenerateAudit = async () => {
    if (!wallet.address) {
      setError(
        "Run a wallet analysis before generating an audit."
      );
      return;
    }

    setActionLoading("audit");
    setError("");
    setActionMessage("");

    try {
      const caseResponse = await fetch(
        `${API_BASE_URL}/cases`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `Deep wallet audit - ${shortenAddress(
              wallet.address
            )}`,
            walletAddress: wallet.address,
            description:
              "Deep wallet forensic audit generated from Wallet Investigation.",
            riskScore: analysis.score,
          }),
        }
      );

      if (!caseResponse.ok) {
        const responseData =
          await caseResponse.json().catch(
            () => ({})
          );

        throw new Error(
          responseData.message ||
            "Unable to create investigation case."
        );
      }

      const caseData = await caseResponse.json();

      const caseId =
        caseData.caseId || caseData.id;

      if (!caseId) {
        throw new Error(
          "Case was created but no case ID was returned."
        );
      }

      const reportResponse = await fetch(
        `${API_BASE_URL}/reports/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            caseId,
          }),
        }
      );

      if (!reportResponse.ok) {
        const responseData =
          await reportResponse.json().catch(
            () => ({})
          );

        throw new Error(
          responseData.message ||
            "Case created, but report generation failed."
        );
      }

      setActionMessage(
        `Audit generated successfully for case ${caseId}.`
      );
    } catch (err) {
      console.error(
        "Audit generation failed:",
        err
      );

      setError(
        err.message ||
          "Unable to generate the investigation audit."
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleSubpoena = async () => {
    if (!wallet.address) {
      setError(
        "Run a wallet analysis before creating a subpoena request."
      );
      return;
    }

    setActionLoading("subpoena");
    setError("");
    setActionMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/cases`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `Subpoena request - ${shortenAddress(
              wallet.address
            )}`,
            walletAddress: wallet.address,
            description:
              "Request targeting identified exchange and KYC off-ramp counterparties associated with the investigated wallet.",
            riskScore: analysis.score,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to create subpoena investigation case."
        );
      }

      setActionMessage(
        `Subpoena investigation request created successfully${
          data.caseId
            ? ` as case ${data.caseId}`
            : ""
        }.`
      );
    } catch (err) {
      console.error(
        "Subpoena request failed:",
        err
      );

      setError(
        err.message ||
          "Unable to create subpoena request."
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleBlacklist = () => {
    if (!wallet.address) {
      setError(
        "Run a wallet analysis before adding the wallet to alerting."
      );
      return;
    }

    setActionLoading("blacklist");
    setError("");

    try {
      const existing = JSON.parse(
        localStorage.getItem("chainSentryBlacklist") || "[]"
      );

      const alreadyExists = existing.some(
        (item) =>
          item.address?.toLowerCase() ===
          wallet.address.toLowerCase()
      );

      if (!alreadyExists) {
        existing.push({
          address: wallet.address,
          label: wallet.label,
          riskScore: analysis.score,
          addedAt: new Date().toISOString(),
        });

        localStorage.setItem(
          "chainSentryBlacklist",
          JSON.stringify(existing)
        );

        setActionMessage(
          `Wallet ${shortenAddress(
            wallet.address
          )} was added to blacklist alerting.`
        );
      } else {
        setActionMessage(
          "This wallet is already present in blacklist alerting."
        );
      }
    } catch (err) {
      console.error(
        "Blacklist operation failed:",
        err
      );

      setError(
        "Unable to update blacklist alerting."
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleExport = () => {
    if (!wallet.address) {
      setError(
        "Run a wallet analysis before exporting data."
      );
      return;
    }

    setActionLoading("export");
    setError("");

    try {
      const exportData = {
        investigation: {
          wallet,
          risk: analysis,
          mlAnalysis,
          transactionCount: transactions.length,
          uniqueCounterparties,
          totalTransferred,
          generatedAt: new Date().toISOString(),
        },
        transactions,
      };

      const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `wallet-analysis-${wallet.address}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      setActionMessage(
        "Raw investigation data exported successfully."
      );
    } catch (err) {
      console.error("Export failed:", err);

      setError(
        "Unable to export investigation data."
      );
    } finally {
      setActionLoading("");
    }
  };

  const displayedRisk =
    analysisRun && transactions.length === 0
      ? 0
      : analysis.score;

  const displayedLevel =
    analysisRun && transactions.length === 0
      ? "Low"
      : analysis.level;

  const displayedTags =
    analysisRun && wallet.tags.length === 0
      ? ["No known risk tags"]
      : wallet.tags;

  return (
    <div className="cs-page">
      {/* Breadcrumb */}
      <div
        style={{
          fontSize: "12px",
          marginBottom: "18px",
          color: "var(--cs-text-muted)",
        }}
      >
        Home
        <span style={{ margin: "0 8px" }}>/</span>
        Wallet Investigation
      </div>

      {/* Header */}
      <div className="cs-page-header">
        <h1>Deep wallet forensics &amp; risk score</h1>
        <p>
          Inspect address history, sanctions status, connected counterparties,
          transaction behaviour, and mixer exposure.
        </p>
      </div>

      {/* Search */}
      <div className="cs-search-bar">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              runDeepAnalysis();
            }
          }}
          placeholder="Enter EVM or Solana address (0x...)"
          disabled={loading}
        />

        <button
          type="button"
          className="cs-primary-btn"
          onClick={runDeepAnalysis}
          disabled={loading}
          style={{
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Run deep analysis"}
        </button>
      </div>

      {/* Error Panel */}
      {error && (
        <div
          className="cs-panel"
          style={{
            marginTop: "18px",
            borderColor: "rgba(255, 107, 107, 0.35)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--cs-danger)",
              fontSize: "13px",
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Success / Action Message */}
      {actionMessage && (
        <div
          className="cs-panel"
          style={{
            marginTop: "18px",
            borderColor: "rgba(74, 222, 128, 0.35)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#4ade80",
              fontSize: "13px",
            }}
          >
            {actionMessage}
          </p>
        </div>
      )}

      {/* AI / ML Fraud Analysis */}
      {mlAnalysis && (
        <section
          className="cs-panel"
          style={{
            marginTop: "20px",
          }}
        >
          <div className="cs-inspector-top">
            <div>
              <p className="cs-panel-subtext" style={{ margin: 0 }}>
                AI / ML fraud analysis
              </p>
              <p className="cs-row-subtext" style={{ marginTop: "5px" }}>
                Random Forest risk classification and Isolation Forest anomaly detection based on observed wallet behaviour.
              </p>
            </div>

            <span
              className={`cs-badge ${
                ["Critical", "High"].includes(mlAnalysis.riskLevel)
                  ? "cs-badge-high"
                  : mlAnalysis.riskLevel === "Medium"
                    ? "cs-badge-medium"
                    : "cs-badge-low"
              }`}
            >
              {mlAnalysis.riskLevel ?? "Low"} risk
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">ML risk score</p>
                <p className="cs-row-title">{mlAnalysis.riskScore ?? 0} / 100</p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Transactions analyzed</p>
                <p className="cs-row-title">
                  {mlAnalysis.features?.tx_count ?? 0}
                </p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Fraud probability</p>
                <p className="cs-row-title">
                  {mlAnalysis.mlFraudProbability ?? 0}%
                </p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Anomaly score</p>
                <p className="cs-row-title">
                  {mlAnalysis.anomalyScore ?? 0}%
                </p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Unique counterparties</p>
                <p className="cs-row-title">
                  {mlAnalysis.features?.unique_counterparties ?? 0}
                </p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Rapid transfer ratio</p>
                <p className="cs-row-title">
                  {((mlAnalysis.features?.rapid_transfer_ratio ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Mixer exposure</p>
                <p className="cs-row-title">
                  {((mlAnalysis.features?.mixer_exposure ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="cs-action-row">
              <div>
                <p className="cs-row-subtext">Model confidence</p>
                <p className="cs-row-title">
                  {mlAnalysis.modelConfidence ?? 0}%
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main investigation grid */}
      <div className="cs-inspector-grid" style={{ marginTop: "20px" }}>
        {/* Wallet identity */}
        <section className="cs-panel">
          <div className="cs-inspector-top">
            <span className="cs-table-muted">Target address label</span>

            <span
              className={`cs-badge ${
                displayedLevel === "Critical" || displayedLevel === "High"
                  ? "cs-badge-high"
                  : displayedLevel === "Medium"
                  ? "cs-badge-warning"
                  : "cs-badge-low"
              }`}
            >
              {displayedLevel}
            </span>
          </div>

          <h2 className="cs-inspector-name">{wallet.label}</h2>

          <p
            className={
              displayedLevel === "Critical" || displayedLevel === "High"
                ? "cs-badge-high"
                : "cs-table-muted"
            }
            style={{
              fontSize: "12px",
              margin: "4px 0 20px",
              wordBreak: "break-all",
            }}
          >
            {wallet.address}
          </p>

          <div className="cs-inspector-fields">
            <div>
              <span>Portfolio balance</span>
              <strong>{wallet.balance}</strong>
            </div>

            <div>
              <span>Blockchain network</span>
              <strong>{wallet.network}</strong>
            </div>

            <div>
              <span>First interaction</span>
              <strong>{wallet.firstSeen}</strong>
            </div>

            <div>
              <span>Last active</span>
              <strong>{wallet.lastActive}</strong>
            </div>
          </div>

          <div className="cs-tag-row">
            {displayedTags.map((tag) => (
              <span className="cs-tag-pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Risk analysis */}
        <section className="cs-panel">
          <p className="cs-panel-subtext" style={{ marginBottom: "4px" }}>
            OFAC / AML risk index
          </p>

          <div className="cs-risk-score">
            <span>{displayedRisk}</span>
            <span className="cs-risk-score-max">/ 100</span>
          </div>

          <p
            className={
              displayedLevel === "Critical" || displayedLevel === "High"
                ? "cs-badge-high"
                : "cs-table-muted"
            }
            style={{
              fontSize: "12px",
              margin: "4px 0 20px",
            }}
          >
            {analysis.reason}
          </p>

          <p className="cs-panel-subtext" style={{ marginBottom: "8px" }}>
            Counterparty exposure breakdown
          </p>

          {analysisRun && transactions.length > 0 && (
            <p className="cs-row-subtext" style={{ margin: "-2px 0 12px" }}>
              Public attribution is unavailable for some wallet addresses; unclassified activity is shown separately and is not a risk label.
            </p>
          )}

          {exposureBreakdown.map((row) => (
            <div className="cs-exposure-row" key={row.label}>
              <div className="cs-exposure-label">
                <span>{row.label}</span>
                <span>
                  {analysisRun && transactions.length === 0 ? 0 : row.pct}%
                </span>
              </div>

              <div className="cs-exposure-track">
                <div
                  className={`cs-exposure-fill cs-exposure-${row.color}`}
                  style={{
                    width: `${
                      analysisRun && transactions.length === 0 ? 0 : row.pct
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}

          <div className="cs-inspector-actions">
            <button
              type="button"
              className="cs-secondary-btn"
              onClick={handleGraphConnections}
              disabled={actionLoading !== ""}
              style={{
                cursor: actionLoading !== "" ? "not-allowed" : "pointer",
              }}
            >
              Graph connections
            </button>

            <button
              type="button"
              className="cs-secondary-btn"
              onClick={handleGenerateAudit}
              disabled={actionLoading === "audit"}
              style={{
                cursor: actionLoading === "audit" ? "wait" : "pointer",
              }}
            >
              {actionLoading === "audit" ? "Generating..." : "Generate audit"}
            </button>
          </div>
        </section>

        {/* Investigative actions */}
        <section className="cs-panel">
          <p className="cs-panel-subtext" style={{ marginBottom: "12px" }}>
            Investigative actions
          </p>

          <div className="cs-action-list">
            <button
              type="button"
              className="cs-action-row"
              onClick={handleSubpoena}
              disabled={actionLoading !== ""}
              style={{
                width: "100%",
                textAlign: "left",
                cursor: actionLoading !== "" ? "wait" : "pointer",
              }}
            >
              <div>
                <p className="cs-row-title">
                  {actionLoading === "subpoena"
                    ? "Preparing subpoena request..."
                    : "Issue subpoena request"}
                </p>
                <p className="cs-row-subtext">
                  Target identified exchange and KYC off-ramps
                </p>
              </div>
              <span>›</span>
            </button>

            <button
              type="button"
              className="cs-action-row"
              onClick={handleBlacklist}
              disabled={actionLoading !== ""}
              style={{
                width: "100%",
                textAlign: "left",
                cursor: actionLoading !== "" ? "wait" : "pointer",
              }}
            >
              <div>
                <p className="cs-row-title">
                  {actionLoading === "blacklist"
                    ? "Updating alerting..."
                    : "Add to blacklist alerting"}
                </p>
                <p className="cs-row-subtext">
                  Receive alerts on future fund movement
                </p>
              </div>
              <span>›</span>
            </button>

            <button
              type="button"
              className="cs-action-row"
              onClick={handleExport}
              disabled={actionLoading !== ""}
              style={{
                width: "100%",
                textAlign: "left",
                cursor: actionLoading !== "" ? "wait" : "pointer",
              }}
            >
              <div>
                <p className="cs-row-title">
                  {actionLoading === "export"
                    ? "Exporting..."
                    : "Export raw transaction data"}
                </p>
                <p className="cs-row-subtext">
                  Download formatted JSON for investigation records
                </p>
              </div>
              <span>›</span>
            </button>
          </div>
        </section>
      </div>

      {/* Deep analysis results */}
      <section
        className="cs-panel"
        style={{
          marginTop: "20px",
        }}
      >
        <div className="cs-inspector-top">
          <div>
            <p className="cs-panel-subtext" style={{ margin: 0 }}>
              Deep analysis results
            </p>

            <p className="cs-row-subtext" style={{ marginTop: "5px" }}>
              Transaction and counterparty intelligence collected for the selected address.
            </p>
          </div>

          <span className="cs-table-muted">
            {analysisRun ? "Analysis completed" : "Preview analysis"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <div className="cs-action-row">
            <div>
              <p className="cs-row-subtext">Transactions analyzed</p>
              <p className="cs-row-title">{transactions.length}</p>
            </div>
          </div>

          <div className="cs-action-row">
            <div>
              <p className="cs-row-subtext">Unique counterparties</p>
              <p className="cs-row-title">{uniqueCounterparties}</p>
            </div>
          </div>

          <div className="cs-action-row">
            <div>
              <p className="cs-row-subtext">Total observed transfer</p>
              <p className="cs-row-title">{formatValue(totalTransferred)}</p>
            </div>
          </div>

          <div className="cs-action-row">
            <div>
              <p className="cs-row-subtext">Current risk classification</p>
              <p className="cs-row-title">{displayedLevel}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Transaction intelligence */}
      <section
        className="cs-panel"
        style={{
          marginTop: "20px",
        }}
      >
        <div className="cs-inspector-top">
          <div>
            <p className="cs-panel-subtext" style={{ margin: 0 }}>
              Transaction intelligence
            </p>

            <p className="cs-row-subtext" style={{ marginTop: "5px" }}>
              Recent blockchain activity associated with the investigated address.
            </p>
          </div>

          <button
            type="button"
            className="cs-secondary-btn"
            onClick={runDeepAnalysis}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh activity"}
          </button>
        </div>

        {transactions.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p className="cs-row-subtext" style={{ margin: 0 }}>
              {analysisRun
                ? "No transaction history returned for this wallet address."
                : "Run deep analysis to fetch recent transaction activity."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "18px" }}>
            <table
              className="cs-table"
              style={{ width: "100%", borderCollapse: "collapse" }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <th
                    style={{
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "var(--cs-text-muted)",
                    }}
                  >
                    Tx Hash
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "var(--cs-text-muted)",
                    }}
                  >
                    From
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "var(--cs-text-muted)",
                    }}
                  >
                    To
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "var(--cs-text-muted)",
                    }}
                  >
                    Value
                  </th>
                  <th
                    style={{
                      padding: "10px 12px",
                      fontSize: "12px",
                      color: "var(--cs-text-muted)",
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, idx) => (
                  <tr
                    key={tx.hash || idx}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: "13px",
                        fontFamily: "monospace",
                      }}
                    >
                      {shortenAddress(tx.hash)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: "13px",
                        fontFamily: "monospace",
                      }}
                    >
                      {shortenAddress(tx.from)}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: "13px",
                        fontFamily: "monospace",
                      }}
                    >
                      {shortenAddress(tx.to)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "13px" }}>
                      {formatValue(tx.value)}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: "12px" }}>
                      <span className="cs-badge cs-badge-low">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
