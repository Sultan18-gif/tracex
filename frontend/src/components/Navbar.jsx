import { useState } from "react";
import Sidebar from "./Sidebar";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    window.location.href = "/";
  };

  return (
    <>
      <header className="cs-navbar">
        {/* LEFT */}
        <div className="cs-navbar-left">
          <button
            type="button"
            className="cs-menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="cs-navbar-brand">Chain Sentry</div>
        </div>

        {/* RIGHT */}
        <div className="cs-navbar-right">
          <div className="cs-system-status">
            <span className="cs-status-dot"></span>
            <span>System online</span>
          </div>

          {/* PROFILE */}
          <div className="cs-profile-wrapper">
            <button
              type="button"
              className="cs-profile-button"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="Open user profile"
              aria-expanded={profileOpen}
            >
              <div className="cs-profile-avatar">SI</div>

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

            {/* PROFILE PANEL */}
            {profileOpen && (
              <div className="cs-profile-panel">
                <div className="cs-profile-panel-header">
                  <div className="cs-profile-avatar-large">SI</div>

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

                <div className="cs-profile-info">
                  <div className="cs-profile-info-row">
                    <span>Agency ID</span>
                    <strong>INV-001</strong>
                  </div>

                  <div className="cs-profile-info-row">
                    <span>Role</span>
                    <strong>Senior Investigator</strong>
                  </div>

                  <div className="cs-profile-info-row">
                    <span>Access</span>
                    <strong className="cs-access-level">
                      Full investigation
                    </strong>
                  </div>

                  <div className="cs-profile-info-row">
                    <span>Session</span>
                    <strong className="cs-session-status">
                      Active
                    </strong>
                  </div>
                </div>

                <div className="cs-profile-line"></div>

                <button
                  type="button"
                  className="cs-profile-logout"
                  onClick={handleLogout}
                >
                  <span>↪</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}