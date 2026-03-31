import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FloatingCart from "../../components/FloatingCart/FloatingCart";
import CheckoutModal from "./CheckoutModal";
import { DELIVERY_BASE, STORAGE_KEYS } from "../../utils/api";
import { useTheme } from "../../utils/theme";
import "./ClientStore.css";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const readCart = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.cart) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
};

const normalizeProduct = (product) => {
  const id = product?.id ?? product?.product_id ?? product?.sample_product_id;
  const stockRaw = product?.stock ?? product?.quantity ?? product?.inventory;
  const stockValue = Number(stockRaw);
  const price = Number(
    product?.discounted_price ??
      product?.discountedPrice ??
      product?.sale_price ??
      product?.price ??
      0
  );
  const originalPrice = Number(
    product?.original_price ??
      product?.originalPrice ??
      product?.mrp ??
      product?.price ??
      price
  );

  return {
    id,
    name: product?.name || product?.title || "AeroDrop Product",
    description:
      product?.short_description ||
      product?.description ||
      "Fresh essentials with ultra-fast delivery.",
    image: product?.image_url || product?.image || product?.product_image || "",
    price: Number.isFinite(price) ? price : 0,
    originalPrice:
      Number.isFinite(originalPrice) && originalPrice >= price ? originalPrice : price,
    stock:
      stockRaw === undefined || stockRaw === null
        ? null
        : Number.isFinite(stockValue)
        ? stockValue
        : null,
  };
};

const resolveOrderId = (orderData) =>
  orderData?.order_id ??
  orderData?.id ??
  orderData?.order?.order_id ??
  orderData?.order?.id;

const readClient = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.client) || "{}");
  } catch (error) {
    return {};
  }
};

export default function ClientStore() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => readCart());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const client = useMemo(() => readClient(), []);

  const cartLookup = useMemo(() => {
    const map = new Map();
    cart.forEach((item) => map.set(item.id, item.quantity));
    return map;
  }, [cart]);

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${DELIVERY_BASE}/products`, {
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to load products right now.");
      }

      const list = Array.isArray(payload)
        ? payload
        : payload?.products || payload?.data || [];
      const normalized = list
        .map(normalizeProduct)
        .filter((item) => item.id !== undefined && item.id !== null);

      setProducts(normalized);
    } catch (requestError) {
      setProducts([]);
      setError(requestError?.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrderHistory = useCallback(async () => {
    if (!client?.user_id) return;

    setHistoryLoading(true);
    try {
      const response = await fetch(`${DELIVERY_BASE}/user-orders/${client.user_id}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setOrderHistory(Array.isArray(data.orders) ? data.orders : []);
      } else {
        setOrderHistory([]);
      }
    } catch (requestError) {
      setOrderHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [client?.user_id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (showOrders) {
      fetchOrderHistory();
    }
  }, [showOrders, fetchOrderHistory]);

  const addToCart = (product) => {
    if (product.stock === 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (product.stock !== null && existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const increaseQuantity = (productId) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== productId) return item;
        if (item.stock !== null && item.quantity >= item.stock) return item;
        return { ...item, quantity: item.quantity + 1 };
      })
    );
  };

  const decreaseQuantity = (productId) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const handleOrderPlaced = (orderData) => {
    const orderId = resolveOrderId(orderData);

    setCart([]);
    localStorage.removeItem(STORAGE_KEYS.cart);
    setIsCartOpen(false);
    setIsCheckoutOpen(false);

    if (!orderId) {
      window.alert("Order placed, but tracking id was not returned.");
      return;
    }

    navigate(`/track/${orderId}`, { state: { orderData } });
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.client);
    localStorage.removeItem("marsUser");
    localStorage.removeItem(STORAGE_KEYS.cart);
    navigate("/", { replace: true });
  };

  return (
    <main className="store-page page-enter">
      <section className="ui-shell store-shell glass-panel">
        <header className="store-header">
          <div className="store-hero-copy">
            <p className="ui-tag">AeroDrop Client Store</p>
            <h1>Instant essentials with demo-ready checkout.</h1>
            <p>
              {client?.name || client?.email || "Client"} is browsing a fast grid built for live
              orders, guest checkout, and realtime tracking.
            </p>
          </div>

          <div className="store-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              <div className="toggle-track">
                <div className="toggle-thumb" />
              </div>
              <span className="theme-toggle-label">{theme === "dark" ? "🌙 Dark" : "☀️ Light"}</span>
            </button>
            <button className="ui-btn ghost" onClick={() => setShowOrders(true)}>
              My Orders
            </button>
            <button className="ui-btn ghost" onClick={fetchProducts}>
              Refresh
            </button>
            <button className="ui-btn secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {loading && <div className="store-state">Loading products...</div>}
        {error && !loading && <div className="store-state error">{error}</div>}

        {!loading && !error && (
          <section className="store-grid">
            {products.map((product) => {
              const qty = cartLookup.get(product.id) || 0;
              const discount =
                product.originalPrice > product.price
                  ? Math.round(
                      ((product.originalPrice - product.price) / product.originalPrice) * 100
                    )
                  : 0;

              return (
                <article key={product.id} className="store-card">
                  <div className="store-image-wrap compact-image-wrap">
                    <div className={`store-card-badges${discount > 0 ? " has-offer" : ""}`}>
                      {discount > 0 ? (
                        <span className="store-badge offer">{discount}% OFF</span>
                      ) : null}
                      <span
                        className={`store-badge ${
                          product.stock === 0 ? "sold-out" : "available"
                        }`}
                      >
                        {product.stock === 0
                          ? "Sold out"
                          : product.stock
                          ? `${product.stock} left`
                          : "In stock"}
                      </span>
                    </div>

                    {product.image ? (
                      <img src={product.image} alt={product.name} className="store-image" />
                    ) : (
                      <div className="store-image-fallback">AeroDrop</div>
                    )}
                  </div>

                  <div className="store-card-body">
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>

                    <div className="store-price-row">
                      <strong>{formatPrice(product.price)}</strong>
                      {product.originalPrice > product.price ? (
                        <span>{formatPrice(product.originalPrice)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="store-card-footer">
                    {qty > 0 ? (
                      <div className="store-qty-controls">
                        <button type="button" onClick={() => decreaseQuantity(product.id)}>
                          -
                        </button>
                        <span>{qty}</span>
                        <button type="button" onClick={() => increaseQuantity(product.id)}>
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="store-add-button"
                        onClick={() => addToCart(product)}
                        disabled={product.stock === 0}
                      >
                        <span>{product.stock === 0 ? "Sold Out" : "Add"}</span>
                        <span className="store-add-plus">{product.stock === 0 ? "!" : "+"}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <FloatingCart count={cartCount} onClick={() => setIsCartOpen(true)} />

      {isCartOpen && (
        <div className="store-overlay" onClick={() => setIsCartOpen(false)}>
          <section className="store-cart glass-panel" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Cart</h2>
                <p>Review selected essentials before checkout.</p>
              </div>
              <button className="ui-btn ghost" onClick={() => setIsCartOpen(false)}>
                Close
              </button>
            </header>

            {cart.length === 0 ? (
              <p className="store-empty">Add products to start your order.</p>
            ) : (
              <div className="store-cart-list">
                {cart.map((item) => (
                  <article key={item.id} className="store-cart-item">
                    <div>
                      <h4>{item.name}</h4>
                      <p>{formatPrice(item.price)}</p>
                      <div className="store-qty-controls compact">
                        <button type="button" onClick={() => decreaseQuantity(item.id)}>
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => increaseQuantity(item.id)}>
                          +
                        </button>
                      </div>
                    </div>
                    <button className="ui-btn ghost" onClick={() => removeFromCart(item.id)}>
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            )}

            <footer>
              <div>
                <small>Total</small>
                <strong>{formatPrice(cartSubtotal)}</strong>
              </div>
              <button
                className="ui-btn secondary"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                disabled={cart.length === 0}
              >
                Proceed to Checkout
              </button>
            </footer>
          </section>
        </div>
      )}

      {isCheckoutOpen && (
        <CheckoutModal
          cart={cart}
          formatPrice={formatPrice}
          onClose={() => setIsCheckoutOpen(false)}
          onOrderPlaced={handleOrderPlaced}
        />
      )}

      {showOrders && (
        <div className="store-overlay" onClick={() => setShowOrders(false)}>
          <section className="store-orders glass-panel" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Order History</h2>
                <p>Track previous orders and resume the fulfillment flow.</p>
              </div>
              <button className="ui-btn ghost" onClick={() => setShowOrders(false)}>
                Close
              </button>
            </header>

            {historyLoading ? (
              <p className="store-empty">Loading your orders...</p>
            ) : orderHistory.length === 0 ? (
              <p className="store-empty">No orders found.</p>
            ) : (
              <div className="store-order-list">
                {orderHistory.map((order) => (
                  <article key={order.order_id} className="store-order-item">
                    <div>
                      <h4>Order #{order.order_id}</h4>
                      <p>{new Date(order.created_at).toLocaleString()}</p>
                      <strong className={order.status === "DELIVERED" ? "done" : "progress"}>
                        {order.status?.replace(/_/g, " ") || "-"}
                      </strong>
                    </div>
                    <button
                      className="ui-btn"
                      onClick={() => navigate(`/track/${order.order_id}`)}
                    >
                      Track
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
