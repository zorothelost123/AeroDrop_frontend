const rawBaseUrl = process.env.REACT_APP_API_URL || "";

// Trim trailing slashes so `${BASE_URL}/...` joins remain stable.
export const BASE_URL = rawBaseUrl.replace(/\/+$/, "");
export const RAZORPAY_KEY = process.env.REACT_APP_RAZORPAY_KEY_ID || "rzp_test_RKuD49k1DsaIa2";
export const API_BASE = `${BASE_URL}/api`;
export const DELIVERY_BASE = `${API_BASE}/delivery`;
export const OWNER_BASE = `${API_BASE}/owner`;
export const ADDRESS_BASE = `${API_BASE}/address`;
export const PAYMENT_BASE = `${API_BASE}/payment`;

export const STORAGE_KEYS = {
  client: "aero-client",
  owner: "aero-owner",
  agent: "mm-agent",
  agentToken: "mm-agent-token",
  cart: "aero-cart-items",
};
