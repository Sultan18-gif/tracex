import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getCases,
  getInvestigations,
  createCase,
} from "../../services/appData";

export default function Cases() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [cases, setCases] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [newCase, setNewCase] = useState({
    title: "",
    walletAddress: "",
    description: "",
    priority: "Medium",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  /* =========================================================
     LOAD DATA
     ========================================================= */

  const loadData = async () => {
    try {
      setLoading(true);

      const [casesData, investigationsData] =
        await Promise.all([
          getCases(),
          getInvestigations(),
        ]);

      setCases(
        Array.isArray(casesData)
          ? casesData
          : []
      );

      setInvestigations(
        Array.isArray(investigationsData)
          ? investigationsData
          : []
      );
    } catch (error) {
      console.error(
        "Unable to load cases:",
        error
      );

      setMessage(
        error.message ||
          "Unable to load investigation cases."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     OPEN CREATE FORM FROM DASHBOARD
     ========================================================= */

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setShowCreateForm(true);

      const params =
        new URLSearchParams(searchParams);

      params.delete("new");

      setSearchParams(params, {
        replace: true,
      });
    }
  }, [searchParams, setSearchParams]);

  /* =========================================================
     SUMMARY
     ========================================================= */

  const summary = useMemo(() => {
    const activeCases = cases.filter(
      (item) =>
        item.status !== "Closed" &&
        item.status !== "Resolved"
    );

    const criticalCases = cases.filter(
      (item) =>
        String(
          item.priority ||
            item.riskScore ||
            ""
        ).toLowerCase() === "critical"
    );

    const underReviewCases = cases.filter(
      (item) =>
        String(item.status || "").toLowerCase() ===
        "under review"
    );

    const walletSet = new Set();

    cases.forEach((item) => {
      if (Array.isArray(item.wallets)) {
        item.wallets.forEach((wallet) => {
          if (typeof wallet === "string") {
            walletSet.add(wallet);
          } else if (wallet?.address) {
            walletSet.add(wallet.address);
          }
        });
      }

      if (item.walletAddress) {
        walletSet.add(item.walletAddress);
      }
    });

    return {
      active: activeCases.length,
      critical: criticalCases.length,
      underReview: underReviewCases.length,
      wallets: walletSet.size,
    };
  }, [cases]);

  /* =========================================================
     GENERATE CASE FROM INVESTIGATION
     ========================================================= */

  const handleGenerateCase = () => {
    setMessage("");
    setMessageType("success");

    /*
      The current backend does not expose an investigations
      endpoint, so normally this array will be empty.

      If an investigation is available in the future,
      the latest investigation can still be used.
    */

    if (investigations.length === 0) {
      setShowCreateForm(true);
      return;
    }

    const latestInvestigation =
      investigations[investigations.length - 1];

    const walletAddress =
      latestInvestigation.walletAddress ||
      latestInvestigation.address ||
      "";

    if (!walletAddress) {
      setShowCreateForm(true);

      setMessage(
        "No wallet address was found in the investigation. Enter a wallet address to create the case."
      );

      setMessageType("error");

      return;
    }

    handleCreateFromInvestigation(
      latestInvestigation
    );
  };

  const handleCreateFromInvestigation = async (
    investigation
  ) => {
    try {
      setSubmitting(true);
      setMessage("");

      const walletAddress =
        investigation.walletAddress ||
        investigation.address ||
        "";

      const generatedCase =
        await createCase({
          title:
            investigation.title ||
            `Wallet Investigation — ${walletAddress.slice(
              0,
              10
            )}...`,

          walletAddress,

          description:
            investigation.description ||
            "Case generated from wallet investigation data.",

          priority:
            investigation.priority ||
            investigation.riskLevel ||
            "Medium",
        });

      await loadData();

      setSelectedCase(generatedCase);

      setMessage(
        `${generatedCase.id} was generated successfully.`
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Unable to generate case:",
        error
      );

      setMessage(
        error.message ||
          "Unable to generate investigation case."
      );

      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================================
     MANUAL CASE CREATION
     ========================================================= */

  const handleCreateCase = async (event) => {
    event.preventDefault();

    setMessage("");
    setMessageType("success");

    const title = newCase.title.trim();
    const walletAddress =
      newCase.walletAddress.trim();
    const description =
      newCase.description.trim();

    if (!title) {
      setMessage("Please enter a case title.");
      setMessageType("error");
      return;
    }

    if (!walletAddress) {
      setMessage(
        "Please enter a wallet address."
      );
      setMessageType("error");
      return;
    }

    if (!description) {
      setMessage(
        "Please enter a case description."
      );
      setMessageType("error");
      return;
    }

    try {
      setSubmitting(true);

      const generatedCase =
        await createCase({
          title,
          walletAddress,
          description,
          priority: newCase.priority,
        });

      await loadData();

      setNewCase({
        title: "",
        walletAddress: "",
        description: "",
        priority: "Medium",
      });

      setShowCreateForm(false);
      setSelectedCase(generatedCase);

      setMessage(
        `${generatedCase.id} was created successfully.`
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Unable to create case:",
        error
      );

      setMessage(
        error.message ||
          "Unable to create investigation case."
      );

      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================================================
     VIEW CASE
     ========================================================= */

  const handleViewCase = (caseItem) => {
    setSelectedCase(caseItem);
    setMessage("");
  };

  /* =========================================================
     HELPERS
     ========================================================= */

  const getWalletCount = (item) => {
    if (Array.isArray(item.wallets)) {
      return item.wallets.length;
    }

    return item.walletAddress ? 1 : 0;
  };

  const getTransactionCount = (item) => {
    return Array.isArray(item.transactions)
      ? item.transactions.length
      : 0;
  };

  const getFindingCount = (item) => {
    return Array.isArray(item.findings)
      ? item.findings.length
      : 0;
  };

  const getWallets = (item) => {
    if (Array.isArray(item.wallets)) {
      return item.wallets;
    }

    if (item.walletAddress) {
      return [item.walletAddress];
    }

    return [];
  };

  const getPriorityClass = (priority) => {
    return `cs-case-priority cs-priority-${String(
      priority || "Medium"
    )
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  };

  const getStatusClass = (status) => {
    return `cs-case-status cs-status-${String(
      status || "Open"
    )
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="cs-page">

      {/* BREADCRUMB */}

      <div className="cs-breadcrumb">
        <span>Home</span>

        <span className="cs-breadcrumb-separator">
          /
        </span>

        <strong>Cases</strong>
      </div>

      {/* PAGE HEADER */}

      <div className="cs-page-header">

        <div>
          <div className="cs-section-label">
            CASE MANAGEMENT
          </div>

          <h1 className="cs-page-title">
            Investigation cases
          </h1>

          <p className="cs-page-subtitle">
            Cases generated from active blockchain
            investigations and investigation data.
          </p>
        </div>

        <button
          type="button"
          className="cs-primary-btn"
          onClick={handleGenerateCase}
          disabled={submitting}
        >
          <span>+</span>
          Generate case
        </button>

      </div>

      {/* MESSAGE */}

      {message && (
        <div
          className={`cs-case-create-message ${
            messageType === "error"
              ? "cs-case-create-message-error"
              : "cs-case-create-message-success"
          }`}
        >
          {message}
        </div>
      )}

      {/* SUMMARY */}

      <div className="cs-case-summary">

        <div className="cs-case-summary-item">
          <span className="cs-summary-label">
            ACTIVE CASES
          </span>

          <strong>
            {summary.active}
          </strong>
        </div>

        <div className="cs-case-summary-item">
          <span className="cs-summary-label">
            CRITICAL
          </span>

          <strong className="cs-summary-danger">
            {summary.critical}
          </strong>
        </div>

        <div className="cs-case-summary-item">
          <span className="cs-summary-label">
            UNDER REVIEW
          </span>

          <strong className="cs-summary-warning">
            {summary.underReview}
          </strong>
        </div>

        <div className="cs-case-summary-item">
          <span className="cs-summary-label">
            WALLETS TRACKED
          </span>

          <strong>
            {summary.wallets}
          </strong>
        </div>

      </div>

      {/* CREATE CASE FORM */}

      {showCreateForm && (
        <section className="cs-case-create-panel">

          <div className="cs-case-create-header">

            <div className="cs-case-create-heading">

              <h2>
                Create investigation case
              </h2>

              <p>
                Create a case using a wallet address
                and investigation details.
              </p>

            </div>

            <button
              type="button"
              className="cs-case-create-cancel"
              onClick={() => {
                setShowCreateForm(false);
                setMessage("");
              }}
              disabled={submitting}
            >
              Cancel
            </button>

          </div>

          <form
            className="cs-case-create-form"
            onSubmit={handleCreateCase}
          >

            <div className="cs-case-create-field">

              <label
                htmlFor="case-title"
                className="cs-case-create-label"
              >
                Case title
              </label>

              <input
                id="case-title"
                className="cs-case-create-input"
                type="text"
                value={newCase.title}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Enter investigation case title"
                disabled={submitting}
              />

            </div>

            <div className="cs-case-create-field">

              <label
                htmlFor="case-wallet"
                className="cs-case-create-label"
              >
                Wallet address
              </label>

              <input
                id="case-wallet"
                className="cs-case-create-input"
                type="text"
                value={newCase.walletAddress}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    walletAddress:
                      event.target.value,
                  }))
                }
                placeholder="0x..."
                spellCheck="false"
                disabled={submitting}
              />

            </div>

            <div className="cs-case-create-field">

              <label
                htmlFor="case-description"
                className="cs-case-create-label"
              >
                Description
              </label>

              <textarea
                id="case-description"
                className="cs-case-create-textarea"
                value={newCase.description}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                placeholder="Describe the investigation"
                rows="4"
                disabled={submitting}
              />

            </div>

            <div className="cs-case-create-field">

              <label
                htmlFor="case-priority"
                className="cs-case-create-label"
              >
                Priority
              </label>

              <select
                id="case-priority"
                className="cs-case-create-select"
                value={newCase.priority}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    priority:
                      event.target.value,
                  }))
                }
                disabled={submitting}
              >
                <option value="Low">
                  Low
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="High">
                  High
                </option>

                <option value="Critical">
                  Critical
                </option>
              </select>

            </div>

            <div className="cs-case-create-actions">

              <button
                type="submit"
                className="cs-case-create-submit"
                disabled={submitting}
              >
                {submitting
                  ? "Creating..."
                  : "Create case"}
              </button>

            </div>

          </form>

        </section>
      )}

      {/* LOADING */}

      {loading && (
        <section className="cs-panel">
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
            }}
          >
            Loading investigation cases...
          </div>
        </section>
      )}

      {/* NO CASES */}

      {!loading &&
        cases.length === 0 &&
        !showCreateForm && (
          <section className="cs-panel">

            <div
              style={{
                textAlign: "center",
                padding: "50px 20px",
              }}
            >

              <div
                style={{
                  fontSize: "32px",
                  marginBottom: "14px",
                  opacity: 0.7,
                }}
              >
                ◈
              </div>

              <h2>
                No investigation cases
              </h2>

              <p className="cs-panel-subtext">
                No cases have been generated yet.
                Start a wallet investigation and
                generate a case from its investigation
                data.
              </p>

              <button
                type="button"
                className="cs-primary-btn"
                onClick={handleGenerateCase}
                style={{
                  marginTop: "18px",
                }}
              >
                <span>+</span>
                Generate case
              </button>

            </div>

          </section>
        )}

      {/* CASE LIST */}

      {!loading && cases.length > 0 && (
        <div className="cs-cases-list">

          {cases.map((item) => (
            <article
              key={item.id}
              className="cs-case-card"
              onClick={() =>
                handleViewCase(item)
              }
            >

              <div className="cs-case-top">

                <div className="cs-case-reference">
                  {item.caseId || item.id}
                </div>

                <span
                  className={getPriorityClass(
                    item.priority
                  )}
                >
                  {item.priority ||
                    item.riskScore ||
                    "Medium"}
                </span>

              </div>

              <div className="cs-case-body">

                <h2 className="cs-case-title">
                  {item.title}
                </h2>

                {item.description && (
                  <p className="cs-panel-subtext">
                    {item.description}
                  </p>
                )}

                <div className="cs-case-details">

                  <div className="cs-case-detail">
                    <span className="cs-detail-icon">
                      ◈
                    </span>

                    <span>
                      {getWalletCount(item)}
                      {" "}
                      wallets
                    </span>
                  </div>

                  <div className="cs-case-detail">
                    <span className="cs-detail-icon">
                      ▣
                    </span>

                    <span>
                      {getTransactionCount(item)}
                      {" "}
                      transactions
                    </span>
                  </div>

                  <div className="cs-case-detail">
                    <span className="cs-detail-icon">
                      ◆
                    </span>

                    <span>
                      {getFindingCount(item)}
                      {" "}
                      findings
                    </span>
                  </div>

                </div>

              </div>

              <div className="cs-case-footer">

                <div className="cs-case-agent">

                  <span>
                    Assigned investigator
                  </span>

                  <strong>
                    {item.agent ||
                      "Senior Investigator"}
                  </strong>

                </div>

                <span
                  className={getStatusClass(
                    item.status
                  )}
                >
                  {item.status || "Open"}
                </span>

              </div>

              <div className="cs-case-arrow">
                →
              </div>

            </article>
          ))}

        </div>
      )}

      {/* CASE DETAILS */}

      {selectedCase && (
        <div
          className="cs-menu-overlay"
          style={{
            zIndex: 1000,
          }}
          onClick={() =>
            setSelectedCase(null)
          }
        >

          <div
            className="cs-panel"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform:
                "translate(-50%, -50%)",
              width:
                "min(760px, calc(100vw - 40px))",
              maxHeight:
                "calc(100vh - 40px)",
              overflowY: "auto",
              zIndex: 1001,
              boxShadow:
                "0 24px 70px rgba(0,0,0,0.45)",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="cs-panel-header">

              <div>

                <div className="cs-case-reference">
                  {selectedCase.caseId ||
                    selectedCase.id}
                </div>

                <h2>
                  {selectedCase.title}
                </h2>

              </div>

              <button
                type="button"
                className="cs-menu-close"
                onClick={() =>
                  setSelectedCase(null)
                }
                aria-label="Close case"
              >
                ×
              </button>

            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                marginTop: "20px",
              }}
            >

              <div className="cs-stat-card">
                <span className="cs-stat-label">
                  PRIORITY
                </span>

                <span className="cs-stat-value">
                  {selectedCase.priority ||
                    selectedCase.riskScore ||
                    "Medium"}
                </span>
              </div>

              <div className="cs-stat-card">
                <span className="cs-stat-label">
                  STATUS
                </span>

                <span className="cs-stat-value">
                  {selectedCase.status ||
                    "Open"}
                </span>
              </div>

              <div className="cs-stat-card">
                <span className="cs-stat-label">
                  WALLETS
                </span>

                <span className="cs-stat-value">
                  {getWalletCount(
                    selectedCase
                  )}
                </span>
              </div>

              <div className="cs-stat-card">
                <span className="cs-stat-label">
                  TRANSACTIONS
                </span>

                <span className="cs-stat-value">
                  {getTransactionCount(
                    selectedCase
                  )}
                </span>
              </div>

            </div>

            {selectedCase.description && (
              <div
                style={{
                  marginTop: "22px",
                }}
              >

                <div className="cs-section-label">
                  DESCRIPTION
                </div>

                <p>
                  {selectedCase.description}
                </p>

              </div>
            )}

            <div
              style={{
                marginTop: "22px",
              }}
            >

              <div className="cs-section-label">
                TRACKED WALLETS
              </div>

              {getWalletCount(
                selectedCase
              ) === 0 ? (

                <p className="cs-panel-subtext">
                  No wallets are attached to
                  this case yet.
                </p>

              ) : (

                <div
                  className="cs-list"
                  style={{
                    marginTop: "10px",
                  }}
                >

                  {getWallets(
                    selectedCase
                  ).map(
                    (wallet, index) => {

                      const address =
                        typeof wallet === "string"
                          ? wallet
                          : wallet?.address ||
                            "Unknown wallet";

                      return (
                        <div
                          className="cs-row"
                          key={`${address}-${index}`}
                        >

                          <span className="cs-row-subtext">
                            {address}
                          </span>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </div>

            <div
              style={{
                marginTop: "24px",
              }}
            >

              <div className="cs-section-label">
                CASE INFORMATION
              </div>

              <p className="cs-panel-subtext">
                Case status and priority are
                managed by the investigation backend.
              </p>

              {selectedCase.createdAt && (
                <p className="cs-panel-subtext">
                  Created:{" "}
                  {formatDateTime(
                    selectedCase.createdAt
                  )}
                </p>
              )}

            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "24px",
              }}
            >

              <button
                type="button"
                className="cs-primary-btn"
                onClick={() =>
                  setSelectedCase(null)
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

function formatDateTime(value) {
  try {
    const date =
      value?.toDate instanceof Function
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }

    return date.toLocaleString();
  } catch {
    return "Unknown";
  }
}