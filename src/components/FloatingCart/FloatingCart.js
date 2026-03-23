import React from "react";
import "./FloatingCart.css";

export default function FloatingCart({ count = 0, onClick }) {
  if (count <= 0) return null;

  return (
    <button className="floating-cart" onClick={onClick} aria-label={`Open cart with ${count} items`}>
      <span className="floating-cart-badge">{count}</span>
      <span className="floating-cart-label">Cart</span>
    </button>
  );
}
