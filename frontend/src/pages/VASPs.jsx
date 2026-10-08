import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../api";
import { auth } from "../firebase";
import usePermissions from "../hooks/usePermissions";

export default function VASPProviders() {
  const navigate = useNavigate();

  // ============================================================
  // PERMISSIONS
  // investigator@gmail.com = editor
  // everyone else = viewer
  // ============================================================

  const {
    isEditor,
    role,
    loading: permissionsLoading,
  } = usePermissions();

  const [vasps, setVasps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVasp, setEditingVasp] = useState(null);

  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // ============================================================
  // VASP VIEW POPUP
  // ============================================================

  const [viewingVasp, setViewingVasp] = useState(null);

  // ============================================================
  // FIREBASE AUTHENTICATION
  // ============================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
    });

    return () => unsubscribe();
  }, []);

  // ============================================================
  // LOAD VASPS
  // ============================================================

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

  useEffect(() => {
    loadVASPs();
  }, []);

  // ============================================================
  // FIREBASE TOKEN
  // ============================================================

  const getAuthToken = async () => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "You must be signed in to perform this action."
      );
    }

    return await user.getIdToken(true);
  };

  // ============================================================
  // CREATE / EDIT VASP
  // ONLY INVESTIGATOR CAN MODIFY
  // ============================================================

  const createVASP = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setCreateError(
        "You must be signed in to create or edit a VASP."
      );
      return;
    }

    if (!isEditor) {
      setCreateError(
        "You do not have permission to modify VASPs."
      );
      return;
    }

    const form = new FormData(event.currentTarget);

    const payload = {
      name: String(form.get("name") || "").trim(),

      type: form.get("type"),

      country: String(
        form.get("country") || ""
      ).trim(),

      jurisdiction: String(
        form.get("jurisdiction") || ""
      ).trim(),

      physicalLocation: String(
        form.get("physicalLocation") || ""
      ).trim(),

      riskLevel: form.get("riskLevel"),

      status: form.get("status"),

      website: String(
        form.get("website") || ""
      ).trim(),

      addresses: String(
        form.get("addresses") || ""
      )
        .split(/\r?\n/)
        .map((address) => address.trim())
        .filter(Boolean)
        .map((address) => {
          const previous = (
            editingVasp?.addresses || []
          ).find((item) => {
            const previousAddress =
              typeof item === "string"
                ? item
                : item.address ||
                  item.wallet ||
                  item.walletAddress ||
                  "";

            return (
              String(previousAddress).toLowerCase() ===
              address.toLowerCase()
            );
          });

          return previous &&
            typeof previous === "object"
            ? {
                ...previous,
                address,
              }
            : address;
        }),

      notes: String(
        form.get("notes") || ""
      ).trim(),
    };

    try {
      setSaving(true);
      setCreateError("");

      const token = await getAuthToken();

      const response = await fetch(
        editingVasp
          ? `${API_BASE_URL}/vasps/${encodeURIComponent(
              editingVasp.id
            )}`
          : `${API_BASE_URL}/vasps`,
        {
          method: editingVasp ? "PUT" : "POST",

          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "Could not save VASP."
        );
      }

      setShowCreateForm(false);
      setEditingVasp(null);

      await loadVASPs();
    } catch (err) {
      console.error("VASP save error:", err);

      setCreateError(
        err.message || "Could not save VASP."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // DELETE VASP
  // ONLY INVESTIGATOR CAN DELETE
  // ============================================================

  const handleDeleteVasp = async (vasp) => {
    if (!isEditor) {
      setError(
        "You do not have permission to delete VASPs."
      );
      return;
    }

    if (!currentUser) {
      setError(
        "You must be signed in to delete a VASP."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        vasp.name || "this VASP"
      }"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const token = await getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/vasps/${encodeURIComponent(
          vasp.id
        )}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "Could not delete VASP."
        );
      }

      setVasps((previous) =>
        previous.filter(
          (item) => item.id !== vasp.id
        )
      );

      // Close popup if the deleted VASP was open.
      if (viewingVasp?.id === vasp.id) {
        setViewingVasp(null);
      }
    } catch (err) {
      console.error("VASP delete error:", err);

      setError(
        err.message || "Could not delete VASP."
      );
    }
  };

  // ============================================================
  // STATISTICS
  // ============================================================

  const totalAddresses = useMemo(() => {
    return vasps.reduce((total, vasp) => {
      return (
        total +
        (Array.isArray(vasp.addresses)
          ? vasp.addresses.length
          : 0)
      );
    }, 0);
  }, [vasps]);

  const highRiskCount = useMemo(() => {
    return vasps.filter((vasp) => {
      const risk = String(
        vasp.riskLevel || ""
      ).toLowerCase();

      return (
        risk === "high" ||
        risk === "critical"
      );
    }).length;
  }, [vasps]);

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredVASPs = useMemo(() => {
    return vasps.filter((vasp) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        !searchText ||
        String(vasp.name || "")
          .toLowerCase()
          .includes(searchText) ||
        String(vasp.country || "")
          .toLowerCase()
          .includes(searchText) ||
        String(vasp.jurisdiction || "")
          .toLowerCase()
          .includes(searchText);

      const matchesRisk =
        riskFilter === "All" ||
        String(
          vasp.riskLevel || ""
        ).toLowerCase() ===
          riskFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "All" ||
        String(
          vasp.status || ""
        ).toLowerCase() ===
          statusFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesRisk &&
        matchesStatus
      );
    });
  }, [
    vasps,
    search,
    riskFilter,
    statusFilter,
  ]);

  // ============================================================
  // HELPERS
  // ============================================================

  const getRiskClass = (risk) => {
    switch (
      String(risk || "").toLowerCase()
    ) {
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
    return String(
      status || ""
    ).toLowerCase() === "active"
      ? "vasp-status active"
      : "vasp-status inactive";
  };

  const getAddressValue = (address) => {
    if (typeof address === "string") {
      return address.trim();
    }

    if (
      typeof address === "object" &&
      address
    ) {
      return String(
        address.address ||
          address.wallet ||
          address.walletAddress ||
          address.value ||
          ""
      ).trim();
    }

    return "";
  };

  const formatAddress = (address) => {
    const value = getAddressValue(address);

    if (!value) {
      return "—";
    }

    return value.length > 18
      ? `${value.slice(0, 9)}...${value.slice(-7)}`
      : value;
  };

  // ============================================================
  // VASP VIEW POPUP
  // ============================================================

  const openVaspPopup = (vasp) => {
    setViewingVasp(vasp);
  };

  const closeVaspPopup = () => {
    setViewingVasp(null);
  };

  // ============================================================
  // OPEN CREATE FORM
  // ============================================================

  const handleAddVasp = () => {
    if (!currentUser) {
      setCreateError(
        "You must be signed in to add a VASP."
      );
      return;
    }

    if (!isEditor) {
      setCreateError(
        "Only investigator@gmail.com can add VASPs."
      );
      return;
    }

    setCreateError("");
    setEditingVasp(null);
    setShowCreateForm(true);
  };

  // ============================================================
  // OPEN EDIT FORM
  // ============================================================

  const handleEditVasp = (vasp) => {
    if (!currentUser) {
      setCreateError(
        "You must be signed in to edit a VASP."
      );
      return;
    }

    if (!isEditor) {
      setCreateError(
        "Only investigator@gmail.com can edit VASPs."
      );
      return;
    }

    setCreateError("");
    setEditingVasp(vasp);
    setShowCreateForm(true);
  };

  // ============================================================
  // CLOSE FORM
  // ============================================================

  const closeCreateForm = () => {
    if (saving) {
      return;
    }

    setShowCreateForm(false);
    setEditingVasp(null);
    setCreateError("");
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="vasp-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="vasp-header">

        <div>
          <div className="vasp-eyebrow">
            INTELLIGENCE DATABASE
          </div>

          <h1>VASP Intelligence</h1>

          <p>
            Manage investigator-verified virtual
            asset service providers and their
            known blockchain relationships.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <button
            className="vasp-refresh-btn"
            onClick={loadVASPs}
            type="button"
          >
            ↻ Refresh
          </button>
        </div>

      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="vasp-error">
          {error}
        </div>
      )}

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <div className="vasp-stats">

        <div className="vasp-stat-card">

          <div className="vasp-stat-icon">
            ⌁
          </div>

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

          <div className="vasp-stat-icon">
            ◈
          </div>

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

          <div className="vasp-stat-icon risk-icon">
            !
          </div>

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

          <div className="vasp-stat-icon online-icon">
            ●
          </div>

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

      {/* ======================================================
          DIRECTORY
      ====================================================== */}

      <div className="vasp-directory">

        <div className="vasp-directory-header">

          <div>
            <h2>VASP Directory</h2>

            <p>
              Showing {filteredVASPs.length} of{" "}
              {vasps.length} providers
            </p>
          </div>

          {isEditor && (
            <button
              className="vasp-add-btn"
              type="button"
              onClick={handleAddVasp}
            >
              + Add VASP
            </button>
          )}

        </div>

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <div className="vasp-toolbar">

          <div className="vasp-search">

            <span>⌕</span>

            <input
              type="text"
              placeholder="Search VASPs..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

          <select
            value={riskFilter}
            onChange={(e) =>
              setRiskFilter(e.target.value)
            }
          >
            <option value="All">
              All risk levels
            </option>

            <option value="Critical">
              Critical
            </option>

            <option value="High">
              High
            </option>

            <option value="Medium">
              Medium
            </option>

            <option value="Low">
              Low
            </option>

            <option value="Unknown">
              Unknown
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="All">
              All statuses
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>
          </select>

        </div>

        {/* ====================================================
            CREATE / EDIT MODAL
        ==================================================== */}

        {showCreateForm && isEditor && (
          <div
            className="vasp-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !saving
              ) {
                closeCreateForm();
              }
            }}
          >

            <section
              className="vasp-create-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="vasp-create-title"
            >

              <div className="vasp-create-heading">

                <div>
                  <h2 id="vasp-create-title">
                    {editingVasp
                      ? "Edit VASP provider"
                      : "Add VASP provider"}
                  </h2>

                  <p>
                    Enter a physical address and
                    the app will find its map
                    location automatically.
                  </p>
                </div>

                <button
                  type="button"
                  className="vasp-modal-close"
                  aria-label="Close"
                  disabled={saving}
                  onClick={closeCreateForm}
                >
                  ×
                </button>

              </div>

              {createError && (
                <div
                  className="vasp-error"
                  role="alert"
                >
                  {createError}
                </div>
              )}

              <form
                className="vasp-create-form"
                key={
                  editingVasp?.id ||
                  "new-vasp"
                }
                onSubmit={createVASP}
              >

                <label>
                  Provider name *

                  <input
                    name="name"
                    required
                    maxLength="120"
                    autoFocus
                    defaultValue={
                      editingVasp?.name || ""
                    }
                  />
                </label>

                <label>
                  Type

                  <select
                    name="type"
                    defaultValue={
                      editingVasp?.type ||
                      "Exchange"
                    }
                  >
                    <option>
                      Exchange
                    </option>

                    <option>
                      Broker
                    </option>

                    <option>
                      Custodian
                    </option>

                    <option>
                      Payment Provider
                    </option>

                    <option>
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  Country

                  <input
                    name="country"
                    maxLength="100"
                    defaultValue={
                      editingVasp?.country ||
                      ""
                    }
                  />
                </label>

                <label>
                  Jurisdiction

                  <input
                    name="jurisdiction"
                    maxLength="120"
                    defaultValue={
                      editingVasp?.jurisdiction ||
                      ""
                    }
                  />
                </label>

                <label>
                  Risk level

                  <select
                    name="riskLevel"
                    defaultValue={
                      editingVasp?.riskLevel ||
                      "Unknown"
                    }
                  >
                    <option>
                      Unknown
                    </option>

                    <option>
                      Low
                    </option>

                    <option>
                      Medium
                    </option>

                    <option>
                      High
                    </option>

                    <option>
                      Critical
                    </option>
                  </select>
                </label>

                <label>
                  Status

                  <select
                    name="status"
                    defaultValue={
                      editingVasp?.status ||
                      "Active"
                    }
                  >
                    <option>
                      Active
                    </option>

                    <option>
                      Inactive
                    </option>
                  </select>
                </label>

                <label className="vasp-form-wide">
                  Physical address / headquarters

                  <input
                    name="physicalLocation"
                    maxLength="240"
                    placeholder="e.g. Morochi, Maharashtra, India"
                    defaultValue={
                      editingVasp?.physicalLocation ||
                      ""
                    }
                  />
                </label>

                <p className="vasp-location-help vasp-form-wide">
                  The address is looked up
                  automatically when you save.
                  Include a city and country for
                  the best match.
                </p>

                <label className="vasp-form-wide">
                  Website

                  <input
                    name="website"
                    type="url"
                    placeholder="https://example.com"
                    defaultValue={
                      editingVasp?.website || ""
                    }
                  />
                </label>

                <label className="vasp-form-wide">
                  Known wallet addresses

                  <textarea
                    name="addresses"
                    rows="3"
                    placeholder="One address per line"
                    defaultValue={(
                      editingVasp?.addresses ||
                      []
                    )
                      .map((item) =>
                        typeof item === "string"
                          ? item
                          : item.address ||
                            item.wallet ||
                            item.walletAddress ||
                            ""
                      )
                      .filter(Boolean)
                      .join("\n")}
                  />
                </label>

                <label className="vasp-form-wide">
                  Notes

                  <textarea
                    name="notes"
                    rows="3"
                    maxLength="2000"
                    defaultValue={
                      editingVasp?.notes || ""
                    }
                  />
                </label>

                <div className="vasp-create-actions">

                  <button
                    type="button"
                    className="vasp-cancel-btn"
                    disabled={saving}
                    onClick={closeCreateForm}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="vasp-save-btn"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving…"
                      : editingVasp
                      ? "Save changes"
                      : "Save provider"}
                  </button>

                </div>

              </form>

            </section>

          </div>
        )}

        {/* ====================================================
            TABLE
        ==================================================== */}

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

                    {/* VASP */}

                    <td>

                      <div className="vasp-name">

                        <div className="vasp-logo">
                          {(
                            vasp.name || "V"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>

                          <strong>
                            {vasp.name ||
                              "Unnamed VASP"}
                          </strong>

                          <span>
                            {vasp.country ||
                              "Unknown country"}
                          </span>

                        </div>

                      </div>

                    </td>

                    {/* TYPE */}

                    <td>

                      <span className="vasp-type">
                        {vasp.type ||
                          "Exchange"}
                      </span>

                    </td>

                    {/* JURISDICTION */}

                    <td>

                      <div className="vasp-jurisdiction">
                        {vasp.jurisdiction ||
                          "Not specified"}
                      </div>

                    </td>

                    {/* RISK */}

                    <td>

                      <span
                        className={getRiskClass(
                          vasp.riskLevel
                        )}
                      >
                        {vasp.riskLevel ||
                          "Unknown"}
                      </span>

                    </td>

                    {/* STATUS */}

                    <td>

                      <span
                        className={getStatusClass(
                          vasp.status
                        )}
                      >
                        <span className="status-dot"></span>

                        {vasp.status ||
                          "Unknown"}
                      </span>

                    </td>

                    {/* WALLETS */}

                    <td>

                      <div className="wallet-count">
                        {Array.isArray(
                          vasp.addresses
                        )
                          ? vasp.addresses.length
                          : 0}
                      </div>

                    </td>

                    {/* ACTIONS */}

                    <td>

                      <div className="vasp-actions">

                        {/* VIEW */}

                        <button
                          type="button"
                          className="vasp-view-button"
                          title="View provider"
                          onClick={() =>
                            openVaspPopup(vasp)
                          }
                        >
                          View
                        </button>

                        {/* TRACE */}

                        <button
                          type="button"
                          title="Trace this provider's first saved wallet address"
                          disabled={
                            !Array.isArray(
                              vasp.addresses
                            ) ||
                            vasp.addresses.length ===
                              0
                          }
                          onClick={() => {
                            const address =
                              Array.isArray(
                                vasp.addresses
                              )
                                ? vasp.addresses
                                    .map(
                                      getAddressValue
                                    )
                                    .find(Boolean)
                                : "";

                            if (address) {
                              navigate(
                                `/network?wallet=${encodeURIComponent(
                                  address
                                )}`
                              );
                            }
                          }}
                        >
                          Trace
                        </button>

                        {/* =================================================
                            EDIT — INVESTIGATOR ONLY
                        ================================================= */}

                        {isEditor && (
                          <button
                            type="button"
                            className="vasp-edit-button"
                            title="Edit provider"
                            onClick={() =>
                              handleEditVasp(
                                vasp
                              )
                            }
                          >
                            Edit
                          </button>
                        )}

                        {/* =================================================
                            DELETE — INVESTIGATOR ONLY
                        ================================================= */}

                        {isEditor && (
                          <button
                            type="button"
                            className="vasp-delete-button"
                            title="Delete provider"
                            onClick={() =>
                              handleDeleteVasp(
                                vasp
                              )
                            }
                          >
                            Delete
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="vasp-footer">

          <span>
            {filteredVASPs.length} provider
            {filteredVASPs.length !== 1
              ? "s"
              : ""}{" "}
            displayed
          </span>

          <span>
            Data source: Firestore
          </span>

        </div>

      </div>

      {/* ==========================================================
          VASP DETAILS POPUP
      ========================================================== */}

      {viewingVasp && (

        <div
          className="tracex-popup-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeVaspPopup();
            }
          }}
        >

          <div
            className="tracex-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vasp-popup-title"
          >

            {/* POPUP HEADER */}

            <div className="tracex-popup-header">

              <div className="tracex-popup-title-area">

                <div className="tracex-popup-logo">
                  {(
                    viewingVasp.name || "V"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>

                  <div className="tracex-popup-eyebrow">
                    VASP INTELLIGENCE
                  </div>

                  <h2 id="vasp-popup-title">
                    {viewingVasp.name ||
                      "Unnamed VASP"}
                  </h2>

                  <span className="tracex-popup-subtitle">
                    {viewingVasp.country ||
                      "Unknown country"}
                  </span>

                </div>

              </div>

              <button
                type="button"
                className="tracex-popup-close"
                onClick={closeVaspPopup}
                aria-label="Close"
              >
                ×
              </button>

            </div>

            {/* POPUP CONTENT */}

            <div className="tracex-popup-content">

              <div className="tracex-popup-grid">

                <div className="tracex-popup-field">

                  <span>TYPE</span>

                  <strong>
                    {viewingVasp.type ||
                      "Exchange"}
                  </strong>

                </div>

                <div className="tracex-popup-field">

                  <span>COUNTRY</span>

                  <strong>
                    {viewingVasp.country ||
                      "Not specified"}
                  </strong>

                </div>

                <div className="tracex-popup-field">

                  <span>JURISDICTION</span>

                  <strong>
                    {viewingVasp.jurisdiction ||
                      "Not specified"}
                  </strong>

                </div>

                <div className="tracex-popup-field">

                  <span>RISK LEVEL</span>

                  <strong
                    className={`tracex-popup-risk ${
                      String(
                        viewingVasp.riskLevel ||
                          "unknown"
                      ).toLowerCase()
                    }`}
                  >
                    {viewingVasp.riskLevel ||
                      "Unknown"}
                  </strong>

                </div>

                <div className="tracex-popup-field">

                  <span>STATUS</span>

                  <strong
                    className={`tracex-popup-status ${
                      String(
                        viewingVasp.status ||
                          ""
                      ).toLowerCase()
                    }`}
                  >

                    <span className="tracex-popup-status-dot"></span>

                    {viewingVasp.status ||
                      "Unknown"}

                  </strong>

                </div>

                <div className="tracex-popup-field">

                  <span>KNOWN WALLETS</span>

                  <strong>
                    {Array.isArray(
                      viewingVasp.addresses
                    )
                      ? viewingVasp.addresses.length
                      : 0}
                  </strong>

                </div>

              </div>

              {/* PHYSICAL LOCATION */}

              <div className="tracex-popup-section">

                <div className="tracex-popup-section-title">
                  PHYSICAL LOCATION
                </div>

                <div className="tracex-popup-section-value">
                  {viewingVasp.physicalLocation ||
                    viewingVasp.locationLabel ||
                    "Not specified"}
                </div>

              </div>

              {/* WEBSITE */}

              {viewingVasp.website && (

                <div className="tracex-popup-section">

                  <div className="tracex-popup-section-title">
                    WEBSITE
                  </div>

                  <a
                    href={viewingVasp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tracex-popup-link"
                  >
                    {viewingVasp.website}
                  </a>

                </div>

              )}

              {/* WALLET ADDRESSES */}

              <div className="tracex-popup-section">

                <div className="tracex-popup-section-title">
                  KNOWN WALLET ADDRESSES
                </div>

                <div className="tracex-popup-addresses">

                  {Array.isArray(
                    viewingVasp.addresses
                  ) &&
                  viewingVasp.addresses.length >
                    0 ? (

                    viewingVasp.addresses.map(
                      (address, index) => {

                        const value =
                          getAddressValue(
                            address
                          );

                        return (

                          <div
                            className="tracex-popup-address"
                            key={`${value}-${index}`}
                          >

                            <span className="tracex-popup-address-index">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <span className="tracex-popup-address-value">
                              {value ||
                                "Unknown address"}
                            </span>

                          </div>

                        );
                      }
                    )

                  ) : (

                    <div className="tracex-popup-empty">
                      No known wallet addresses
                      have been added.
                    </div>

                  )}

                </div>

              </div>

              {/* NOTES */}

              <div className="tracex-popup-section">

                <div className="tracex-popup-section-title">
                  INVESTIGATOR NOTES
                </div>

                <div className="tracex-popup-notes">
                  {viewingVasp.notes ||
                    "No investigator notes added."}
                </div>

              </div>

            </div>

            {/* POPUP FOOTER */}

            <div className="tracex-popup-footer">

              <span>
                DATA SOURCE: FIRESTORE
              </span>

              <button
                type="button"
                className="tracex-popup-done"
                onClick={closeVaspPopup}
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