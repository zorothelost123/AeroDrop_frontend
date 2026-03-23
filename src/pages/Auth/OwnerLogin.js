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
      <section className="owner-auth-card glass-panel">
        <button className="ui-btn ghost owner-back" onClick={() => navigate("/")}>Back</button>
        <p className="ui-tag">Owner Access</p>
        <h1>Owner Console Login</h1>
        <p className="owner-copy">Manage incoming orders and dispatch flow in one place.</p>

        <form className="owner-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input className="ui-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Password
            <input className="ui-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error && <p className="owner-error">{error}</p>}

          <button className="ui-btn" type="submit" disabled={isLoading}>
            {isLoading ? "Verifying..." : "Login"}
          </button>
          <button className="ui-btn secondary" type="button" onClick={handleGuestLogin} disabled={isLoading}>
            Login as Guest / Demo
          </button>
        </form>
      </section>
    </main>
  );
}
