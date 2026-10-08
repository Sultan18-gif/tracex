import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // =========================================================
  // LOGOUT
  // ONLY the Sign out button calls this function.
  // =========================================================
  const handleLogout = () => {
    setProfileOpen(false);
    setMenuOpen(false);

    localStorage.removeItem("authenticated");

    // Go to login page only when the user explicitly
    // clicks "Sign out".
    window.location.href = "/";
  };

  // =========================================================
  // BACK BUTTON
  // This NEVER logs the user out.
  //
  // If there is a previous application page, go back.
  // If going back would take the user to "/", go to Dashboard.
  // =========================================================
  const handleBack = () => {
    setProfileOpen(false);

    const currentPath = location.pathname;

    // Already on Dashboard — nothing to go back to.
    if (currentPath === "/dashboard") {
      return;
    }

    // Browser history information.
    const historyLength = window.history.length;

    // If there isn't enough history, safely return to Dashboard.
    if (historyLength <= 1) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // Check the previous history URL when possible.
    const referrer = document.referrer;

    // If the previous page was the login/root page,
    // NEVER navigate back to it.
    if (
      referrer &&
      referrer.startsWith(window.location.origin) &&
      new URL(referrer).pathname === "/"
    ) {
      navigate("/dashboard");
      return;
    }

    // Normal Back navigation.
    navigate(-1);
  };

  const navigation = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: "⌂",
    },
    {
      name: "Wallet Investigation",
      path: "/wallet-investigation",
      icon: "⌕",
    },
    {
      name: "Transactions",
      path: "/transactions",
      icon: "⇄",
    },
    {
      name: "VASP Network",
      path: "/vasps",
      icon: "◇",
    },
    {
      name: "Network Graph",
      path: "/network",
      icon: "⌁",
    },
    {
      name: "Cases",
      path: "/cases",
      icon: "▣",
    },
    {
      name: "Reports",
      path: "/reports",
      icon: "▤",
    },
  ];

  return (
    <>
      <header className="cs-navbar">

        {/* =====================================================
            LEFT
        ====================================================== */}
        <div className="cs-navbar-left">

          {/* TRACEX BRAND */}
          <NavLink
            to="/dashboard"
            className="cs-navbar-brand"
            onClick={() => setProfileOpen(false)}
          >
            TRACEX
          </NavLink>

          {/* =================================================
              BACK BUTTON

              IMPORTANT:
              This button does NOT call handleLogout().
              It only calls handleBack().
          ================================================= */}
          <button
            type="button"
            className="cs-back-button"
            onClick={handleBack}
            title="Go back"
            aria-label="Go back to previous page"
          >
            <span className="cs-back-icon">
              ←
            </span>

            <span className="cs-back-text">
              Back
            </span>
          </button>

        </div>

        {/* =====================================================
            MAIN NAVIGATION
        ====================================================== */}
        <nav
          className="cs-main-navigation"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `cs-main-nav-link ${
                  isActive
                    ? "cs-main-nav-link-active"
                    : ""
                }`
              }
              onClick={() => {
                setProfileOpen(false);
              }}
            >
              <span className="cs-main-nav-icon">
                {item.icon}
              </span>

              <span className="cs-main-nav-label">
                {item.name}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* =====================================================
            RIGHT
        ====================================================== */}
        <div className="cs-navbar-right">

          {/* SYSTEM STATUS */}
          <div className="cs-system-status">
            <span className="cs-status-dot"></span>

            <span>
              System online
            </span>
          </div>

          {/* PROFILE */}
          <div className="cs-profile-wrapper">

            <button
              type="button"
              className="cs-profile-button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
              }}
              aria-label="Open user profile"
              aria-expanded={profileOpen}
            >
              <div className="cs-profile-avatar">
                SI
              </div>

              <div className="cs-profile-text">
                <span className="cs-profile-name">
                  Senior Investigator
                </span>

                <span className="cs-profile-role">
                  Investigation Unit
                </span>
              </div>

              <span className="cs-profile-chevron">
                {profileOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {/* =================================================
                PROFILE DROPDOWN
            ================================================= */}
            {profileOpen && (
              <div className="cs-profile-panel">

                {/* PROFILE HEADER */}
                <div className="cs-profile-panel-header">

                  <div className="cs-profile-avatar-large">
                    SI
                  </div>

                  <div>
                    <div className="cs-profile-panel-name">
                      Senior Investigator
                    </div>

                    <div className="cs-profile-panel-email">
                      investigator@agency.gov
                    </div>
                  </div>

                </div>

                <div className="cs-profile-line"></div>

                {/* PROFILE INFORMATION */}
                <div className="cs-profile-info">

                  <div className="cs-profile-info-row">
                    <span>
                      Agency ID
                    </span>

                    <strong>
                      INV-001
                    </strong>
                  </div>

                  <div className="cs-profile-info-row">
                    <span>
                      Role
                    </span>

                    <strong>
                      Senior Investigator
                    </strong>
                  </div>

                  <div className="cs-profile-info-row">
                    <span>
                      Access
                    </span>

                    <strong className="cs-access-level">
                      Full investigation
                    </strong>
                  </div>

                  <div className="cs-profile-info-row">
                    <span>
                      Session
                    </span>

                    <strong className="cs-session-status">
                      Active
                    </strong>
                  </div>

                </div>

                <div className="cs-profile-line"></div>

                {/* =================================================
                    SIGN OUT

                    THIS IS THE ONLY PLACE WHERE LOGOUT HAPPENS.
                ================================================= */}
                <button
                  type="button"
                  className="cs-profile-logout"
                  onClick={handleLogout}
                >
                  <span>
                    ↪
                  </span>

                  Sign out
                </button>

              </div>
            )}

          </div>

        </div>

      </header>

      {/* SIDEBAR */}
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}