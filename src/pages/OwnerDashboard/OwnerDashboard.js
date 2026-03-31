import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { BASE_URL, DELIVERY_BASE, STORAGE_KEYS } from "../../utils/api";
import { useTheme } from "../../utils/theme";
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

  const [activeTab, setActiveTab] = useState("Orders");
  const { theme, toggleTheme } = useTheme();

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [latestOrder, setLatestOrder] = useState(null);

  // Products State
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", image_url: "", category: "" });

  // Agents State
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", phone: "", vehicle_type: "" });

  // ---------------- FETCHING ----------------

  const fetchOrders = useCallback(async () => {
    setOrdersError("");
    try {
      const response = await fetch(`${DELIVERY_BASE}/owner/orders`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      const list = data?.orders || data || [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (err) {
      setOrdersError("Unable to fetch owner orders.");
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(`${DELIVERY_BASE}/products`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      const list = data?.products || data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("fetchProducts error:", err);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`${DELIVERY_BASE}/owner/agents`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      const list = data?.agents || data || [];
      setAgents(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("fetchAgents error:", err);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchAgents();
    const polling = setInterval(fetchOrders, 10000);
    return () => clearInterval(polling);
  }, [fetchOrders, fetchProducts, fetchAgents]);

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

  // ---------------- HANDLERS ----------------

  const handleAccept = async (orderId) => {
    await fetch(`${DELIVERY_BASE}/owner/orders/${orderId}/accept`, {
      method: "POST", credentials: "include",
    });
    fetchOrders();
  };

  const handleDecline = async (orderId) => {
    await fetch(`${DELIVERY_BASE}/owner/orders/${orderId}/decline`, {
      method: "POST", credentials: "include",
    });
    fetchOrders();
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.owner);
    localStorage.removeItem("martOwner");
    navigate("/", { replace: true });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${DELIVERY_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newProduct),
      });
      fetchProducts();
      setShowAddProduct(false);
      setNewProduct({ name: "", price: "", image_url: "", category: "" });
    } catch (err) {
      console.error("handleAddProduct error:", err);
    }
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${DELIVERY_BASE}/owner/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newAgent),
      });
      fetchAgents();
      setShowAddAgent(false);
      setNewAgent({ name: "", phone: "", vehicle_type: "" });
    } catch (err) {
      console.error("handleAddAgent error:", err);
    }
  };

  const summary = useMemo(() => {
    const pending = orders.filter((o) => o.status === "PENDING").length;
    const active = orders.filter((o) => ["UNASSIGNED", "PREPARING", "ON_THE_WAY", "REACHED"].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    return { pending, active, delivered };
  }, [orders]);

  // ---------------- RENDERERS ----------------

  const renderOrdersTab = () => (
    <div className="dashboard-tab-content">
      <header className="tab-header">
        <div>
          <h2>Order Control Center</h2>
          <p>Manage incoming customer orders and fulfillment</p>
        </div>
        <button className="ui-btn ghost" onClick={fetchOrders}>Refresh Orders</button>
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

      {loadingOrders && <div className="owner-state">Loading orders...</div>}
      {ordersError && !loadingOrders && <div className="owner-state error">{ordersError}</div>}

      {!loadingOrders && !ordersError && (
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
                      <button className="ui-btn btn-accept" onClick={() => handleAccept(order.order_id)}>
                        Accept
                      </button>
                      <button className="ui-btn btn-decline" onClick={() => handleDecline(order.order_id)}>
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
    </div>
  );

  const renderProductsTab = () => (
    <div className="dashboard-tab-content">
      <header className="tab-header">
        <div>
          <h2>Product Inventory</h2>
          <p>Manage store items and availability</p>
        </div>
        <button className="ui-btn" onClick={() => setShowAddProduct(!showAddProduct)}>
          {showAddProduct ? "Cancel" : "Add New Product"}
        </button>
      </header>

      {showAddProduct && (
        <form className="inline-add-form glass-panel" onSubmit={handleAddProduct}>
          <h3>Add New Product</h3>
          <div className="form-grid">
            <label>Name
              <input className="ui-input" type="text" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
            </label>
            <label>Price (Rs)
              <input className="ui-input" type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
            </label>
            <label>Category
              <input className="ui-input" type="text" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} required />
            </label>
            <label>Image URL
              <input className="ui-input" type="url" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} />
            </label>
          </div>
          <button className="ui-btn" type="submit">Save Product</button>
        </form>
      )}

      {loadingProducts ? (
        <div className="owner-state">Loading products...</div>
      ) : (
        <div className="saas-table-container glass-panel">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan="4" className="empty-cell">No products found.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="table-img" /> : <div className="table-img-placeholder"/>}
                    </td>
                    <td>{p.name}</td>
                    <td><span className="pill-category">{p.category || "Uncategorized"}</span></td>
                    <td>Rs {p.price}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderAgentsTab = () => (
    <div className="dashboard-tab-content">
      <header className="tab-header">
        <div>
          <h2>Delivery Agents</h2>
          <p>Manage registered personnel and fleet</p>
        </div>
        <button className="ui-btn" onClick={() => setShowAddAgent(!showAddAgent)}>
          {showAddAgent ? "Cancel" : "Add New Agent"}
        </button>
      </header>

      {showAddAgent && (
        <form className="inline-add-form glass-panel" onSubmit={handleAddAgent}>
          <h3>Add New Agent</h3>
          <div className="form-grid">
            <label>Name
              <input className="ui-input" type="text" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} required />
            </label>
            <label>Phone Number
              <input className="ui-input" type="tel" value={newAgent.phone} onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })} required />
            </label>
            <label>Vehicle Type
              <input className="ui-input" type="text" placeholder="e.g. Scooter, Bike" value={newAgent.vehicle_type} onChange={(e) => setNewAgent({ ...newAgent, vehicle_type: e.target.value })} required />
            </label>
          </div>
          <button className="ui-btn" type="submit">Register Agent</button>
        </form>
      )}

      {loadingAgents ? (
        <div className="owner-state">Loading agents...</div>
      ) : (
        <div className="saas-table-container glass-panel">
          <table className="saas-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Vehicle Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr><td colSpan="4" className="empty-cell">No agents registered.</td></tr>
              ) : (
                agents.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.phone}</td>
                    <td><span className="pill-category">{a.vehicle_type || "-"}</span></td>
                    <td>
                      <span className={`status-pill ${a.is_online ? 'online' : 'offline'}`}>
                        {a.is_online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <main className="owner-dashboard-page page-enter">
      <div className="owner-dashboard-layout">
        <aside className="owner-sidebar glass-panel">
          <div className="owner-sidebar-brand">
            <img src="/imagesd/AeroDrop_perfect_Logo.png" alt="AeroDrop" />
            <p className="ui-tag" style={{ marginLeft: "12px", marginTop: "-4px" }}>Admin</p>
          </div>

          <nav className="owner-sidebar-nav">
            <button 
              className={`sidebar-nav-item ${activeTab === 'Orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('Orders')}
            >
              Orders
            </button>
            <button 
              className={`sidebar-nav-item ${activeTab === 'Products' ? 'active' : ''}`}
              onClick={() => setActiveTab('Products')}
            >
              Products
            </button>
            <button 
              className={`sidebar-nav-item ${activeTab === 'Agents' ? 'active' : ''}`}
              onClick={() => setActiveTab('Agents')}
            >
              Agents
            </button>
          </nav>

          <div className="owner-sidebar-footer">
            <div className="owner-profile-preview">
              <span className="avatar">{owner?.name?.charAt(0) || 'O'}</span>
              <div className="info">
                <strong>{owner?.name || owner?.email || "Owner"}</strong>
                <span>Administrator</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" style={{ width: '100%', justifyContent: 'center' }}>
                <div className="toggle-track">
                  <div className="toggle-thumb" />
                </div>
                <span className="theme-toggle-label">{theme === "dark" ? "🌙 Dark" : "☀️ Light"}</span>
              </button>
              <button className="ui-btn ghost danger-text" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </aside>

        <section className="owner-main-content">
          {activeTab === 'Orders' && renderOrdersTab()}
          {activeTab === 'Products' && renderProductsTab()}
          {activeTab === 'Agents' && renderAgentsTab()}
        </section>
      </div>

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
