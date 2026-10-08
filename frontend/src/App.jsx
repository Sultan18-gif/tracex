import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import Dashboard from "./pages/Dashboard";
import WalletInvestigation from "./pages/WalletInvestigation";
import Transactions from "./pages/Transactions";
import NetworkGraph from "./pages/NetworkGraph";
import Cases from "./pages/Cases";
import Reports from "./pages/Reports";
import VASPs from "./pages/VASPs";

import AppLayout from "./layout/AppLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Authentication */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Application */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/wallet-investigation"
            element={<WalletInvestigation />}
          />

          <Route path="/transactions" element={<Transactions />} />
          <Route path="/network" element={<NetworkGraph />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/vasps" element={<VASPs />} />
        </Route>

        {/* Unknown route */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}