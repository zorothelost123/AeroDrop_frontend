import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AeroDropHome.css";

const moduleGuides = [
  {
    id: "client",
    title: "Client Module",
    summary: "Shop, checkout, pin the map precisely, and watch the live delivery flow begin.",
    instructions: [
      {
        label: "Important",
        text: "For this demo, please open three separate browser tabs: one for Client, one for Owner, and one for Agent.",
      },
      {
        text: "In the Client tab, browse our sample items (Milk, Bread, etc.) and add them to your Floating Cart.",
      },
      {
        text: "Navigate to Checkout. You don't need real login credentials; use the provided guest access.",
      },
      {
        label: "Crucial",
        text: "On the checkout map, manually drag and drop the map pin to your desired delivery location. Our system uses precision mapping.",
      },
      {
        text: "Place your order. Your 30-second cancellation buffer will start instantly. If you change your mind, hit cancel!",
      },
      {
        text: "Watch the Live Tracking page to see the real-time status as the Agent accepts the order.",
      },
    ],
  },
  {
    id: "owner",
    title: "Owner Module",
    summary: "Use the operations command center to catch orders inside the live acceptance window.",
    instructions: [
      {
        label: "Important",
        text: "Monitor this panel simultaneously with the Client and Agent panels.",
      },
      {
        text: "Login with the owner guest credentials. This is your command center.",
      },
      {
        text: "Watch for incoming order requests. When a client places an order, it will pop up here.",
      },
      {
        label: "Crucial",
        text: "You must accept the request within the 30-second buffer window before it expires. This mirrors real-world order acceptance dynamics.",
      },
      {
        text: "After accepting, monitor the full fulfillment cycle from Unassigned to Delivered in one unified workflow.",
      },
    ],
  },
  {
    id: "agent",
    title: "Agent Module",
    summary: "Match the client's zone, go online, accept the job, and finish the OTP verification loop.",
    instructions: [
      {
        label: "Important",
        text: "Ensure your Work Zone matches the Client's delivery location.",
      },
      {
        text: "Use the agent guest credentials to login.",
      },
      {
        label: "Crucial",
        text: "First, go to 'Work Zone' settings. You must manually set your delivery zone (e.g., Guntur or Hyderabad) to match the Client's chosen delivery address.",
      },
      {
        text: "Toggle your status to 'Online' to receive orders. If you are Offline, you are invisible to the system.",
      },
      {
        text: "Accept the available 'Unassigned' order from the dashboard.",
      },
      {
        text: "Update your delivery status in real-time as you arrive at the store and pick up the items.",
      },
      {
        label: "Verification",
        text: "Upon arrival at the client's map pin, provide the OTP to complete the fulfillment loop.",
      },
    ],
  },
];

const accessCards = [
  {
    title: "🛒 Client Store",
    description: "Order items & track delivery.",
    route: "/client/login",
  },
  {
    title: "⚙️ Owner Dashboard",
    description: "Manage orders & dispatch agents.",
    route: "/owner/login",
  },
  {
    title: "🛵 Agent Panel",
    description: "Accept jobs & update locations.",
    route: "/agent/login",
  },
];

export default function AeroDropHome() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState("light");
  const [openModule, setOpenModule] = useState("client");

  const handleSearch = () => {
    navigate("/client-store");
  };

  const toggleModule = (moduleId) => {
    setOpenModule((current) => (current === moduleId ? null : moduleId));
  };

  return (
    <div className={`aerodrop-home-container${theme === "dark" ? " dark-mode" : ""}`}>
      <nav className="aero-navbar">
        <button type="button" className="nav-logo" onClick={() => navigate("/")}>
          <img src="/imagesd/AeroDrop_perfect_Logo.png" alt="AeroDrop Logo" />
          <span>AeroDrop</span>
        </button>

        <div className="nav-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span className="theme-toggle-label">
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </span>
          </button>

          <a
            href="https://github.com/zorothelost123/AeroDrop_frontend"
            target="_blank"
            rel="noreferrer"
            className="nav-link"
          >
            GitHub
          </a>

          <button
            type="button"
            className="get-started-btn"
            onClick={() => navigate("/client-store")}
          >
            Get Started
          </button>
        </div>
      </nav>

      <main className="home-scroll-layout">
        <section className="hero-section">
          <div className="hero-image-shell hero-image-left" aria-hidden="true">
            <div className="hero-image-float hero-image-float-left">
              <img className="hero-image-art" src="/imagesd/Vegetables.png" alt="" />
            </div>
          </div>

          <div className="hero-content">
            <p className="hero-eyebrow">AeroDrop Delivery Network</p>
            <h1 className="hero-title">
              Order faster. Dispatch smarter.
              <span className="highlight-text">One premium delivery surface.</span>
            </h1>
            <p className="hero-subtitle">
              Food, groceries, and rapid last-mile coordination in a landing experience inspired
              by Swiggy, adapted for AeroDrop.
            </p>

            <div className="search-bar-wrapper">
              <input
                type="text"
                className="location-input"
                placeholder="Enter delivery location (e.g., Guntur, Hyderabad)"
              />
              <button type="button" className="find-food-btn" onClick={handleSearch}>
                Find Food
              </button>
            </div>
          </div>

          <div className="hero-image-shell hero-image-right" aria-hidden="true">
            <div className="hero-image-float hero-image-float-right">
              <img className="hero-image-art" src="/imagesd/Biryani.jpg" alt="" />
            </div>
          </div>
        </section>

        <section className="ui-shell access-cards-section">
          {accessCards.map((card) => (
            <button
              key={card.title}
              type="button"
              className="access-card"
              onClick={() => navigate(card.route)}
            >
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </button>
          ))}
        </section>

        <section className="modules-features-section demo-guide-section">
          <div className="section-header">
            <p className="section-eyebrow">Phase 3 Demo Guide</p>
            <h2>Demo Guide</h2>
            <p className="section-copy">
              Open each module to follow the full end-to-end AeroDrop simulation. Run the Client,
              Owner, and Agent panels simultaneously to understand our demo flow.
            </p>
          </div>

          <div className="accordion-list">
            {moduleGuides.map((module) => {
              const isOpen = openModule === module.id;

              return (
                <article
                  key={module.id}
                  className={`accordion-item${isOpen ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="accordion-trigger"
                    onClick={() => toggleModule(module.id)}
                    aria-expanded={isOpen}
                    aria-controls={`${module.id}-panel`}
                  >
                    <div className="accordion-trigger-copy">
                      <p className="accordion-kicker">Interactive Walkthrough</p>
                      <h3>{module.title}</h3>
                      <p className="accordion-summary">{module.summary}</p>
                    </div>
                    <span className="accordion-icon" aria-hidden="true">
                      +
                    </span>
                  </button>

                  <div
                    id={`${module.id}-panel`}
                    className="accordion-panel"
                    aria-hidden={!isOpen}
                  >
                    <div className="accordion-panel-inner">
                      <ol className="instruction-list">
                        {module.instructions.map((instruction, index) => (
                          <li key={`${module.id}-${index}`} className="instruction-item">
                            {instruction.label ? <strong>{instruction.label}: </strong> : null}
                            <span>{instruction.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
