import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function AppLayout() {
  return (
    <div className="cs-app-shell">
      <Navbar />

      <main className="cs-app-content">
        <Outlet />
      </main>
    </div>
  );
}