import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DELIVERY_BASE, STORAGE_KEYS } from "../../utils/api";
import "./AgentLogin.css";

const demoCredentials = {
  agent_id: "DP-1001",
  password: "123456",
};

export default function AgentLogin() {
  const navigate = useNavigate();
  const [agentId, setAgentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const attemptLogin = async (credentials) => {
    try {
      const response = await fetch(`${DELIVERY_BASE}/agent/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        localStorage.setItem(STORAGE_KEYS.agent, JSON.stringify(data.agent || {}));
        localStorage.setItem(STORAGE_KEYS.agentToken, data.token || "");
        navigate("/agent/panel", { replace: true });
        return true;
      }
    } catch (requestError) {
    }

    return false;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    const success = await attemptLogin({ agent_id: agentId, password });
    if (!success) {
      setError("Agent login failed.");
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setAgentId(demoCredentials.agent_id);
    setPassword(demoCredentials.password);

    setError("");
    setIsLoading(true);
    const success = await attemptLogin(demoCredentials);
    if (!success) {
      setError("Guest login failed. Verify backend demo credentials.");
      setIsLoading(false);
    }
  };

  return (
    <main className="agent-auth-page page-enter">
      <section className="agent-auth-card glass-panel">
        <button className="ui-btn ghost agent-back" onClick={() => navigate("/")}>Back</button>

        <p className="ui-tag">Agent Access</p>
        <h1>Delivery Partner Login</h1>
        <p className="agent-copy">Connect to live jobs and publish realtime location updates.</p>

        <form className="agent-form" onSubmit={handleSubmit}>
          <label>
            Agent ID
            <input
              className="ui-input"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              placeholder="DP-1001"
              required
            />
          </label>

          <label>
            Password
            <input
              className="ui-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="123456"
              required
            />
          </label>

          {error && <p className="agent-error">{error}</p>}

          <button className="ui-btn" type="submit" disabled={isLoading}>
            {isLoading ? "Connecting..." : "Login"}
          </button>
          <button className="ui-btn secondary" type="button" onClick={handleGuestLogin} disabled={isLoading}>
            Login as Guest / Demo
          </button>
        </form>
      </section>
    </main>
  );
}
