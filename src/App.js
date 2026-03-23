import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AeroDropHome from "./pages/AeroDropHome/AeroDropHome";
import ClientLogin from "./pages/Auth/ClientLogin";
import OwnerLogin from "./pages/Auth/OwnerLogin";
import AgentLogin from "./pages/Auth/AgentLogin";
import ClientStore from "./pages/ClientStore/ClientStore";
import Tracker from "./pages/Tracker/Tracker";
import OwnerDashboard from "./pages/OwnerDashboard/OwnerDashboard";
import AgentPanel from "./pages/AgentPanel/AgentPanel";
import { STORAGE_KEYS } from "./utils/api";

const RequireClient = ({ children }) => {
  const client = localStorage.getItem(STORAGE_KEYS.client);
  return client ? children : <Navigate to="/client/login" replace />;
};

const RequireOwner = ({ children }) => {
  const owner = localStorage.getItem(STORAGE_KEYS.owner);
  return owner ? children : <Navigate to="/owner/login" replace />;
};

const RequireAgent = ({ children }) => {
  const agentToken = localStorage.getItem(STORAGE_KEYS.agentToken);
  const agent = localStorage.getItem(STORAGE_KEYS.agent);
  return agent && agentToken ? (
    children
  ) : (
    <Navigate to="/agent/login" replace />
  );
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AeroDropHome />} />

      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/owner/login" element={<OwnerLogin />} />
      <Route path="/agent/login" element={<AgentLogin />} />

      <Route
        path="/store"
        element={
          <RequireClient>
            <ClientStore />
          </RequireClient>
        }
      />
      <Route
        path="/client-store"
        element={
          <RequireClient>
            <ClientStore />
          </RequireClient>
        }
      />
      <Route
        path="/track/:orderId"
        element={
          <RequireClient>
            <Tracker />
          </RequireClient>
        }
      />
      <Route
        path="/owner/dashboard"
        element={
          <RequireOwner>
            <OwnerDashboard />
          </RequireOwner>
        }
      />
      <Route
        path="/agent/panel"
        element={
          <RequireAgent>
            <AgentPanel />
          </RequireAgent>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
