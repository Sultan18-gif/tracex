import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../api";

const DEMO_WALLET =
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

export default function Transactions() {
  const [showFilters, setShowFilters] = useState(true);

  const [searchAddress, setSearchAddress] =
    useState(DEMO_WALLET);

  const [walletAddress, setWalletAddress] =
    useState(DEMO_WALLET);

  const [transactions, setTransactions] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [visibleCount, setVisibleCount] =
    useState(10);

  /*
   * ============================================================
   * FETCH TRANSACTIONS FROM BACKEND
   * ============================================================
   */
  const fetchTransactions = async (address) => {
    if (!address) return;

    try {
      setLoading(true);
      setError("");
      setTransactions([]);
      setVisibleCount(10);

      const response = await fetch(
        `${API_BASE_URL}/transactions/${address}`
      );

      if (!response.ok) {
        throw new Error(
          `Transaction API returned ${response.status}`
        );
      }

      const data = await response.json();

      /*
       * Your backend may return the array directly.
       */
      const transactionData = Array.isArray(data)
        ? data
        : Array.isArray(data.transactions)
        ? data.transactions
        : [];

      setTransactions(transactionData);
    } catch (err) {
      console.error(
        "Failed to fetch transactions:",
        err
      );

      setError(
        "Unable to load transactions from the blockchain service."
      );

      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Load default wallet when page opens.
   */
  useEffect(() => {
    fetchTransactions(DEMO_WALLET);
  }, []);

  /*
   * ============================================================
   * SEARCH / INVESTIGATE WALLET
   * ============================================================
   */
  const handleSearch = () => {
    const address = searchAddress.trim();

    if (!address) {
      setError("Please enter a wallet address.");
      return;
    }

    setWalletAddress(address);
    fetchTransactions(address);
  };

  /*
   * Press Enter to search.
   */
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  /*
   * ============================================================
   * NORMALIZE TRANSACTION DATA
   * ============================================================
   *
   * This allows the frontend to work with the different
   * field names your backend may return.
   */
  const normalizedTransactions = useMemo(() => {
    return transactions.map((tx, index) => {
      const hash =
        tx.hash ||
        tx.txHash ||
        tx.transactionHash ||
        tx.id ||
        `Transaction ${index + 1}`;

      const from =
        tx.from ||
        tx.sender ||
        tx.fromAddress ||
        "";

      const to =
        tx.to ||
        tx.receiver ||
        tx.toAddress ||
        "";

      const amount =
        tx.amount ??
        tx.valueEth ??
        tx.ethValue ??
        tx.value ??
        0;

      const currency =
        tx.currency ||
        tx.tokenSymbol ||
        tx.symbol ||
        "ETH";

      const timestamp =
        tx.timestamp ||
        tx.timeStamp ||
        tx.blockTimestamp ||
        tx.block_time ||
        tx.date ||
        null;

      const chain =
        tx.chain ||
        tx.network ||
        tx.blockchain ||
        "Ethereum";

      /*
       * Use backend risk information first.
       */
      const backendRisk =
        tx.riskLevel ||
        tx.risk ||
        tx.riskTag ||
        "";

      const normalizedRisk =
        String(backendRisk).toLowerCase();

      let risk = "Normal";
      let riskClass = "cs-badge-neutral";

      if (
        normalizedRisk.includes("critical") ||
        normalizedRisk.includes("high")
      ) {
        risk = "High Risk";
        riskClass = "cs-badge-high";
      } else if (
        normalizedRisk.includes("mixer") ||
        normalizedRisk.includes("tornado")
      ) {
        risk = "Mixer";
        riskClass = "cs-badge-high";
      } else if (
        normalizedRisk.includes("bridge")
      ) {
        risk = "Bridge";
        riskClass = "cs-badge-info";
      } else if (
        normalizedRisk.includes("cex") ||
        normalizedRisk.includes("exchange") ||
        normalizedRisk.includes("vasp")
      ) {
        risk = "CEX";
        riskClass = "cs-badge-medium";
      } else if (
        normalizedRisk.includes("dex")
      ) {
        risk = "DEX";
        riskClass = "cs-badge-neutral";
      } else if (
        normalizedRisk.includes("medium")
      ) {
        risk = "Medium";
        riskClass = "cs-badge-medium";
      }

      return {
        original: tx,
        hash,
        from,
        to,
        amount,
        currency,
        timestamp,
        chain,
        risk,
        riskClass,
      };
    });
  }, [transactions]);

  /*
   * ============================================================
   * FORMAT HASH
   * ============================================================
   */
  const shortenHash = (hash) => {
    if (!hash) return "Unknown";

    const value = String(hash);

    if (value.length <= 18) {
      return value;
    }

    return `${value.slice(0, 10)}...${value.slice(-8)}`;
  };

  /*
   * ============================================================
   * FORMAT WALLET ADDRESS
   * ============================================================
   */
  const shortenAddress = (address) => {
    if (!address) return "Unknown";

    const value = String(address);

    if (value.length <= 18) {
      return value;
    }

    return `${value.slice(0, 8)}...${value.slice(-6)}`;
  };

  /*
   * ============================================================
   * FORMAT TIME
   * ============================================================
   */
  const formatTime = (timestamp) => {
    if (!timestamp) {
      return "Unknown";
    }

    try {
      let date;

      /*
       * Etherscan-style timestamps are normally Unix seconds.
       */
      if (
        typeof timestamp === "number" ||
        /^\d+$/.test(String(timestamp))
      ) {
        const numericTimestamp =
          Number(timestamp);

        /*
         * Seconds vs milliseconds.
         */
        date =
          numericTimestamp < 100000000000
            ? new Date(
                numericTimestamp * 1000
              )
            : new Date(numericTimestamp);
      } else {
        date = new Date(timestamp);
      }

      if (Number.isNaN(date.getTime())) {
        return "Unknown";
      }

      return date.toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  /*
   * ============================================================
   * VALUE FORMAT
   * ============================================================
   */
  const formatValue = (amount, currency) => {
    if (
      amount === null ||
      amount === undefined ||
      amount === ""
    ) {
      return `0 ${currency}`;
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount)) {
      return `${amount} ${currency}`;
    }

    return `${numericAmount.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 6,
      }
    )} ${currency}`;
  };

  /*
   * ============================================================
   * STATISTICS
   * ============================================================
   */

  const highRiskCount =
    normalizedTransactions.filter(
      (tx) =>
        tx.risk === "High Risk" ||
        tx.risk === "Mixer" ||
        tx.risk === "CEX" ||
        tx.risk === "Bridge"
    ).length;

  const crossChainCount =
    normalizedTransactions.filter(
      (tx) => {
        const text =
          `${tx.chain} ${JSON.stringify(
            tx.original
          )}`.toLowerCase();

        return (
          text.includes("bridge") ||
          text.includes("cross-chain") ||
          text.includes("crosschain")
        );
      }
    ).length;

  /*
   * Calculate ETH value where possible.
   */
  const totalEth = normalizedTransactions.reduce(
    (total, tx) => {
      const currency =
        String(tx.currency).toUpperCase();

      const amount = Number(tx.amount);

      if (
        currency === "ETH" &&
        !Number.isNaN(amount)
      ) {
        return total + amount;
      }

      return total;
    },
    0
  );

  /*
   * ============================================================
   * LOAD MORE
   * ============================================================
   */
  const handleLoadMore = () => {
    setVisibleCount(
      (current) =>
        current + 10
    );
  };

  const visibleTransactions =
    normalizedTransactions.slice(
      0,
      visibleCount
    );

  return (
    <div className="cs-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <div className="cs-page-header">
        <h1>Transaction hop tracer</h1>

        <p>
          Multi-hop ledger tracking mapping fund
          movements and cross-chain bridging activity.
        </p>
      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}
      <div className="cs-search-bar">
        <button
          className="cs-primary-btn"
          onClick={() =>
            setShowFilters(!showFilters)
          }
        >
          ⚙ Filters
        </button>
      </div>

      {showFilters && (
        <div className="cs-panel">

          <div className="cs-panel-header">
            <h2>Transaction filters</h2>

            <span>
              {loading
                ? "Loading..."
                : "Live monitoring"}
            </span>
          </div>

          <div
            className="cs-search-bar"
            style={{
              display: "flex",
              gap: "10px",
            }}
          >
            <input
              type="text"
              placeholder="Search transaction or wallet address..."
              value={searchAddress}
              onChange={(e) =>
                setSearchAddress(
                  e.target.value
                )
              }
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
              }}
            />

            <button
              className="cs-primary-btn"
              onClick={handleSearch}
            >
              Investigate
            </button>
          </div>

          {walletAddress && (
            <div
              style={{
                marginTop: "12px",
                color: "#7f93ac",
                fontSize: "12px",
              }}
            >
              Investigating wallet:{" "}
              <span
                style={{
                  color: "#22d3ee",
                  fontFamily: "monospace",
                }}
              >
                {walletAddress}
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "12px",
                color: "#ff6b6b",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

        </div>
      )}

      {/* =====================================================
          STATISTICS
      ===================================================== */}
      <div className="cs-stat-grid">

        <div className="cs-stat-card">
          <div className="cs-stat-label">
            Transactions monitored
          </div>

          <div className="cs-stat-value">
            {normalizedTransactions.length.toLocaleString()}
          </div>

          <div className="cs-stat-trend">
            From selected wallet
          </div>
        </div>


        <div className="cs-stat-card">
          <div className="cs-stat-label">
            High-risk movements
          </div>

          <div className="cs-stat-value">
            {highRiskCount.toLocaleString()}
          </div>

          <div className="cs-stat-trend">
            Detected in returned transactions
          </div>
        </div>


        <div className="cs-stat-card">
          <div className="cs-stat-label">
            Value tracked
          </div>

          <div className="cs-stat-value">
            {totalEth.toLocaleString(
              undefined,
              {
                maximumFractionDigits: 4,
              }
            )} ETH
          </div>

          <div className="cs-stat-trend">
            Total ETH in returned transactions
          </div>
        </div>


        <div className="cs-stat-card">
          <div className="cs-stat-label">
            Cross-chain transfers
          </div>

          <div className="cs-stat-value">
            {crossChainCount.toLocaleString()}
          </div>

          <div className="cs-stat-trend">
            Bridge / cross-chain activity detected
          </div>
        </div>

      </div>

      {/* =====================================================
          RECENT ACTIVITY
      ===================================================== */}
      <div className="cs-panel">

        <div className="cs-panel-header">

          <div>
            <h2>
              Recent transaction activity
            </h2>

            <p className="cs-panel-subtext">
              Monitor suspicious transfers and follow
              the movement of funds between addresses
              and services.
            </p>
          </div>

          <span>
            {loading
              ? "Fetching blockchain data..."
              : "Live monitoring"}
          </span>

        </div>

        <div
          style={{
            overflowX: "auto",
          }}
        >
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

              {loading && (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    Loading real blockchain
                    transactions...
                  </td>
                </tr>
              )}

              {!loading &&
                visibleTransactions.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="6"
                      style={{
                        textAlign: "center",
                        padding: "30px",
                      }}
                    >
                      No transactions found for
                      this wallet.
                    </td>
                  </tr>
                )}

              {!loading &&
                visibleTransactions.map(
                  (transaction, index) => (
                    <tr
                      key={`${transaction.hash}-${index}`}
                    >

                      {/* Transaction hash */}
                      <td className="cs-table-mono">
                        {shortenHash(
                          transaction.hash
                        )}
                      </td>


                      {/* Timestamp */}
                      <td className="cs-table-muted">
                        {formatTime(
                          transaction.timestamp
                        )}
                      </td>


                      {/* Flow */}
                      <td>
                        <span className="cs-table-mono">

                          {shortenAddress(
                            transaction.from
                          )}

                          {" → "}

                          {shortenAddress(
                            transaction.to
                          )}

                        </span>
                      </td>


                      {/* Value */}
                      <td className="cs-table-mono">
                        {formatValue(
                          transaction.amount,
                          transaction.currency
                        )}
                      </td>


                      {/* Risk */}
                      <td>
                        <span
                          className={`cs-badge ${transaction.riskClass}`}
                        >
                          {transaction.risk}
                        </span>
                      </td>


                      {/* Inspect */}
                      <td>
                        <button
                          className="cs-link-btn"
                          onClick={() => {
                            alert(
                              `Transaction:\n${transaction.hash}\n\nFrom:\n${transaction.from}\n\nTo:\n${transaction.to}`
                            );
                          }}
                        >
                          View details
                        </button>
                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>
        </div>

        {/* =====================================================
            FOOTER
        ===================================================== */}
        <div className="cs-table-footer">

          <span className="cs-table-muted">
            Showing{" "}
            {Math.min(
              visibleCount,
              normalizedTransactions.length
            )}{" "}
            of{" "}
            {normalizedTransactions.length}{" "}
            transactions
          </span>

          {visibleCount <
            normalizedTransactions.length && (
            <button
              className="cs-primary-btn"
              onClick={handleLoadMore}
              style={{
                marginLeft: "12px",
              }}
            >
              Load more transactions
            </button>
          )}

        </div>

      </div>

    </div>
  );
}
