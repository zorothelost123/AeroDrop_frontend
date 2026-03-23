import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OWNER_BASE, STORAGE_KEYS } from "../../utils/api";
import "./ClientLogin.css";

const demoCredentials = {
  email: "client@aerodrop.app",
  password: "client123",
};

const legacyCredentials = {
  email: "client@gmail.com",
  password: "client123",
};

export default function ClientLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(formData.email.trim() && formData.password.trim()) && !isLoading,
    [formData, isLoading]
  );

  const loginWithCredentials = async (credentialsList) => {
    setError("");
    setIsLoading(true);

    for (const creds of credentialsList) {
      try {
        const response = await fetch(`${OWNER_BASE}/client/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(creds),
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          localStorage.setItem(STORAGE_KEYS.client, JSON.stringify(data.user || {}));
          localStorage.setItem("marsUser", JSON.stringify(data.user || {}));
          navigate("/store", { replace: true });
          return;
        }
      } catch (requestError) {
      }
    }

    setError("Login failed. Check credentials or backend availability.");
    setIsLoading(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await loginWithCredentials([formData]);
  };

  const handleGuestLogin = async () => {
    setFormData(demoCredentials);
    await loginWithCredentials([demoCredentials, legacyCredentials]);
  };

  return (
    <main className="auth-page page-enter">
      <section className="auth-card glass-panel">
        <button className="ui-btn ghost auth-back" onClick={() => navigate("/")}>Back</button>

        <p className="ui-tag">Client Access</p>
        <h1>Welcome to AeroDrop Store</h1>
        <p className="auth-copy">Sign in to shop, checkout, and track live delivery.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              className="ui-input"
              type="email"
              value={formData.email}
              onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="client@aerodrop.app"
              required
            />
          </label>

          <label>
            Password
            <input
              className="ui-input"
              type="password"
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="client123"
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button className="ui-btn" type="submit" disabled={!canSubmit}>
            {isLoading ? "Signing In..." : "Login"}
          </button>
          <button className="ui-btn secondary" type="button" onClick={handleGuestLogin} disabled={isLoading}>
            Login as Guest / Demo
          </button>
        </form>
      </section>
    </main>
  );
}
