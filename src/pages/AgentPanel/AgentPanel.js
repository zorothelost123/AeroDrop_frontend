import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_URL, DELIVERY_BASE, STORAGE_KEYS } from "../../utils/api";
import { getMapTileLayer } from "../../utils/mapTiles";
import { calculateDistanceKm, parseCoords } from "../../utils/geo";
import { useTheme } from "../../utils/theme";
import "./AgentPanel.css";

const storeIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/862/862856.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const userIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1946/1946488.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const agentIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2954/2954884.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const HYDERABAD_FALLBACK = [17.385, 78.4867];

const normalizeAgent = (agentData) => {
  if (!agentData) return null;
  const normalizedId = agentData.agent_id || agentData.id || "";
  return {
    ...agentData,
    id: normalizedId,
    agent_id: normalizedId,
    name: agentData.name || agentData.agent_name || "",
  };
};

const readAgent = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.agent) || "null");
    return normalizeAgent(saved);
  } catch (error) {
    return null;
  }
};

const getAuthHeaders = () => {
  const token = localStorage.getItem(STORAGE_KEYS.agentToken);
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
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

export default function AgentPanel() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const tileLayer = useMemo(() => getMapTileLayer(theme), [theme]);

  const [agent, setAgent] = useState(() => readAgent());
  const [isOnline, setIsOnline] = useState(false);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [socket, setSocket] = useState(null);
  const [workingZone, setWorkingZone] = useState(null);
  const [isZoneSet, setIsZoneSet] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  const handleStatusToggle = async () => {
    const nextStatus = !isOnline;
    setIsOnline(nextStatus);
    try {
      await fetch(`${DELIVERY_BASE}/agent/status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_online: nextStatus }),
      });
    } catch (err) {
      console.error("Error updating agent status", err);
      setIsOnline(!nextStatus);
    }
  };

  const token = localStorage.getItem(STORAGE_KEYS.agentToken);

  useEffect(() => {
    if (!agent || !token) {
      navigate("/agent/login", { replace: true });
    }
  }, [agent, token, navigate]);

  const fetchActiveOrder = useCallback(async () => {
    if (!agent) return;

    try {
      const response = await fetch(`${DELIVERY_BASE}/active`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        setActiveOrder(data.orders[0]);
      }
    } catch (requestError) {
    }
  }, [agent]);

  const fetchUnassignedOrders = useCallback(
    async (zoneOverride = workingZone) => {
      if (!zoneOverride) {
        setUnassignedOrders([]);
        return;
      }

      try {
        const response = await fetch(`${DELIVERY_BASE}/unassigned`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        const orders = Array.isArray(data.orders) ? data.orders : [];
        const [zoneLat, zoneLng] = zoneOverride;

        const filtered = orders.filter((order) => {
          const storeCoords = parseCoords(order.store_coords);
          if (!storeCoords) return false;
          return calculateDistanceKm(zoneLat, zoneLng, storeCoords[0], storeCoords[1]) <= 5;
        });

        setUnassignedOrders(filtered);
      } catch (requestError) {
        setUnassignedOrders([]);
      }
    },
    [workingZone]
  );

  useEffect(() => {
    fetchActiveOrder();
  }, [fetchActiveOrder]);

  useEffect(() => {
    if (!agent) return;

    const nextSocket = io(BASE_URL);
    setSocket(nextSocket);

    nextSocket.emit("agent_connect", { agentId: agent.agent_id || agent.id });

    if (activeOrder) {
      const oid = activeOrder.order_id || activeOrder.id;
      nextSocket.emit("join_room", `order_${oid}`);
      nextSocket.emit("join_order_room", oid);
    }

    nextSocket.on("new_unassigned_order", (order) => {
      setUnassignedOrders((prev) => {
        if (!isOnline) return prev;

        const exists = prev.find(
          (item) => (item.order_id || item.id) === (order.order_id || order.id)
        );
        if (exists) return prev;

        if (!isZoneSet || !workingZone) return prev;

        const storeCoords = parseCoords(order.store_coords);
        if (!storeCoords) return prev;

        const isWithinZone =
          calculateDistanceKm(workingZone[0], workingZone[1], storeCoords[0], storeCoords[1]) <= 5;
        if (!isWithinZone) return prev;

        return [order, ...prev];
      });
    });

    if (isZoneSet) {
      fetchUnassignedOrders();
    }

    return () => nextSocket.disconnect();
  }, [agent, activeOrder, isOnline, isZoneSet, workingZone, fetchUnassignedOrders]);

  const acceptOrder = async (order) => {
    if (!agent) return;

    try {
      const orderId = order.order_id || order.id;
      const response = await fetch(`${DELIVERY_BASE}/accept/${orderId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          agent_id: agent.agent_id || agent.id,
          agent_name: agent.name,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (data.success) {
        if (socket) {
          socket.emit("join_room", `order_${orderId}`);
          socket.emit("join_order_room", orderId);
        }
        setActiveOrder(data.order);
        setUnassignedOrders((prev) =>
          prev.filter((item) => (item.order_id || item.id) !== orderId)
        );
      } else {
        window.alert(data.message || "Could not accept order.");
      }
    } catch (requestError) {
      window.alert("Could not accept order.");
    }
  };

  const updateOrderStatus = async (orderId, status, otp = null) => {
    try {
      const response = await fetch(`${DELIVERY_BASE}/status/${orderId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, otp }),
      });

      const data = await response.json().catch(() => ({}));
      if (data.success) {
        setActiveOrder(data.order);
      }
    } catch (requestError) {
    }
  };

  useEffect(() => {
    const fetchRoute = async () => {
      if (!activeOrder) {
        setRouteCoords([]);
        return;
      }

      const orderStatus = activeOrder.status;
      const storeLocation = parseCoords(activeOrder.store_coords) || parseCoords(activeOrder.delivery_agent_coords);
      const customerLocation = parseCoords(activeOrder.customer_coords);

      if (["PENDING", "UNASSIGNED", "DELIVERED"].includes(orderStatus)) {
        setRouteCoords([]);
        return;
      }

      let startLocation = null;
      let endLocation = null;

      if (["PREPARING", "ASSIGNED", "AGENT_REACHING_STORE"].includes(orderStatus)) {
        startLocation = liveLocation || workingZone;
        endLocation = storeLocation;
      } else if (["PICKED_UP", "ON_THE_WAY", "REACHED"].includes(orderStatus)) {
        startLocation = liveLocation || storeLocation;
        endLocation = customerLocation;
      } else {
        setRouteCoords([]);
        return;
      }

      if (!startLocation || !endLocation) {
        setRouteCoords([]);
        return;
      }

      try {
        const [startLat, startLng] = startLocation;
        const [endLat, endLng] = endLocation;
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson`
        );
        const data = await response.json().catch(() => ({}));

        if (Array.isArray(data.routes) && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((coord) => [coord[1], coord[0]]);
          setRouteCoords(coords);
        } else {
          setRouteCoords([]);
        }
      } catch (requestError) {
        setRouteCoords([]);
      }
    };

    fetchRoute();
  }, [
    activeOrder?.id,
    activeOrder?.order_id,
    activeOrder?.status,
    activeOrder?.store_coords,
    activeOrder?.customer_coords,
    activeOrder?.delivery_agent_coords,
    liveLocation,
    workingZone,
  ]);

  const startSimulation = async () => {
    if (!activeOrder || !workingZone) return;

    const storeLocation = parseCoords(activeOrder.store_coords) || parseCoords(activeOrder.delivery_agent_coords);
    const customerLocation = parseCoords(activeOrder.customer_coords);

    if (!storeLocation || !customerLocation) return;

    try {
      const [zoneLat, zoneLng] = workingZone;
      const [storeLat, storeLng] = storeLocation;
      const [customerLat, customerLng] = customerLocation;
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${zoneLng},${zoneLat};${storeLng},${storeLat};${customerLng},${customerLat}?geometries=geojson`
      );
      const data = await response.json().catch(() => ({}));

      if (Array.isArray(data.routes) && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((coord) => [coord[1], coord[0]]);
        setRouteCoords(coords);
        setLiveLocation(coords[0] || workingZone);
      } else {
        setRouteCoords([workingZone, storeLocation, customerLocation]);
        setLiveLocation(workingZone);
      }
    } catch (requestError) {
      setRouteCoords([workingZone, storeLocation, customerLocation]);
      setLiveLocation(workingZone);
    }

    setSimIndex(0);
    setIsSimulating(true);
  };

  useEffect(() => {
    let intervalId;

    if (isSimulating && routeCoords.length > 0 && activeOrder) {
      intervalId = setInterval(() => {
        setSimIndex((prev) => {
          const nextIndex = prev + 1;
          if (nextIndex >= routeCoords.length) {
            setIsSimulating(false);
            clearInterval(intervalId);
            return prev;
          }

          const nextCoord = routeCoords[nextIndex];
          setLiveLocation(nextCoord);

          if (socket) {
            socket.emit("location_update", {
              orderId: activeOrder.order_id || activeOrder.id,
              coords: nextCoord,
            });
          }

          return nextIndex;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSimulating, routeCoords, activeOrder, socket]);

  useEffect(() => {
    let watchId;

    if (activeOrder && activeOrder.status === "ON_THE_WAY" && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coords = [position.coords.latitude, position.coords.longitude];
          setLiveLocation(coords);
          if (socket) {
            socket.emit("location_update", {
              orderId: activeOrder.order_id || activeOrder.id,
              coords,
            });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeOrder?.status, activeOrder?.id, activeOrder?.order_id, socket]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.agent);
    localStorage.removeItem(STORAGE_KEYS.agentToken);
    setAgent(null);
    setActiveOrder(null);
    navigate("/agent/login", { replace: true });
  };

  if (!agent) {
    return null;
  }

  if (activeOrder) {
    const orderId = activeOrder.order_id || activeOrder.id;
    const status = activeOrder.status;

    const storeLocation =
      parseCoords(activeOrder.store_coords) ||
      parseCoords(activeOrder.delivery_agent_coords) ||
      HYDERABAD_FALLBACK;
    const customerLocation = parseCoords(activeOrder.customer_coords) || HYDERABAD_FALLBACK;
    const isStageOne = ["PREPARING", "ASSIGNED", "AGENT_REACHING_STORE"].includes(status);
    const currentPoint = isStageOne
      ? liveLocation || workingZone || storeLocation || HYDERABAD_FALLBACK
      : liveLocation || storeLocation || workingZone || HYDERABAD_FALLBACK;

    const canSimulate =
      Boolean(workingZone) &&
      Boolean(parseCoords(activeOrder.store_coords) || parseCoords(activeOrder.delivery_agent_coords)) &&
      Boolean(parseCoords(activeOrder.customer_coords));

    return (
      <main className="agent-page page-enter">
        <section className="ui-shell agent-shell glass-panel">
          <header className="agent-header">
            <div>
              <p className="ui-tag">AeroDrop Agent Panel</p>
              <h1>Order #{orderId}</h1>
              <p>
                {agent.name} (ID: {agent.agent_id || agent.id})
              </p>
            </div>
            <div className="agent-actions-row">
              <span className="agent-status-chip">{String(status || "-").replace(/_/g, " ")}</span>
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" style={{ padding: '6px 12px' }}>
                <div className="toggle-track"><div className="toggle-thumb" /></div>
              </button>
              <button className="ui-btn secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </header>

          <section className="agent-active-card">
            <p><strong>Store:</strong> {activeOrder.store_name || "AeroDrop Hub"}</p>
            <p><strong>Deliver to:</strong> {activeOrder.address_id || "Customer Address"}</p>

            {(status === "PREPARING" || status === "ASSIGNED") && (
              <button className="ui-btn" onClick={() => updateOrderStatus(orderId, "AGENT_REACHING_STORE")}>
                Arrived at Store
              </button>
            )}

            {status === "AGENT_REACHING_STORE" && (
              <button className="ui-btn" onClick={() => updateOrderStatus(orderId, "PICKED_UP")}>
                Confirm Pickup
              </button>
            )}

            {status === "PICKED_UP" && (
              <div className="agent-pickup-block">
                <div className="agent-items-box">
                  <h4>Items to Deliver</h4>
                  <ul>
                    {parseItems(activeOrder.items)
                      .filter((item) => !item?._isSecretLocation)
                      .map((item, index) => (
                        <li key={`item-${index}`}>
                          {item.quantity || 1}x {item.name || "Item"}
                        </li>
                      ))}
                  </ul>
                </div>
                <button className="ui-btn" onClick={() => updateOrderStatus(orderId, "ON_THE_WAY")}>
                  Start Navigation
                </button>
              </div>
            )}

            {["PREPARING", "ASSIGNED", "AGENT_REACHING_STORE", "PICKED_UP", "ON_THE_WAY"].includes(status) && (
              <div className="agent-map-wrap">
                <MapContainer center={currentPoint} zoom={13} style={{ height: "290px", width: "100%" }}>
                  <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />
                  {liveLocation && (
                    <Marker position={liveLocation} icon={agentIcon}>
                      <Popup>You (Agent)</Popup>
                    </Marker>
                  )}
                  {workingZone && (
                    <Marker position={workingZone} icon={agentIcon}>
                      <Popup>Working Zone</Popup>
                    </Marker>
                  )}
                  <Marker position={storeLocation} icon={storeIcon}>
                    <Popup>Store</Popup>
                  </Marker>
                  <Marker position={customerLocation} icon={userIcon}>
                    <Popup>Customer Destination</Popup>
                  </Marker>
                  {routeCoords.length > 0 && (
                    <Polyline
                      positions={routeCoords}
                      color={isStageOne ? "orange" : "#1be8ff"}
                      weight={5}
                      opacity={0.7}
                    />
                  )}
                </MapContainer>

                <div className="agent-distance-box">
                  <p>
                    Distance to {isStageOne ? "Store" : "Customer"}: 
                    <strong>
                      {calculateDistanceKm(
                        (isStageOne ? storeLocation : customerLocation)[0],
                        (isStageOne ? storeLocation : customerLocation)[1],
                        currentPoint[0],
                        currentPoint[1]
                      ).toFixed(1)} km
                    </strong>
                  </p>

                  {status === "ON_THE_WAY" && (
                    <button
                      className="ui-btn ghost"
                      onClick={startSimulation}
                      disabled={isSimulating || !canSimulate}
                    >
                      {isSimulating ? "Simulating Live Tracking..." : "Start Live Simulation"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {status === "ON_THE_WAY" && (
              <button className="ui-btn" onClick={() => updateOrderStatus(orderId, "REACHED")}>
                Reached Customer Location
              </button>
            )}

            {status === "REACHED" && (
              <div className="agent-otp-box">
                <h4>Verify Delivery</h4>
                <p>Ask customer for the 4-digit OTP.</p>
                <input
                  className="ui-input"
                  type="text"
                  value={enteredOtp}
                  onChange={(event) => setEnteredOtp(event.target.value)}
                  maxLength={4}
                  placeholder="Enter OTP"
                />
                {otpError && <p className="agent-error">{otpError}</p>}
                <button
                  className="ui-btn"
                  onClick={() => {
                    const expectedOtp = String((activeOrder.order_id || activeOrder.id) * 73 + 1000).substring(0, 4);
                    if (enteredOtp === expectedOtp) {
                      setOtpError("");
                      updateOrderStatus(orderId, "DELIVERED", enteredOtp);
                    } else {
                      setOtpError("Invalid OTP.");
                    }
                  }}
                >
                  Verify and Complete Delivery
                </button>
              </div>
            )}

            {status === "DELIVERED" && (
              <div className="agent-success-box">
                <h3>Delivery Completed</h3>
                <button className="ui-btn" onClick={() => setActiveOrder(null)}>
                  Return to Jobs
                </button>
              </div>
            )}
          </section>
        </section>
      </main>
    );
  }

  if (!isZoneSet) {
    const zoneCenter = workingZone || HYDERABAD_FALLBACK;

    return (
      <main className="agent-page page-enter">
        <section className="ui-shell agent-shell glass-panel">
          <header className="agent-header">
            <div>
              <p className="ui-tag">AeroDrop Agent Panel</p>
              <h1>{agent.name || "Agent"}</h1>
              <p>ID: {agent.agent_id || agent.id} | Zone: Not Set</p>
            </div>
            <div className="agent-actions-row">
              <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" style={{ padding: '6px 12px' }}>
                <div className="toggle-track"><div className="toggle-thumb" /></div>
              </button>
              <button className="ui-btn secondary" onClick={handleLogout}>Logout</button>
            </div>
          </header>

          <section className="agent-zone-card">
            <h3>Set Working Zone</h3>
            <p>Drag marker to confirm your 5km working zone center.</p>

            <div className="agent-zone-map">
              <MapContainer center={zoneCenter} zoom={13} style={{ height: "320px", width: "100%" }}>
                <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />
                <Marker
                  position={zoneCenter}
                  icon={agentIcon}
                  draggable={true}
                  eventHandlers={{
                    dragend: (event) => {
                      const { lat, lng } = event.target.getLatLng();
                      setWorkingZone([lat, lng]);
                    },
                  }}
                >
                  <Popup>Set your working zone</Popup>
                </Marker>
              </MapContainer>
            </div>

            <button
              className="ui-btn"
              onClick={async () => {
                const zone = workingZone || HYDERABAD_FALLBACK;
                setWorkingZone(zone);
                setIsZoneSet(true);
                await fetchUnassignedOrders(zone);
              }}
            >
              Confirm Work Zone
            </button>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="agent-page page-enter">
      <section className="ui-shell agent-shell glass-panel">
        <header className="agent-header">
          <div>
            <p className="ui-tag">AeroDrop Agent Panel</p>
            <h1>{agent.name || "Agent"}</h1>
            <p>ID: {agent.agent_id || agent.id} | Zone: Set</p>
          </div>

          <div className="agent-actions-row">
            <label className="agent-toggle">
              <input type="checkbox" checked={isOnline} onChange={handleStatusToggle} />
              <span>{isOnline ? "Online" : "Offline"}</span>
            </label>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" style={{ padding: '6px 12px' }}>
              <div className="toggle-track"><div className="toggle-thumb" /></div>
            </button>
            <button className="ui-btn secondary" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <section className="agent-jobs-head">
          <h2>Available Jobs</h2>
          <button className="ui-btn ghost" onClick={fetchUnassignedOrders}>Refresh</button>
        </section>

        {!isOnline ? (
          <div className="agent-empty">Go online to start receiving orders.</div>
        ) : unassignedOrders.length === 0 ? (
          <div className="agent-empty">Searching for nearby orders...</div>
        ) : (
          <section className="agent-job-list">
            {unassignedOrders.map((order) => (
              <article key={order.order_id || order.id} className="agent-job-card glass-panel">
                <div>
                  <h3>Order #{order.order_id || order.id}</h3>
                  <p>{order.store_name || "AeroDrop Hub"}</p>
                  <small>
                    {parseItems(order.items).length} items
                  </small>
                </div>
                <button className="ui-btn" onClick={() => acceptOrder(order)}>Accept</button>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
