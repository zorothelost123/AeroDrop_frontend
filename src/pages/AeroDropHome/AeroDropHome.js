import React from "react";
import { useNavigate } from "react-router-dom";
import "./AeroDropHome.css";

export default function AeroDropHome() {
  const navigate = useNavigate();

  const handleSearch = () => {
    navigate("/client-store");
  };

  return (
    <div className="aerodrop-home-container">
      <nav className="aero-navbar">
        <div className="nav-logo">
          <h2>AeroDrop</h2>
        </div>

        <div className="nav-links">
          <span className="nav-item" onClick={() => navigate("/client-store")}>
            Explore
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="nav-item"
          >
            GitHub
          </a>
          <button className="get-started-btn" onClick={() => navigate("/client-store")}>
            Get Started
          </button>
        </div>
      </nav>

      <main className="hero-section">
        <div className="hero-image-left">
          <img src="/imagesd/Vegetables.png" alt="Fresh Groceries" />
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            Next-Gen <br />
            <span className="highlight-text">Delivery Infrastructure</span>
          </h1>
          <p className="hero-subtitle">
            Order Food &amp; Groceries instantly. Discover the best local stores and agents
            around you.
          </p>

          <div className="search-bar-wrapper">
            <input
              type="text"
              className="location-input"
              placeholder="Enter delivery location (e.g., Guntur, Hyderabad)"
            />
            <button className="find-food-btn" onClick={handleSearch}>
              Find Food
            </button>
          </div>
        </div>

        <div className="hero-image-right">
          <img src="/imagesd/Biryani.jpg" alt="Restaurant Food" />
        </div>
      </main>
    </div>
  );
}
