import { NavLink } from "react-router-dom";

export default function Sidebar({ open, onClose }) {
  const links = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Transactions", path: "/transactions" },
  { name: "VASP Network", path: "/vasps" },
  { name: "Network Graph", path: "/network" },
  { name: "Reports", path: "/reports" },
];

  const handleClose = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onClose();
  };

  return (
    <>
      {open && (
        <div
          className="cs-menu-overlay"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`cs-menu ${open ? "cs-menu-open" : ""}`}
        inert={!open}
      >
        <div className="cs-menu-header">
          <span>TRACEX</span>

          <button
            type="button"
            className="cs-menu-close"
            onClick={handleClose}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <nav className="cs-menu-nav" aria-label="Main navigation">
          <ul className="cs-menu-list">
            {links.map((link) => (
              <li key={link.path}>
                <NavLink
                  to={link.path}
                  onClick={handleClose}
                  className={({ isActive }) =>
                    `cs-menu-link ${
                      isActive ? "cs-menu-link-active" : ""
                    }`
                  }
                >
                  {link.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}