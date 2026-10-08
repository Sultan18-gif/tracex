import usePermissions from "../hooks/usePermissions";

import { useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../api";

import { auth } from "../firebase";


const DEMO_WALLET =
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";


export default function Transactions() {

  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const {
    isEditor,
    role,
    loading: permissionsLoading,
  } = usePermissions();


  // ==========================================================
  // PAGE STATE
  // ==========================================================

  const [showFilters, setShowFilters] =
    useState(true);

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


  // ==========================================================
  // VIEW POPUP STATE
  // ==========================================================

  const [viewingTransaction, setViewingTransaction] =
    useState(null);


  // ==========================================================
  // EDIT STATE
  // ==========================================================

  const [editingTransaction, setEditingTransaction] =
    useState(null);

  const [editForm, setEditForm] =
    useState({
      hash: "",
      from: "",
      to: "",
      amount: "",
      currency: "",
      riskLevel: "",
      chain: "",
    });

  const [savingEdit, setSavingEdit] =
    useState(false);


  // ==========================================================
  // DELETE STATE
  // ==========================================================

  const [deletingId, setDeletingId] =
    useState(null);


  // ==========================================================
  // GET FIREBASE TOKEN
  // ==========================================================

  const getAuthToken = async () => {

    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "You must be signed in to perform this action."
      );
    }

    return await user.getIdToken(true);
  };


  // ==========================================================
  // FETCH TRANSACTIONS
  // ==========================================================

  const fetchTransactions = async (address) => {

    if (!address) return;

    try {

      setLoading(true);
      setError("");
      setTransactions([]);
      setVisibleCount(10);

      const response = await fetch(
        `${API_BASE_URL}/transactions/${encodeURIComponent(
          address
        )}`
      );

      const data =
        await response.json().catch(() => null);

      if (!response.ok) {

        throw new Error(
          data?.error ||
            data?.message ||
            `Transaction API returned ${response.status}`
        );
      }

      const transactionData =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.transactions)
          ? data.transactions
          : [];

      setTransactions(transactionData);

    } catch (err) {

      console.error(
        "Failed to fetch transactions:",
        err
      );

      setError(
        err.message ||
          "Unable to load transactions from the blockchain service."
      );

      setTransactions([]);

    } finally {

      setLoading(false);

    }
  };


  // ==========================================================
  // LOAD DEFAULT WALLET
  // ==========================================================

  useEffect(() => {

    fetchTransactions(DEMO_WALLET);

  }, []);


  // ==========================================================
  // SEARCH
  // ==========================================================

  const handleSearch = () => {

    const address =
      searchAddress.trim();

    if (!address) {

      setError(
        "Please enter a wallet address."
      );

      return;
    }

    setWalletAddress(address);

    fetchTransactions(address);
  };


  const handleKeyDown = (event) => {

    if (event.key === "Enter") {
      handleSearch();
    }

  };


  // ==========================================================
  // NORMALIZE TRANSACTIONS
  // ==========================================================

  const normalizedTransactions = useMemo(() => {

    return transactions.map(
      (tx, index) => {

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


        const backendRisk =
          tx.riskLevel ||
          tx.risk ||
          tx.riskTag ||
          "";


        const normalizedRisk =
          String(
            backendRisk
          ).toLowerCase();


        let risk = "Normal";

        let riskClass =
          "cs-badge-neutral";


        if (
          normalizedRisk.includes(
            "critical"
          ) ||
          normalizedRisk.includes(
            "high"
          )
        ) {

          risk = "High Risk";
          riskClass = "cs-badge-high";

        } else if (
          normalizedRisk.includes(
            "mixer"
          ) ||
          normalizedRisk.includes(
            "tornado"
          )
        ) {

          risk = "Mixer";
          riskClass = "cs-badge-high";

        } else if (
          normalizedRisk.includes(
            "bridge"
          )
        ) {

          risk = "Bridge";
          riskClass = "cs-badge-info";

        } else if (
          normalizedRisk.includes(
            "cex"
          ) ||
          normalizedRisk.includes(
            "exchange"
          ) ||
          normalizedRisk.includes(
            "vasp"
          )
        ) {

          risk = "CEX";
          riskClass = "cs-badge-medium";

        } else if (
          normalizedRisk.includes(
            "dex"
          )
        ) {

          risk = "DEX";
          riskClass =
            "cs-badge-neutral";

        } else if (
          normalizedRisk.includes(
            "medium"
          )
        ) {

          risk = "Medium";
          riskClass =
            "cs-badge-medium";
        }


        return {

          original: tx,

          id:
            tx.id ||
            tx._id ||
            tx.transactionId ||
            hash,

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

      }
    );

  }, [transactions]);


  // ==========================================================
  // OPEN TRANSACTION VIEW POPUP
  // ==========================================================

  const handleViewTransaction = (transaction) => {
    setViewingTransaction(transaction);
  };


  // ==========================================================
  // CLOSE TRANSACTION VIEW POPUP
  // ==========================================================

  const closeTransactionPopup = () => {
    setViewingTransaction(null);
  };


  // ==========================================================
  // CLOSE POPUP WITH ESCAPE
  // ==========================================================

  useEffect(() => {

    const handleEscape = (event) => {

      if (event.key === "Escape") {
        setViewingTransaction(null);
      }

    };

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };

  }, []);


  // ==========================================================
  // OPEN EDIT MODAL
  // ==========================================================

  const handleEdit = (transaction) => {

    if (!isEditor) {

      alert(
        "You do not have permission to edit transactions."
      );

      return;
    }


    setEditingTransaction(
      transaction
    );


    const original =
      transaction.original || {};


    setEditForm({

      hash:
        transaction.hash ||
        original.hash ||
        original.txHash ||
        original.transactionHash ||
        "",

      from:
        transaction.from || "",

      to:
        transaction.to || "",

      amount:
        transaction.amount ?? "",

      currency:
        transaction.currency || "ETH",

      riskLevel:
        original.riskLevel ||
        original.risk ||
        original.riskTag ||
        "",

      chain:
        transaction.chain ||
        "Ethereum",

    });

  };


  // ==========================================================
  // EDIT INPUT HANDLER
  // ==========================================================

  const handleEditChange = (
    event
  ) => {

    const {
      name,
      value,
    } = event.target;


    setEditForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );

  };


  // ==========================================================
  // SAVE EDIT
  // ==========================================================

  const handleSaveEdit = async () => {

    if (!isEditor) {

      alert(
        "Only the investigator account can edit transactions."
      );

      return;
    }


    if (!editingTransaction) {
      return;
    }


    try {

      setSavingEdit(true);


      const token =
        await getAuthToken();


      const transactionId =
        editingTransaction.id;


      const response =
        await fetch(
          `${API_BASE_URL}/transactions/${encodeURIComponent(
            transactionId
          )}`,
          {
            method: "PUT",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({

              hash:
                editForm.hash,

              from:
                editForm.from,

              to:
                editForm.to,

              amount:
                editForm.amount,

              currency:
                editForm.currency,

              riskLevel:
                editForm.riskLevel,

              chain:
                editForm.chain,

            }),
          }
        );


      const data =
        await response
          .json()
          .catch(() => null);


      if (!response.ok) {

        throw new Error(
          data?.error ||
            data?.message ||
            `Unable to update transaction (${response.status})`
        );
      }


      setTransactions(
        (currentTransactions) =>
          currentTransactions.map(
            (tx) => {

              const currentId =
                tx.id ||
                tx._id ||
                tx.transactionId ||
                tx.hash ||
                tx.txHash ||
                tx.transactionHash;


              if (
                String(currentId) !==
                String(transactionId)
              ) {

                return tx;

              }


              return {

                ...tx,

                hash:
                  editForm.hash,

                txHash:
                  editForm.hash,

                transactionHash:
                  editForm.hash,

                from:
                  editForm.from,

                sender:
                  editForm.from,

                to:
                  editForm.to,

                receiver:
                  editForm.to,

                amount:
                  editForm.amount,

                currency:
                  editForm.currency,

                riskLevel:
                  editForm.riskLevel,

                chain:
                  editForm.chain,

              };

            }
          )
      );


      setEditingTransaction(
        null
      );


      alert(
        "Transaction updated successfully."
      );

    } catch (err) {

      console.error(
        "Failed to update transaction:",
        err
      );


      alert(
        err.message ||
          "Unable to update transaction."
      );

    } finally {

      setSavingEdit(false);

    }

  };


  // ==========================================================
  // DELETE TRANSACTION
  // ==========================================================

  const handleDelete = async (
    transaction
  ) => {

    if (!isEditor) {

      alert(
        "Only the investigator account can delete transactions."
      );

      return;
    }


    const transactionId =
      transaction.id;


    const confirmed =
      window.confirm(
        `Are you sure you want to delete this transaction?\n\n${transaction.hash}\n\nThis action cannot be undone.`
      );


    if (!confirmed) {
      return;
    }


    try {

      setDeletingId(
        transactionId
      );


      const token =
        await getAuthToken();


      const response =
        await fetch(
          `${API_BASE_URL}/transactions/${encodeURIComponent(
            transactionId
          )}`,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      const data =
        await response
          .json()
          .catch(() => null);


      if (!response.ok) {

        throw new Error(
          data?.error ||
            data?.message ||
            `Unable to delete transaction (${response.status})`
        );

      }


      setTransactions(
        (currentTransactions) =>
          currentTransactions.filter(
            (tx) => {

              const currentId =
                tx.id ||
                tx._id ||
                tx.transactionId ||
                tx.hash ||
                tx.txHash ||
                tx.transactionHash;


              return (
                String(currentId) !==
                String(transactionId)
              );

            }
          )
      );


      if (
        viewingTransaction &&
        String(viewingTransaction.id) ===
          String(transactionId)
      ) {
        setViewingTransaction(null);
      }


      alert(
        "Transaction deleted successfully."
      );

    } catch (err) {

      console.error(
        "Failed to delete transaction:",
        err
      );


      alert(
        err.message ||
          "Unable to delete transaction."
      );

    } finally {

      setDeletingId(null);

    }

  };


  // ==========================================================
  // FORMAT HASH
  // ==========================================================

  const shortenHash = (
    hash
  ) => {

    if (!hash) {
      return "Unknown";
    }


    const value =
      String(hash);


    if (value.length <= 18) {
      return value;
    }


    return `${value.slice(
      0,
      10
    )}...${value.slice(-8)}`;

  };


  // ==========================================================
  // FORMAT ADDRESS
  // ==========================================================

  const shortenAddress = (
    address
  ) => {

    if (!address) {
      return "Unknown";
    }


    const value =
      String(address);


    if (value.length <= 18) {
      return value;
    }


    return `${value.slice(
      0,
      8
    )}...${value.slice(-6)}`;

  };


  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  const formatTime = (
    timestamp
  ) => {

    if (!timestamp) {
      return "Unknown";
    }


    try {

      let date;


      if (
        typeof timestamp ===
          "number" ||
        /^\d+$/.test(
          String(timestamp)
        )
      ) {

        const numericTimestamp =
          Number(timestamp);


        date =
          numericTimestamp <
          100000000000
            ? new Date(
                numericTimestamp *
                  1000
              )
            : new Date(
                numericTimestamp
              );

      } else {

        date =
          new Date(timestamp);

      }


      if (
        Number.isNaN(
          date.getTime()
        )
      ) {

        return "Unknown";

      }


      return date.toLocaleString();

    } catch {

      return "Unknown";

    }

  };


  // ==========================================================
  // FORMAT VALUE
  // ==========================================================

  const formatValue = (
    amount,
    currency
  ) => {

    if (
      amount === null ||
      amount === undefined ||
      amount === ""
    ) {

      return `0 ${currency}`;

    }


    const numericAmount =
      Number(amount);


    if (
      Number.isNaN(
        numericAmount
      )
    ) {

      return `${amount} ${currency}`;

    }


    return `${numericAmount.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 6,
      }
    )} ${currency}`;

  };


  // ==========================================================
  // STATISTICS
  // ==========================================================

  const highRiskCount =
    normalizedTransactions.filter(
      (tx) =>
        tx.risk ===
          "High Risk" ||
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
          text.includes(
            "bridge"
          ) ||
          text.includes(
            "cross-chain"
          ) ||
          text.includes(
            "crosschain"
          )
        );

      }
    ).length;


  const totalEth =
    normalizedTransactions.reduce(
      (total, tx) => {

        const currency =
          String(
            tx.currency
          ).toUpperCase();


        const amount =
          Number(tx.amount);


        if (
          currency === "ETH" &&
          !Number.isNaN(
            amount
          )
        ) {

          return total + amount;

        }


        return total;

      },
      0
    );


  // ==========================================================
  // LOAD MORE
  // ==========================================================

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


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="cs-page">


      {/* ====================================================
          PAGE HEADER
      ==================================================== */}

      <div className="cs-page-header">

        <h1>
          Transaction hop tracer
        </h1>

        <p>
          Multi-hop ledger tracking mapping fund
          movements and cross-chain bridging activity.
        </p>

      </div>


      {/* ====================================================
          PERMISSION STATUS
      ==================================================== */}

      {!permissionsLoading && (

        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            border:
              "1px solid rgba(34,211,238,0.18)",
            background:
              "rgba(3,15,27,0.72)",
            borderRadius: "8px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >

          <span
            style={{
              fontFamily:
                "monospace",
              fontSize: "12px",
              color: "#7f93ac",
            }}
          >
            ACCESS LEVEL
          </span>


          <span
            style={{
              fontFamily:
                "monospace",
              fontSize: "12px",
              fontWeight: 700,
              color: isEditor
                ? "#22d3ee"
                : "#94a3b8",
            }}
          >
            {isEditor
              ? "INVESTIGATOR / EDITOR"
              : "VIEWER / READ ONLY"}
          </span>

        </div>

      )}


      {/* ====================================================
          FILTERS
      ==================================================== */}

      <div className="cs-search-bar">

        <button
          className="cs-primary-btn"
          onClick={() =>
            setShowFilters(
              !showFilters
            )
          }
        >
          ⚙ Filters
        </button>

      </div>


      {showFilters && (

        <div className="cs-panel">

          <div className="cs-panel-header">

            <h2>
              Transaction filters
            </h2>

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
              onKeyDown={
                handleKeyDown
              }
              style={{
                flex: 1,
              }}
            />


            <button
              className="cs-primary-btn"
              onClick={
                handleSearch
              }
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
                  fontFamily:
                    "monospace",
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


      {/* ====================================================
          STATISTICS
      ==================================================== */}

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
            )}{" "}
            ETH
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


      {/* ====================================================
          TRANSACTION TABLE
      ==================================================== */}

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

                <th>
                  Transaction
                </th>

                <th>
                  Timestamp
                </th>

                <th>
                  Flow path
                </th>

                <th>
                  Value
                </th>

                <th>
                  Risk tag
                </th>

                <th>
                  Actions
                </th>

              </tr>

            </thead>


            <tbody>

              {loading && (

                <tr>

                  <td
                    colSpan="6"
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "30px",
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
                        textAlign:
                          "center",
                        padding:
                          "30px",
                      }}
                    >
                      No transactions found for
                      this wallet.
                    </td>

                  </tr>

                )}


              {!loading &&
                visibleTransactions.map(
                  (
                    transaction,
                    index
                  ) => (

                    <tr
                      key={`${transaction.id}-${index}`}
                    >

                      {/* Transaction */}

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


                      {/* Actions */}

                      <td>

                        <div
                          className="transaction-actions"
                        >

                          {/* VIEW */}

                          <button
                            type="button"
                            className="transaction-view-button"
                            onClick={() =>
                              handleViewTransaction(
                                transaction
                              )
                            }
                          >
                            View
                          </button>


                          {/* EDIT + DELETE */}

                          {isEditor && (

                            <>

                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(
                                    transaction
                                  )
                                }
                                style={{
                                  border:
                                    "1px solid rgba(34,211,238,0.35)",
                                  background:
                                    "rgba(34,211,238,0.08)",
                                  color:
                                    "#22d3ee",
                                  padding:
                                    "6px 10px",
                                  borderRadius:
                                    "6px",
                                  cursor:
                                    "pointer",
                                  fontSize:
                                    "12px",
                                  fontFamily:
                                    "monospace",
                                }}
                              >
                                Edit
                              </button>


                              <button
                                type="button"
                                disabled={
                                  deletingId ===
                                  transaction.id
                                }
                                onClick={() =>
                                  handleDelete(
                                    transaction
                                  )
                                }
                                style={{
                                  border:
                                    "1px solid rgba(255,80,80,0.35)",
                                  background:
                                    "rgba(255,80,80,0.08)",
                                  color:
                                    "#ff7070",
                                  padding:
                                    "6px 10px",
                                  borderRadius:
                                    "6px",
                                  cursor:
                                    deletingId ===
                                    transaction.id
                                      ? "wait"
                                      : "pointer",
                                  fontSize:
                                    "12px",
                                  fontFamily:
                                    "monospace",
                                  opacity:
                                    deletingId ===
                                    transaction.id
                                      ? 0.5
                                      : 1,
                                }}
                              >

                                {deletingId ===
                                transaction.id
                                  ? "Deleting..."
                                  : "Delete"}

                              </button>

                            </>

                          )}

                        </div>

                      </td>

                    </tr>

                  )
                )}

            </tbody>

          </table>

        </div>


        {/* ====================================================
            FOOTER
        ==================================================== */}

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
              onClick={
                handleLoadMore
              }
              style={{
                marginLeft:
                  "12px",
              }}
            >
              Load more transactions
            </button>

          )}

        </div>

      </div>


      {/* ====================================================
          TRANSACTION VIEW POPUP
      ==================================================== */}

      {viewingTransaction && (

        <div
          className="transaction-popup-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeTransactionPopup();
            }

          }}
        >

          <div
            className="transaction-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-popup-title"
          >

            {/* POPUP HEADER */}

            <div className="transaction-popup-header">

              <div>

                <div className="transaction-popup-eyebrow">
                  TRANSACTION INTELLIGENCE
                </div>

                <h2 id="transaction-popup-title">
                  Transaction details
                </h2>

              </div>


              <button
                type="button"
                className="transaction-popup-close"
                onClick={
                  closeTransactionPopup
                }
                aria-label="Close transaction details"
              >
                ×
              </button>

            </div>


            {/* RISK SUMMARY */}

            <div className="transaction-popup-summary">

              <div>

                <span className="transaction-popup-label">
                  RISK STATUS
                </span>

                <span
                  className={`cs-badge ${viewingTransaction.riskClass}`}
                >
                  {viewingTransaction.risk}
                </span>

              </div>


              <div>

                <span className="transaction-popup-label">
                  NETWORK
                </span>

                <strong>
                  {viewingTransaction.chain ||
                    "Ethereum"}
                </strong>

              </div>


              <div>

                <span className="transaction-popup-label">
                  VALUE
                </span>

                <strong>
                  {formatValue(
                    viewingTransaction.amount,
                    viewingTransaction.currency
                  )}
                </strong>

              </div>

            </div>


            {/* DETAILS */}

            <div className="transaction-popup-details">

              <div className="transaction-popup-field">

                <span>
                  TRANSACTION HASH
                </span>

                <p className="transaction-popup-mono">
                  {viewingTransaction.hash ||
                    "Unknown"}
                </p>

              </div>


              <div className="transaction-popup-field">

                <span>
                  FROM ADDRESS
                </span>

                <p className="transaction-popup-mono">
                  {viewingTransaction.from ||
                    "Unknown"}
                </p>

              </div>


              <div className="transaction-popup-flow">

                <div>

                  <span>
                    SOURCE
                  </span>

                  <p>
                    {shortenAddress(
                      viewingTransaction.from
                    )}
                  </p>

                </div>


                <div className="transaction-popup-arrow">
                  →
                </div>


                <div>

                  <span>
                    DESTINATION
                  </span>

                  <p>
                    {shortenAddress(
                      viewingTransaction.to
                    )}
                  </p>

                </div>

              </div>


              <div className="transaction-popup-field">

                <span>
                  TO ADDRESS
                </span>

                <p className="transaction-popup-mono">
                  {viewingTransaction.to ||
                    "Unknown"}
                </p>

              </div>


              <div className="transaction-popup-grid">

                <div className="transaction-popup-field">

                  <span>
                    AMOUNT
                  </span>

                  <p>
                    {viewingTransaction.amount ??
                      "0"}
                  </p>

                </div>


                <div className="transaction-popup-field">

                  <span>
                    CURRENCY
                  </span>

                  <p>
                    {viewingTransaction.currency ||
                      "ETH"}
                  </p>

                </div>


                <div className="transaction-popup-field">

                  <span>
                    BLOCKCHAIN
                  </span>

                  <p>
                    {viewingTransaction.chain ||
                      "Ethereum"}
                  </p>

                </div>


                <div className="transaction-popup-field">

                  <span>
                    TIMESTAMP
                  </span>

                  <p>
                    {formatTime(
                      viewingTransaction.timestamp
                    )}
                  </p>

                </div>

              </div>

            </div>


            {/* POPUP FOOTER */}

            <div className="transaction-popup-footer">

              <span>
                Transaction record
              </span>

              <button
                type="button"
                className="transaction-popup-done"
                onClick={
                  closeTransactionPopup
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ====================================================
          EDIT MODAL
      ==================================================== */}

      {editingTransaction &&
        isEditor && (

          <div
            style={{
              position:
                "fixed",
              inset: 0,
              zIndex: 9999,
              background:
                "rgba(0,0,0,0.78)",
              display:
                "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding:
                "20px",
            }}
          >

            <div
              style={{
                width:
                  "min(650px, 100%)",
                maxHeight:
                  "90vh",
                overflowY:
                  "auto",
                background:
                  "#06111d",
                border:
                  "1px solid rgba(34,211,238,0.28)",
                borderRadius:
                  "12px",
                padding:
                  "24px",
                boxShadow:
                  "0 20px 80px rgba(0,0,0,0.65)",
              }}
            >

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    "22px",
                }}
              >

                <div>

                  <h2
                    style={{
                      margin:
                        0,
                      color:
                        "#e6f7ff",
                    }}
                  >
                    Edit transaction
                  </h2>

                  <p
                    style={{
                      margin:
                        "6px 0 0",
                      color:
                        "#71869d",
                      fontSize:
                        "12px",
                    }}
                  >
                    Investigator authorization required
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setEditingTransaction(
                      null
                    )
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "transparent",
                    color:
                      "#8ca0b5",
                    fontSize:
                      "22px",
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>

              </div>


              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap:
                    "14px",
                }}
              >

                {/* HASH */}

                <div
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >

                  <label
                    style={{
                      display:
                        "block",
                      color:
                        "#7f93ac",
                      fontSize:
                        "11px",
                      marginBottom:
                        "6px",
                    }}
                  >
                    TRANSACTION HASH
                  </label>

                  <input
                    name="hash"
                    value={
                      editForm.hash
                    }
                    onChange={
                      handleEditChange
                    }
                    style={editInputStyle}
                  />

                </div>


                {/* FROM */}

                <div>

                  <label
                    style={editLabelStyle}
                  >
                    FROM ADDRESS
                  </label>

                  <input
                    name="from"
                    value={
                      editForm.from
                    }
                    onChange={
                      handleEditChange
                    }
                    style={editInputStyle}
                  />

                </div>


                {/* TO */}

                <div>

                  <label
                    style={editLabelStyle}
                  >
                    TO ADDRESS
                  </label>

                  <input
                    name="to"
                    value={
                      editForm.to
                    }
                    onChange={
                      handleEditChange
                    }
                    style={editInputStyle}
                  />

                </div>


                {/* AMOUNT */}

                <div>

                  <label
                    style={editLabelStyle}
                  >
                    AMOUNT
                  </label>

                  <input
                    name="amount"
                    value={
                      editForm.amount
                    }
                    onChange={
                      handleEditChange
                    }
                    type="number"
                    step="any"
                    style={editInputStyle}
                  />

                </div>


                {/* CURRENCY */}

                <div>

                  <label
                    style={editLabelStyle}
                  >
                    CURRENCY
                  </label>

                  <input
                    name="currency"
                    value={
                      editForm.currency
                    }
                    onChange={
                      handleEditChange
                    }
                    style={editInputStyle}
                  />

                </div>


                {/* RISK */}

                <div>

                  <label
                    style={editLabelStyle}
                  >
                    RISK LEVEL
                  </label>

                  <select
                    name="riskLevel"
                    value={
                      editForm.riskLevel
                    }
                    onChange={
                      handleEditChange
                    }
                    style={editInputStyle}
                  >

                    <option value="">
                      Normal
                    </option>

                    <option value="low">
                      Low
                    </option>

                    <option value="medium">
                      Medium
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="critical">
                      Critical
                    </option>

                    <option value="mixer">
                      Mixer
                    </option>

                    <option value="bridge">
                      Bridge
                    </option>

                    <option value="cex">
                      CEX
                    </option>

                    <option value="dex">
                      DEX
                    </option>

                  </select>

                </div>


                {/* CHAIN */}

                <div>

                  <label
                    style={editLabelStyle}
                  >
                    BLOCKCHAIN
                  </label>

                  <input
                    name="chain"
                    value={
                      editForm.chain
                    }
                    onChange={
                      handleEditChange
                    }
                    style={editInputStyle}
                  />

                </div>

              </div>


              {/* MODAL BUTTONS */}

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap:
                    "10px",
                  marginTop:
                    "24px",
                }}
              >

                <button
                  type="button"
                  onClick={() =>
                    setEditingTransaction(
                      null
                    )
                  }
                  disabled={
                    savingEdit
                  }
                  style={{
                    padding:
                      "10px 18px",
                    border:
                      "1px solid rgba(148,163,184,0.25)",
                    background:
                      "transparent",
                    color:
                      "#9aabc0",
                    borderRadius:
                      "7px",
                    cursor:
                      "pointer",
                  }}
                >
                  Cancel
                </button>


                <button
                  type="button"
                  onClick={
                    handleSaveEdit
                  }
                  disabled={
                    savingEdit
                  }
                  className="cs-primary-btn"
                >
                  {savingEdit
                    ? "Saving..."
                    : "Save changes"}
                </button>

              </div>

            </div>

          </div>

        )}

    </div>

  );
}


// ============================================================
// EDIT MODAL STYLES
// ============================================================

const editLabelStyle = {
  display: "block",
  color: "#7f93ac",
  fontSize: "11px",
  marginBottom: "6px",
  fontFamily: "monospace",
};


const editInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "6px",
  border:
    "1px solid rgba(34,211,238,0.18)",
  background: "#020a13",
  color: "#dcefff",
  outline: "none",
  fontFamily: "monospace",
  fontSize: "12px",
};