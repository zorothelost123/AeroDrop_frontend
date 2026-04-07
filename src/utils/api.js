const LOCAL_API_BASE_URL = "http://localhost:5000";

const resolveBaseUrl = () => {
  const configuredBaseUrl = String(process.env.REACT_APP_API_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return LOCAL_API_BASE_URL;
    }
  }

  return "";
};

const rawBaseUrl = resolveBaseUrl();

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
  clientToken: "aero-client-token",
  owner: "aero-owner",
  ownerToken: "aero-owner-token",
  agent: "mm-agent",
  agentToken: "mm-agent-token",
  cart: "aero-cart-items",
};

const readStoredToken = (storageKey) => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(storageKey) || "";
};

const buildAuthHeaders = (storageKey, headers = {}) => {
  const token = readStoredToken(storageKey);

  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getClientAuthHeaders = (headers = {}) =>
  buildAuthHeaders(STORAGE_KEYS.clientToken, headers);

export const getOwnerAuthHeaders = (headers = {}) =>
  buildAuthHeaders(STORAGE_KEYS.ownerToken, headers);
