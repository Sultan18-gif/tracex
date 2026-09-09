import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getDashboardStats,
  getWallets,
} from "../../services/appData";

export default function Dashboard() {
  const navigate = useNavigate();

  const [dashboardStats, setDashboardStats] =
    useState({
      totalCases: 0,
      activeCases: 0,
      criticalCases: 0,
      walletsTracked: 0,
      transactionsAnalyzed: 0,
      investigations: 0,
      reportsGenerated: 0,
    });

  const [watchedWallets, setWatchedWallets] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  /* =========================================================
     LOAD DASHBOARD DATA
     ========================================================= */

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [
        stats,
        wallets,
      ] = await Promise.all([
        getDashboardStats(),
        getWallets(),
      ]);

      setDashboardStats(stats);

      setWatchedWallets(
        Array.isArray(wallets)
          ? wallets
          : []
      );
    } catch (error) {
      console.error(
        "Unable to load dashboard:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    /*
      Refresh when the dashboard becomes visible
      again after navigation.
    */

    const handleFocus = () => {
      loadDashboard();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);

  /* =========================================================
     STATISTICS
     ========================================================= */

  const stats = [
    {
      label: "Total cases",
      value: dashboardStats.totalCases,
      trend: `${dashboardStats.activeCases} active cases`,
    },
    {
      label: "Active cases",
      value: dashboardStats.activeCases,
      trend: `${dashboardStats.criticalCases} critical priority`,
    },
    {
      label: "Wallets tracked",
      value: dashboardStats.walletsTracked,
      trend: "Across investigation data",
    },
    {
      label: "Transactions analyzed",
      value:
        dashboardStats.transactionsAnalyzed,
      trend: `${dashboardStats.investigations} investigations recorded`,
    },
  ];

  /* =========================================================
     NAVIGATION
     ========================================================= */

  const handleOpenCase = () => {
    navigate("/cases?new=true");
  };

  const handleViewWallets = () => {
    navigate("/wallet-investigation");
  };

  /* =========================================================
     WALLET HELPERS
     ========================================================= */

  const getWalletRiskClass = (risk) => {
    const value = String(
      risk || "Low"
    ).toLowerCase();

    if (value === "critical") {
      return "cs-badge-high";
    }

    if (value === "high") {
      return "cs-badge-high";
    }

    if (value === "medium") {
      return "cs-badge-medium";
    }

    return "cs-badge-low";
  };

  const formatWalletAddress = (address) => {
    if (!address) {
      return "Unknown wallet";
    }

    if (address.length <= 18) {
      return address;
    }

    return `${address.slice(
      0,
      10
    )}...${address.slice(-8)}`;
  };

  const formatWalletAmount = (wallet) => {
    if (
      wallet.totalEthTransacted !==
      undefined
    ) {
      return `${wallet.totalEthTransacted} ETH`;
    }

    if (wallet.balance !== undefined) {
      return `${wallet.balance} ETH`;
    }

    return "No transaction value";
  };

  const formatWalletMeta = (wallet) => {
    if (wallet.analyzedAt) {
      try {
        return `Ethereum Mainnet • ${new Date(
          wallet.analyzedAt
        ).toLocaleString()}`;
      } catch {
        return "Ethereum Mainnet";
      }
    }

    return "Ethereum Mainnet";
  };

  return (
    <div className="cs-page cs-dashboard-page">

      {/* BREADCRUMB */}

      <div className="cs-breadcrumb">

        <span>Home</span>

        <span className="cs-breadcrumb-separator">
          /
        </span>

        <strong>Dashboard</strong>

      </div>

      {/* PAGE HEADER */}

      <header className="cs-page-header cs-dashboard-header">

        <div className="cs-dashboard-heading">

          <div className="cs-dashboard-eyebrow">
            COMMAND CENTER
          </div>

          <h1>
            Command dashboard overview
          </h1>

          <p>
            Real-time monitoring of high-risk
            crypto asset flows, sanction violations,
            and exploit tracking.
          </p>

        </div>

        <div className="cs-dashboard-header-actions">

          <button
            type="button"
            className="cs-primary-btn"
            onClick={handleOpenCase}
          >
            <span>+</span>
            Open new case
          </button>

        </div>

      </header>

      {/* STATISTICS */}

      <section
        className="cs-stat-grid"
        aria-label="Investigation statistics"
      >

        {stats.map((stat) => (
          <article
            className="cs-stat-card"
            key={stat.label}
          >

            <div className="cs-stat-card-top">

              <span className="cs-stat-label">
                {stat.label}
              </span>

              <span className="cs-stat-indicator"></span>

            </div>

            <span className="cs-stat-value">
              {loading ? "—" : stat.value}
            </span>

            <span className="cs-stat-trend">
              {stat.trend}
            </span>

          </article>
        ))}

      </section>

      {/* MAIN DASHBOARD CONTENT */}

      <div className="cs-dashboard-grid">

        {/* WATCHED WALLETS */}

        <section className="cs-panel cs-dashboard-panel cs-wallet-panel">

          <div className="cs-panel-header">

            <div>

              <div className="cs-panel-kicker">
                SURVEILLANCE
              </div>

              <h2>
                Target wallets under active
                surveillance
              </h2>

              <p className="cs-panel-subtext">
                Wallet records returned by the
                investigation backend.
              </p>

            </div>

            <button
              type="button"
              className="cs-panel-action"
              onClick={handleViewWallets}
            >
              View all
            </button>

          </div>

          <div className="cs-list cs-wallet-list">

            {loading ? (

              <div
                className="cs-row"
                style={{
                  justifyContent: "center",
                }}
              >
                Loading wallet surveillance data...
              </div>

            ) : watchedWallets.length === 0 ? (

              <div
                className="cs-row"
                style={{
                  justifyContent: "center",
                }}
              >
                <span className="cs-panel-subtext">
                  No wallet records are currently
                  available.
                </span>
              </div>

            ) : (

              watchedWallets
                .slice(0, 5)
                .map((wallet) => (
                  <article
                    className="cs-row cs-wallet-row"
                    key={
                      wallet.id ||
                      wallet.address
                    }
                  >

                    <div className="cs-wallet-main">

                      <div className="cs-row-title-line">

                        <span className="cs-row-title">
                          {formatWalletAddress(
                            wallet.address
                          )}
                        </span>

                        <span
                          className={`cs-badge ${getWalletRiskClass(
                            wallet.riskScore
                          )}`}
                        >
                          Risk:{" "}
                          {wallet.riskScore ||
                            "Low"}
                        </span>

                      </div>

                      <div className="cs-row-subtext cs-wallet-address">
                        {wallet.address}
                      </div>

                    </div>

                    <div className="cs-wallet-amount">

                      <div className="cs-row-title">
                        {formatWalletAmount(
                          wallet
                        )}
                      </div>

                      <div className="cs-row-subtext">
                        {formatWalletMeta(
                          wallet
                        )}
                      </div>

                    </div>

                  </article>
                ))

            )}

          </div>

        </section>

        {/* LIVE THREAT STREAM */}

        <section className="cs-panel cs-dashboard-panel cs-threat-panel">

          <div className="cs-panel-header">

            <div>

              <div className="cs-panel-kicker">
                MONITORING
              </div>

              <h2>
                Live threat stream
              </h2>

            </div>

            <div className="cs-live-status">

              <span className="cs-live-dot"></span>

              <span>
                Backend monitoring
              </span>

            </div>

          </div>

          <div className="cs-list cs-threat-list">

            <article className="cs-threat-item cs-threat-info">

              <div className="cs-threat-top">

                <span className="cs-threat-tag cs-threat-tag-info">
                  Wallet monitoring
                </span>

                <time>
                  Live
                </time>

              </div>

              <p>
                {dashboardStats.walletsTracked}{" "}
                wallet records are currently
                available from the backend.
              </p>

            </article>

            <article className="cs-threat-item cs-threat-medium">

              <div className="cs-threat-top">

                <span className="cs-threat-tag cs-threat-tag-medium">
                  Case monitoring
                </span>

                <time>
                  Live
                </time>

              </div>

              <p>
                {dashboardStats.activeCases}{" "}
                active investigation cases are
                currently open.
              </p>

            </article>

            <article className="cs-threat-item cs-threat-high">

              <div className="cs-threat-top">

                <span className="cs-threat-tag cs-threat-tag-high">
                  Critical cases
                </span>

                <time>
                  Live
                </time>

              </div>

              <p>
                {dashboardStats.criticalCases}{" "}
                critical-priority cases require
                investigation attention.
              </p>

            </article>

          </div>

        </section>

      </div>

    </div>
  );
}