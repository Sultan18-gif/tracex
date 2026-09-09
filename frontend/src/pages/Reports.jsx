import { useEffect, useState } from "react";

import {
  getCases,
  generateReport,
} from "../../services/appData";

export default function Reports() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] =
    useState("");

  const [generatedReports, setGeneratedReports] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("success");

  /* =========================================================
     LOAD CASES
     ========================================================= */

  useEffect(() => {
    const loadCases = async () => {
      try {
        setLoading(true);

        const data = await getCases();

        setCases(
          Array.isArray(data) ? data : []
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

    loadCases();
  }, []);

  /* =========================================================
     GENERATE REPORT
     ========================================================= */

  const handleGenerateReport = async () => {
    setMessage("");

    if (!selectedCaseId) {
      setMessage(
        "Please select a case first."
      );

      setMessageType("error");

      return;
    }

    try {
      setGenerating(true);

      const result =
        await generateReport(
          selectedCaseId
        );

      setGeneratedReports((current) => [
        {
          ...result,
          generatedAt:
            new Date().toISOString(),
        },
        ...current,
      ]);

      setMessage(
        result.message ||
          "Investigation report generated successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Unable to generate report:",
        error
      );

      setMessage(
        error.message ||
          "Unable to generate investigation report."
      );

      setMessageType("error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="cs-page">

      {/* BREADCRUMB */}

      <div className="cs-breadcrumb">
        <span>Home</span>

        <span className="cs-breadcrumb-separator">
          /
        </span>

        <strong>Reports</strong>
      </div>

      {/* PAGE HEADER */}

      <div className="cs-page-header cs-dashboard-header">

        <div>
          <div className="cs-section-label">
            REPORTING
          </div>

          <h1>
            Automated forensic reports
          </h1>

          <p>
            Generate investigation reports from
            cases stored in the investigation backend.
          </p>
        </div>

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

      {/* REPORT GENERATOR */}

      <section className="cs-panel">

        <div className="cs-panel-header">

          <div>
            <div className="cs-panel-kicker">
              REPORT GENERATOR
            </div>

            <h2>
              Generate investigation report
            </h2>

            <p className="cs-panel-subtext">
              Select an existing case and send it
              to the report generation service.
            </p>
          </div>

        </div>

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
              setSelectedCaseId(
                event.target.value
              );
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

        {cases.length === 0 &&
          !loading && (
            <p
              className="cs-panel-subtext"
              style={{
                marginTop: "16px",
              }}
            >
              No investigation cases are
              currently available. Create a case
              before generating a report.
            </p>
          )}

      </section>

      {/* GENERATED REPORT RESULTS */}

      <section
        className="cs-panel"
        style={{
          marginTop: "20px",
        }}
      >

        <div className="cs-panel-header">

          <div>
            <div className="cs-panel-kicker">
              GENERATION HISTORY
            </div>

            <h2>
              Reports generated this session
            </h2>

            <p className="cs-panel-subtext">
              The current backend confirms report
              generation but does not provide a
              report-list endpoint.
            </p>
          </div>

        </div>

        {generatedReports.length === 0 ? (

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

            <h3>
              No reports generated in this session
            </h3>

            <p className="cs-panel-subtext">
              Select a case above and generate an
              investigation report.
            </p>

          </div>

        ) : (

          <div
            className="cs-list"
            style={{
              marginTop: "18px",
            }}
          >

            {generatedReports.map(
              (report, index) => (
                <div
                  className="cs-row"
                  key={`${report.caseId}-${index}`}
                >

                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >

                    <div className="cs-row-title">
                      {report.caseId}
                    </div>

                    <div className="cs-row-subtext">
                      {report.message}
                    </div>

                  </div>

                  <span className="cs-badge cs-badge-low">
                    {report.reportStatus}
                  </span>

                </div>
              )
            )}

          </div>
        )}

      </section>

    </div>
  );
}