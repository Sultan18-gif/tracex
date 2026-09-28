import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../api";

export default function VASPProviders() {
  const [vasps, setVasps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    loadVASPs();
  }, []);

  const loadVASPs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/vasps`);

      if (!response.ok) {
        throw new Error("Failed to fetch VASPs");
      }

      const data = await response.json();

      setVasps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("VASP loading error:", err);
      setError("Unable to load VASP providers.");
    } finally {
      setLoading(false);
    }
  };

  const totalAddresses = useMemo(() => {
    return vasps.reduce((total, vasp) => {
      return total + (Array.isArray(vasp.addresses)
        ? vasp.addresses.length
        : 0);
    }, 0);
  }, [vasps]);

  const highRiskCount = useMemo(() => {
    return vasps.filter((vasp) => {
      const risk = String(vasp.riskLevel || "").toLowerCase();

      return risk === "high" || risk === "critical";
    }).length;
  }, [vasps]);

  const filteredVASPs = useMemo(() => {
    return vasps.filter((vasp) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        !searchText ||
        String(vasp.name || "").toLowerCase().includes(searchText) ||
        String(vasp.country || "").toLowerCase().includes(searchText) ||
        String(vasp.jurisdiction || "").toLowerCase().includes(searchText);

      const matchesRisk =
        riskFilter === "All" ||
        String(vasp.riskLevel || "").toLowerCase() ===
          riskFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "All" ||
        String(vasp.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      return matchesSearch && matchesRisk && matchesStatus;
    });
  }, [vasps, search, riskFilter, statusFilter]);

  const getRiskClass = (risk) => {
    switch (String(risk || "").toLowerCase()) {
      case "critical":
        return "vasp-risk critical";

      case "high":
        return "vasp-risk high";

      case "medium":
        return "vasp-risk medium";

      case "low":
        return "vasp-risk low";

      default:
        return "vasp-risk unknown";
    }
  };

  const getStatusClass = (status) => {
    return String(status || "").toLowerCase() === "active"
      ? "vasp-status active"
      : "vasp-status inactive";
  };

  const formatAddress = (address) => {
    if (!address) return "—";

    if (typeof address === "string") {
      return address.length > 18
        ? `${address.slice(0, 9)}...${address.slice(-7)}`
        : address;
    }

    if (typeof address === "object") {
      const value =
        address.address ||
        address.wallet ||
        address.walletAddress ||
        address.value;

      if (!value) return "Unknown";

      return value.length > 18
        ? `${value.slice(0, 9)}...${value.slice(-7)}`
        : value;
    }

    return "Unknown";
  };

  return (
    <div className="vasp-page">

      {/* HEADER */}
      <div className="vasp-header">
        <div>
          <div className="vasp-eyebrow">
            INTELLIGENCE DATABASE
          </div>

          <h1>VASP Intelligence</h1>

          <p>
            Manage investigator-verified virtual asset service providers
            and their known blockchain relationships.
          </p>
        </div>

        <button
          className="vasp-refresh-btn"
          onClick={loadVASPs}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="vasp-error">
          {error}
        </div>
      )}

      {/* STATISTICS */}
      <div className="vasp-stats">

        <div className="vasp-stat-card">
          <div className="vasp-stat-icon">⌁</div>

          <div>
            <div className="vasp-stat-label">
              VASP PROVIDERS
            </div>

            <div className="vasp-stat-value">
              {vasps.length}
            </div>

            <div className="vasp-stat-description">
              Tracked providers
            </div>
          </div>
        </div>

        <div className="vasp-stat-card">
          <div className="vasp-stat-icon">◈</div>

          <div>
            <div className="vasp-stat-label">
              KNOWN ADDRESSES
            </div>

            <div className="vasp-stat-value">
              {totalAddresses}
            </div>

            <div className="vasp-stat-description">
              Blockchain addresses
            </div>
          </div>
        </div>

        <div className="vasp-stat-card">
          <div className="vasp-stat-icon risk-icon">!</div>

          <div>
            <div className="vasp-stat-label">
              HIGH RISK
            </div>

            <div className="vasp-stat-value">
              {highRiskCount}
            </div>

            <div className="vasp-stat-description">
              High or critical VASPs
            </div>
          </div>
        </div>

        <div className="vasp-stat-card">
          <div className="vasp-stat-icon online-icon">●</div>

          <div>
            <div className="vasp-stat-label">
              DATABASE STATUS
            </div>

            <div className="vasp-stat-value online-text">
              Online
            </div>

            <div className="vasp-stat-description">
              Firestore connection
            </div>
          </div>
        </div>

      </div>

      {/* DIRECTORY */}
      <div className="vasp-directory">

        <div className="vasp-directory-header">

          <div>
            <h2>VASP Directory</h2>

            <p>
              Showing {filteredVASPs.length} of {vasps.length} providers
            </p>
          </div>

          <button
            className="vasp-add-btn"
            onClick={() => alert("Connect this button to your Create VASP form.")}
          >
            + Add VASP
          </button>

        </div>

        {/* FILTERS */}
        <div className="vasp-toolbar">

          <div className="vasp-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search VASPs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="All">All risk levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Unknown">Unknown</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

        </div>

        {/* TABLE */}
        <div className="vasp-table-wrapper">

          <table className="vasp-table">

            <thead>
              <tr>
                <th>VASP</th>
                <th>TYPE</th>
                <th>JURISDICTION</th>
                <th>RISK</th>
                <th>STATUS</th>
                <th>WALLETS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="vasp-empty"
                  >
                    Loading VASP intelligence...
                  </td>
                </tr>
              ) : filteredVASPs.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="vasp-empty"
                  >
                    No VASP providers found.
                  </td>
                </tr>
              ) : (
                filteredVASPs.map((vasp) => (

                  <tr key={vasp.id}>

                    <td>
                      <div className="vasp-name">
                        <div className="vasp-logo">
                          {(vasp.name || "V").charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {vasp.name || "Unnamed VASP"}
                          </strong>

                          <span>
                            {vasp.country || "Unknown country"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="vasp-type">
                        {vasp.type || "Exchange"}
                      </span>
                    </td>

                    <td>
                      <div className="vasp-jurisdiction">
                        {vasp.jurisdiction || "Not specified"}
                      </div>
                    </td>

                    <td>
                      <span className={getRiskClass(vasp.riskLevel)}>
                        {vasp.riskLevel || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <span className={getStatusClass(vasp.status)}>
                        <span className="status-dot"></span>
                        {vasp.status || "Unknown"}
                      </span>
                    </td>

                    <td>
                      <div className="wallet-count">
                        {Array.isArray(vasp.addresses)
                          ? vasp.addresses.length
                          : 0}
                      </div>
                    </td>

                    <td>
                      <div className="vasp-actions">

                        <button
                          title="View provider"
                          onClick={() =>
                            alert(
                              `${vasp.name}\n\n${vasp.notes || "No notes available."}`
                            )
                          }
                        >
                          View
                        </button>

                        <button
                          title="View known addresses"
                          onClick={() => {
                            const addresses =
                              Array.isArray(vasp.addresses)
                                ? vasp.addresses
                                    .map(formatAddress)
                                    .join("\n")
                                : "No known addresses";

                            alert(
                              `${vasp.name}\n\nKnown addresses:\n${addresses}`
                            );
                          }}
                        >
                          Wallets
                        </button>

                      </div>
                    </td>

                  </tr>

                ))
              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}
        <div className="vasp-footer">

          <span>
            {filteredVASPs.length} provider
            {filteredVASPs.length !== 1 ? "s" : ""} displayed
          </span>

          <span>
            Data source: Firestore
          </span>

        </div>

      </div>

    </div>
  );
}
