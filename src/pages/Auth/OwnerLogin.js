import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OWNER_BASE, STORAGE_KEYS } from "../../utils/api";
import "./OwnerLogin.css";

const demoCredentials = {
  email: "owner@aerodrop.app",
  password: "aerodrop123",
};

const legacyCredentials = {
  email: "marsmate@gmail.com",
  password: "marsmate123",
};

export default function OwnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const tryLogin = async (credentialsList) => {
    setError("");
    setIsLoading(true);

    for (const creds of credentialsList) {
      try {
        const response = await fetch(`${OWNER_BASE}/aerodrop-owner/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(creds),
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          localStorage.setItem(STORAGE_KEYS.owner, JSON.stringify(data.owner || {}));
          localStorage.setItem("martOwner", JSON.stringify(data.owner || {}));
          navigate("/owner/dashboard", { replace: true });
          return;
        }
      } catch (requestError) {
      }
    }

    setError("Owner login failed.");
    setIsLoading(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await tryLogin([{ email, password }]);
  };

  const handleGuestLogin = async () => {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
    await tryLogin([demoCredentials, legacyCredentials]);
  };

  return (
    <main className="owner-auth-page page-enter">
      <section className="owner-auth-split-shell">
        <aside className="owner-auth-brand-panel">
          <div className="owner-auth-brand-glow owner-auth-brand-glow-top" aria-hidden="true" />
          <div className="owner-auth-brand-glow owner-auth-brand-glow-bottom" aria-hidden="true" />

          <div className="owner-auth-brand-content">
            <img
              className="owner-auth-brand-logo"
              src="/imagesd/AeroDrop_perfect_Logo.png"
              alt="AeroDrop Logo"
            />
            <div className="owner-auth-brand-copy">
              <p className="ui-tag">Owner Experience</p>
              <h1>Operations Command Center</h1>
              <p>
                Manage incoming orders, monitor product inventory, and handle active agents from a unified dashboard.
              </p>
            </div>
          </div>
        </aside>

        <section className="owner-auth-form-panel glass-panel">
          <button className="ui-btn ghost owner-auth-back" onClick={() => navigate("/")}>
            Back
          </button>

          <div className="owner-auth-form-intro">
            <p className="ui-tag">Owner Access</p>
            <h2>Admin Login</h2>
            <p className="owner-auth-copy">
              Sign in to manage operations.
            </p>
          </div>

          <form className="owner-auth-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input
                className="ui-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@aerodrop.app"
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
                placeholder="aerodrop123"
                required
              />
            </label>

            {error && <p className="owner-auth-error">{error}</p>}

            <div className="owner-auth-actions">
              <button className="ui-btn owner-auth-submit" type="submit" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Login"}
              </button>
              <button
                className="ui-btn secondary owner-auth-guest"
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoading}
              >
                Login as Guest / Demo
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
