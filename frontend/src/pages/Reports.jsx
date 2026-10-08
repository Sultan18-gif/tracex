import { useEffect, useState } from "react";

import {
  getCases,
  getReports,
  getReport,
  generateReport,
} from "../../services/appData";

export default function Reports() {
  // =========================================================
  // STATE
  // =========================================================

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");

  const [generatedReports, setGeneratedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // =========================================================
  // LOAD CASES + REPORTS
  // =========================================================

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadingReports(true);

        const [casesData, reportsData] = await Promise.all([
          getCases(),
          getReports(),
        ]);

        setCases(Array.isArray(casesData) ? casesData : []);

        setGeneratedReports(
          Array.isArray(reportsData) ? reportsData : []
        );
      } catch (error) {
        console.error("Unable to load report data:", error);

        setMessage(
          error.message || "Unable to load forensic reports."
        );

        setMessageType("error");
      } finally {
        setLoading(false);
        setLoadingReports(false);
      }
    };

    loadData();
  }, []);

  // =========================================================
  // GENERATE FORENSIC REPORT
  // =========================================================

  const handleGenerateReport = async () => {
    setMessage("");

    if (!selectedCaseId) {
      setMessage("Please select a case first.");
      setMessageType("error");
      return;
    }

    try {
      setGenerating(true);

      const result = await generateReport(selectedCaseId);

      const newReport = result?.report || {
        reportId: result?.reportId,
        caseId: result?.caseId,
        generatedBy: result?.generatedBy,
        generatedAt: result?.generatedAt,
        status: result?.reportStatus,
        message: result?.message,
      };

      setGeneratedReports((current) => [
        newReport,
        ...current,
      ]);

      setSelectedReport(newReport);

      setMessage(
        result?.message ||
          "Forensic report generated successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error("Unable to generate report:", error);

      setMessage(
        error.message || "Unable to generate forensic report."
      );

      setMessageType("error");
    } finally {
      setGenerating(false);
    }
  };

  // =========================================================
  // VIEW FORENSIC REPORT
  // =========================================================

  const handleViewReport = async (report) => {
    try {
      if (report.reportId) {
        const fullReport = await getReport(report.reportId);

        setSelectedReport(fullReport);
      } else {
        setSelectedReport(report);
      }
    } catch (error) {
      console.error("Unable to load report:", error);

      setMessage(
        error.message || "Unable to load report."
      );

      setMessageType("error");
    }
  };

  // =========================================================
  // DOWNLOAD FORENSIC REPORT AS JSON
  // =========================================================

  const handleDownloadReport = (report) => {
    if (!report) {
      return;
    }

    try {
      // Convert complete report object into JSON
      const jsonData = JSON.stringify(report, null, 2);

      // Create JSON file
      const blob = new Blob([jsonData], {
        type: "application/json;charset=utf-8",
      });

      // Create temporary download URL
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");

      link.href = url;

      // Create safe filename
      const reportName =
        report.reportId ||
        report.caseId ||
        "forensic-report";

      const safeFileName = String(reportName).replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

      link.download = `${safeFileName}.json`;

      document.body.appendChild(link);

      // Start download
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(
        "Unable to download forensic report:",
        error
      );

      setMessage(
        "Unable to download the forensic report."
      );

      setMessageType("error");
    }
  };

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="cs-page">
      {/* =====================================================
          BREADCRUMB
      ===================================================== */}

      <div className="cs-breadcrumb">
        <span>Home</span>

        <span className="cs-breadcrumb-separator">
          /
        </span>

        <strong>Reports</strong>
      </div>

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="cs-page-header cs-dashboard-header">
        <div>
          <div className="cs-section-label">
            FORENSIC REPORTING
          </div>

          <h1>Automated forensic reports</h1>

          <p>
            Generate structured forensic investigation
            reports from your investigation cases.
          </p>
        </div>

        {/* Generate Button */}

        <button
          type="button"
          className="cs-primary-btn"
          onClick={handleGenerateReport}
          disabled={
            generating ||
            loading ||
            !selectedCaseId
          }
        >
          {generating
            ? "Generating..."
            : "+ Generate report"}
        </button>
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

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

      {/* =====================================================
          REPORT GENERATOR
      ===================================================== */}

      <section className="cs-panel">
        <div className="cs-panel-header">
          <div>
            <div className="cs-panel-kicker">
              REPORT GENERATOR
            </div>

            <h2>Generate forensic report</h2>

            <p className="cs-panel-subtext">
              Select an existing investigation case and
              generate a structured JSON forensic report.
            </p>
          </div>
        </div>

        {/* Case Selection */}

        <div
          className="cs-case-create-field"
          style={{
            marginTop: "20px",
          }}
        >
          <label
            htmlFor="report-case"
            className="cs-case-create-label"
          >
            Investigation case
          </label>

          <select
            id="report-case"
            className="cs-case-create-select"
            value={selectedCaseId}
            onChange={(event) => {
              setSelectedCaseId(event.target.value);
              setMessage("");
            }}
            disabled={loading || generating}
          >
            <option value="">
              {loading
                ? "Loading cases..."
                : cases.length === 0
                ? "No cases available"
                : "Select a case"}
            </option>

            {cases.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.caseId || item.id}
                {" — "}
                {item.title}
              </option>
            ))}
          </select>
        </div>

        {/* No Cases Message */}

        {cases.length === 0 && !loading && (
          <p
            className="cs-panel-subtext"
            style={{
              marginTop: "16px",
            }}
          >
            No investigation cases are currently
            available. Create a case before generating
            a report.
          </p>
        )}
      </section>

      {/* =====================================================
          SAVED REPORTS / REPORT ARCHIVE
      ===================================================== */}

      <section
        className="cs-panel"
        style={{
          marginTop: "20px",
        }}
      >
        <div className="cs-panel-header">
          <div>
            <div className="cs-panel-kicker">
              FORENSIC REPORT ARCHIVE
            </div>

            <h2>Generated reports</h2>

            <p className="cs-panel-subtext">
              Reports are stored as structured JSON
              documents in the backend.
            </p>
          </div>
        </div>

        {/* Loading */}

        {loadingReports && (
          <div
            style={{
              textAlign: "center",
              padding: "42px 20px",
            }}
          >
            Loading reports...
          </div>
        )}

        {/* No Reports */}

        {!loadingReports &&
          generatedReports.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "42px 20px",
              }}
            >
              <div
                style={{
                  fontSize: "30px",
                  marginBottom: "12px",
                  opacity: 0.7,
                }}
              >
                ▣
              </div>

              <h3>No forensic reports</h3>

              <p className="cs-panel-subtext">
                Select a case above and generate your
                first forensic report.
              </p>
            </div>
          )}

        {/* Reports List */}

        {!loadingReports &&
          generatedReports.length > 0 && (
            <div
              className="cs-list"
              style={{
                marginTop: "18px",
              }}
            >
              {generatedReports.map((report) => (
                <div
                  className="cs-row"
                  key={
                    report.reportId ||
                    report.id
                  }
                >
                  {/* Report Information */}

                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div className="cs-row-title">
                      {report.reportId ||
                        "Forensic Report"}
                    </div>

                    <div className="cs-row-subtext">
                      Case:{" "}
                      {report.caseId ||
                        "Unknown"}
                    </div>

                    <div className="cs-row-subtext">
                      Generated by:{" "}
                      {report.generatedBy?.email ||
                        report.generatedByEmail ||
                        "Unknown"}
                    </div>
                  </div>

                  {/* Status */}

                  <span className="cs-badge cs-badge-low">
                    {report.status ||
                      report.reportStatus ||
                      "Generated"}
                  </span>

                  {/* View Button */}

                  <button
                    type="button"
                    className="cs-link-btn"
                    onClick={() =>
                      handleViewReport(report)
                    }
                  >
                    View
                  </button>

                  {/* JSON Download Button */}

                  <button
                    type="button"
                    className="cs-link-btn"
                    onClick={() =>
                      handleDownloadReport(report)
                    }
                  >
                    JSON
                  </button>
                </div>
              ))}
            </div>
          )}
      </section>

      {/* =====================================================
          FORENSIC REPORT POPUP
      ===================================================== */}

      {selectedReport && (
        <div
          className="tx-popup-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedReport(null);
            }
          }}
        >
          {/* =================================================
              POPUP CARD
          ================================================= */}

          <div
            className="tx-popup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forensic-report-title"
          >
            {/* =================================================
                POPUP HEADER
            ================================================= */}

            <div className="tx-popup-header">
              <div>
                <div className="tx-popup-eyebrow">
                  TRACEX FORENSIC INTELLIGENCE
                </div>

                <h2 id="forensic-report-title">
                  Forensic Report
                </h2>

                <p>
                  Structured investigation report.
                </p>
              </div>

              {/* Close */}

              <button
                type="button"
                className="tx-popup-close"
                onClick={() =>
                  setSelectedReport(null)
                }
                aria-label="Close report"
              >
                ×
              </button>
            </div>

            {/* =================================================
                REPORT DETAILS
            ================================================= */}

            <div className="tx-popup-grid">
              {/* Report ID */}

              <div className="tx-popup-field">
                <span>REPORT ID</span>

                <strong className="tx-popup-mono">
                  {selectedReport.reportId ||
                    "Unknown"}
                </strong>
              </div>

              {/* Case ID */}

              <div className="tx-popup-field">
                <span>CASE ID</span>

                <strong>
                  {selectedReport.caseId ||
                    "Unknown"}
                </strong>
              </div>

              {/* Generated By */}

              <div className="tx-popup-field">
                <span>GENERATED BY</span>

                <strong>
                  {selectedReport.generatedBy
                    ?.email ||
                    selectedReport.generatedByEmail ||
                    "Unknown"}
                </strong>
              </div>

              {/* Generated At */}

              <div className="tx-popup-field">
                <span>GENERATED AT</span>

                <strong>
                  {selectedReport.generatedAt
                    ? new Date(
                        selectedReport.generatedAt
                      ).toLocaleString()
                    : "Unknown"}
                </strong>
              </div>

              {/* Wallet */}

              <div className="tx-popup-field">
                <span>WALLET</span>

                <strong className="tx-popup-mono tx-popup-break">
                  {selectedReport.subject
                    ?.walletAddress ||
                    "Unknown"}
                </strong>
              </div>

              {/* Risk Level */}

              <div className="tx-popup-field">
                <span>RISK LEVEL</span>

                <strong>
                  {selectedReport.riskAssessment
                    ?.riskLevel ||
                    "UNKNOWN"}
                </strong>
              </div>

              {/* Risk Score */}

              <div className="tx-popup-field">
                <span>RISK SCORE</span>

                <strong>
                  {selectedReport.riskAssessment
                    ?.riskScore ?? "N/A"}
                </strong>
              </div>

              {/* Transactions */}

              <div className="tx-popup-field">
                <span>TRANSACTIONS</span>

                <strong>
                  {selectedReport
                    .transactionAnalysis
                    ?.totalTransactions ?? 0}
                </strong>
              </div>
            </div>

            {/* =================================================
                JSON DOWNLOAD INFORMATION
            ================================================= */}

            <div className="tx-popup-json-info">
              <div className="tx-popup-field">
                <span>FORENSIC REPORT FILE</span>

                <strong>
                  JSON document ready
                </strong>
              </div>

              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  opacity: 0.7,
                }}
              >
                The complete forensic investigation
                report can be downloaded as a JSON
                file. The JSON data is not displayed
                on this screen.
              </p>
            </div>

            {/* =================================================
                POPUP FOOTER
            ================================================= */}

            <div className="tx-popup-footer">
              {/* Download JSON */}

              <button
                type="button"
                className="tx-popup-close-btn"
                onClick={() =>
                  handleDownloadReport(
                    selectedReport
                  )
                }
              >
                Download JSON
              </button>

              {/* Close */}

              <button
                type="button"
                className="tx-popup-close-btn"
                onClick={() =>
                  setSelectedReport(null)
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