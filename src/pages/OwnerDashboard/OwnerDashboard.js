import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { BASE_URL, DELIVERY_BASE, STORAGE_KEYS } from "../../utils/api";
import "./OwnerDashboard.css";

const readOwner = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.owner) || "{}");
  } catch (error) {
    return {};
  }
};

const parseItems = (items) => {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const owner = useMemo(() => readOwner(), []);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [latestOrder, setLatestOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`${DELIVERY_BASE}/owner/orders`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      const list = data?.orders || data || [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (requestError) {
      setError("Unable to fetch owner orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const polling = setInterval(fetchOrders, 10000);
    return () => clearInterval(polling);
  }, [fetchOrders]);

  useEffect(() => {
    const socket = io(BASE_URL);

    socket.on("new_order", (payload) => {
      fetchOrders();
      if (payload?.order) {
        setLatestOrder(payload.order);
      }
    });

    return () => socket.disconnect();
  }, [fetchOrders]);

  const handleAccept = async (orderId) => {
    await fetch(`${DELIVERY_BASE}/owner/orders/${orderId}/accept`, {
      method: "POST",
      credentials: "include",
    });
    fetchOrders();
  };

  const handleDecline = async (orderId) => {
    await fetch(`${DELIVERY_BASE}/owner/orders/${orderId}/decline`, {
      method: "POST",
      credentials: "include",
    });
    fetchOrders();
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.owner);
    localStorage.removeItem("martOwner");
    navigate("/", { replace: true });
  };

  const summary = useMemo(() => {
    const pending = orders.filter((order) => order.status === "PENDING").length;
    const active = orders.filter((order) =>
      ["UNASSIGNED", "PREPARING", "ON_THE_WAY", "REACHED"].includes(order.status)
    ).length;
    const delivered = orders.filter((order) => order.status === "DELIVERED").length;

    return { pending, active, delivered };
  }, [orders]);

  return (
    <main className="owner-page page-enter">
      <section className="ui-shell owner-shell glass-panel">
        <header className="owner-header">
          <div>
            <p className="ui-tag">AeroDrop Owner Dashboard</p>
            <h1>Order Control Center</h1>
            <p>{owner?.name || owner?.email || "Owner"}</p>
          </div>

          <div className="owner-actions">
            <button className="ui-btn ghost" onClick={fetchOrders}>
              Refresh
            </button>
            <button className="ui-btn secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="owner-stats">
          <article className="glass-panel">
            <h3>Pending</h3>
            <strong>{summary.pending}</strong>
          </article>
          <article className="glass-panel">
            <h3>Active</h3>
            <strong>{summary.active}</strong>
          </article>
          <article className="glass-panel">
            <h3>Delivered</h3>
            <strong>{summary.delivered}</strong>
          </article>
        </section>

        {loading && <div className="owner-state">Loading orders...</div>}
        {error && !loading && <div className="owner-state error">{error}</div>}

        {!loading && !error && (
          <section className="owner-orders">
            {orders.length === 0 ? (
              <div className="owner-state">No orders available.</div>
            ) : (
              orders.map((order) => {
                const items = parseItems(order.items);
                return (
                  <article key={order.order_id || order.id} className="owner-order-card glass-panel">
                    <header>
                      <h2>Order #{order.order_id || order.id}</h2>
                      <span className={`status-pill ${String(order.status || "").toLowerCase()}`}>
                        {String(order.status || "-").replace(/_/g, " ")}
                      </span>
                    </header>

                    <p className="owner-order-meta">
                      Created: {order.created_at ? new Date(order.created_at).toLocaleString() : "-"}
                    </p>
                    <p className="owner-order-meta">Total: Rs {order.total_amount ?? "-"}</p>

                    {items.length > 0 && (
                      <ul className="owner-item-list">
                        {items.map((item, index) => (
                          <li key={`${order.order_id || order.id}-${index}`}>
                            <span>{item.quantity || 1}x {item.name || "Item"}</span>
                            <strong>Rs {Number(item.price || 0) * Number(item.quantity || 1)}</strong>
                          </li>
                        ))}
                      </ul>
                    )}

                    {order.status === "PENDING" && (
                      <div className="owner-order-actions">
                        <button className="ui-btn" onClick={() => handleAccept(order.order_id)}>
                          Accept
                        </button>
                        <button className="ui-btn secondary" onClick={() => handleDecline(order.order_id)}>
                          Decline
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        )}
      </section>

      {latestOrder && (
        <aside className="owner-toast glass-panel">
          <div>
            <strong>New Order #{latestOrder.order_id}</strong>
            <p>{latestOrder.total_amount ? `Rs ${latestOrder.total_amount}` : "Incoming order"}</p>
          </div>
          <button className="ui-btn ghost" onClick={() => setLatestOrder(null)}>Dismiss</button>
        </aside>
      )}
    </main>
  );
}
