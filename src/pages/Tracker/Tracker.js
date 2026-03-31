import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BASE_URL, DELIVERY_BASE } from "../../utils/api";
import { getMapTileLayer } from "../../utils/mapTiles";
import { generateStoreWithin700m, parseCoords } from "../../utils/geo";
import { useTheme } from "../../utils/theme";
import "./Tracker.css";

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

const STEP_ORDER = [
  "PENDING",
  "UNASSIGNED",
  "PREPARING",
  "AGENT_REACHING_STORE",
  "ON_THE_WAY",
  "REACHED",
  "DELIVERED",
];

const STATUS_CLASS_NAME = {
  PENDING: "pending",
  UNASSIGNED: "pending",
  PREPARING: "preparing",
  AGENT_REACHING_STORE: "moving",
  ON_THE_WAY: "moving",
  REACHED: "moving",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export default function Tracker() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { theme } = useTheme();
  const tileLayer = useMemo(() => getMapTileLayer(theme), [theme]);

  const [status, setStatus] = useState("Loading...");
  const [eta, setEta] = useState("--");
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [storeLocation, setStoreLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [deliveryAgentName, setDeliveryAgentName] = useState("--");
  const [deliveryAgentId, setDeliveryAgentId] = useState("--");
  const [timeLeft, setTimeLeft] = useState(30);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (timeLeft > 0 && status === "PENDING") {
      const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [status, timeLeft]);

  useEffect(() => {
    const socket = io(BASE_URL);

    if (orderId) {
      socket.emit("join_room", `order_${orderId}`);
      socket.emit("join_order_room", orderId);
    }

    socket.on("location_updated", (coords) => {
      if (Array.isArray(coords)) {
        setDeliveryCoords(coords);
      } else if (coords && coords.lat && coords.lng) {
        setDeliveryCoords([coords.lat, coords.lng]);
      }
    });

    socket.on("order_status_updated", (data) => {
      if (data.status) setStatus(data.status);
      if (data.eta !== undefined) setEta(data.eta);
      if (data.delivery_person_name || data.delivery_agent_name) {
        setDeliveryAgentName(data.delivery_person_name || data.delivery_agent_name);
      }
      if (data.delivery_person_id || data.delivery_agent_id) {
        setDeliveryAgentId(data.delivery_person_id || data.delivery_agent_id);
      }
    });

    return () => socket.disconnect();
  }, [orderId]);

  useEffect(() => {
    const fetchOrderStatus = async () => {
      if (!orderId) return;

      try {
        const response = await fetch(`${DELIVERY_BASE}/track/${orderId}`, {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!data.success || !data.order) return;

        const order = data.order;
        setStatus(order.status || "UNASSIGNED");
        if (order.eta_minutes !== undefined) {
          setEta(order.actual_time_taken || order.eta_minutes);
        }

        if (order.delivery_person_name || order.delivery_agent_name) {
          setDeliveryAgentName(order.delivery_person_name || order.delivery_agent_name);
        }
        if (order.delivery_person_id || order.delivery_agent_id) {
          setDeliveryAgentId(order.delivery_person_id || order.delivery_agent_id);
        }

        const customer = parseCoords(order.customer_coords);
        if (customer) {
          setUserLocation(customer);
        } else {
          setUserLocation(null);
        }

        const rawStore = parseCoords(order.store_coords) || parseCoords(order.delivery_agent_coords);
        if (rawStore) {
          setStoreLocation(rawStore);
        } else if (customer) {
          setStoreLocation(generateStoreWithin700m(customer[0], customer[1], orderId));
        } else {
          setStoreLocation([16.3067, 80.4365]);
        }

        if (order.delivery_agent_coords) {
          const agentCoord = parseCoords(order.delivery_agent_coords);
          if (agentCoord) setDeliveryCoords(agentCoord);
        }

        const orderTime = new Date(order.created_at).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - orderTime) / 1000);
        setTimeLeft(Math.max(0, 30 - elapsedSeconds));
      } catch (requestError) {
      }
    };

    fetchOrderStatus();
  }, [orderId]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (["PENDING", "UNASSIGNED", "DELIVERED", "CANCELLED"].includes(status)) {
        setRoutePath([]);
        return;
      }

      let startLocation = null;
      let endLocation = null;

      if (["PREPARING", "AGENT_REACHING_STORE", "ASSIGNED"].includes(status)) {
        if (!deliveryCoords || !storeLocation) {
          setRoutePath([]);
          return;
        }

        startLocation = deliveryCoords;
        endLocation = storeLocation;
      } else if (["ON_THE_WAY", "REACHED", "PICKED_UP"].includes(status)) {
        const stageTwoStart = deliveryCoords || storeLocation;
        if (!stageTwoStart || !userLocation) {
          setRoutePath([]);
          return;
        }

        startLocation = stageTwoStart;
        endLocation = userLocation;
      } else {
        setRoutePath([]);
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
          setRoutePath(coords);
        } else {
          setRoutePath([]);
        }
      } catch (requestError) {
        setRoutePath([]);
      }
    };

    fetchRoute();
  }, [deliveryCoords, storeLocation, userLocation, status]);

  const handleCancelOrder = async () => {
    const confirmed = window.confirm(
      "Cancel this order? Refund will be processed in 5-7 working days."
    );
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const response = await fetch(`${DELIVERY_BASE}/cancel/${orderId}`, {
        method: "PUT",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (data.success) {
        setStatus("CANCELLED");
      } else {
        window.alert(data.message || "Failed to cancel order.");
      }
    } catch (requestError) {
      window.alert("Error cancelling order.");
    } finally {
      setIsCancelling(false);
    }
  };

  const currentRank = useMemo(() => {
    const rank = STEP_ORDER.indexOf(status);
    return rank === -1 ? 1 : rank + 1;
  }, [status]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <main className="tracker-page page-enter">
      <section className="ui-shell tracker-shell glass-panel">
        <header className="tracker-header">
          <div>
            <p className="ui-tag">AeroDrop Live Tracker</p>
            <h1>Order #{orderId || "--"}</h1>
          </div>
          <button className="ui-btn ghost" onClick={() => navigate("/store")}>Back to Store</button>
        </header>

        {status === "Loading..." && <div className="tracker-state">Fetching order details...</div>}

        {status === "CANCELLED" && (
          <section className="tracker-state cancelled">
            <h2>Order Cancelled</h2>
            <p>Refund will be credited to your original payment method in 5-7 working days.</p>
            <button className="ui-btn" onClick={() => navigate("/store")}>Continue Shopping</button>
          </section>
        )}

        {status !== "Loading..." && status !== "CANCELLED" && (
          <section className="tracker-card">
            <div className="tracker-status-head">
              <p>Live status</p>
              <span className={`tracker-pill ${STATUS_CLASS_NAME[status] || "pending"}`}>
                {status === "UNASSIGNED" ? "Accepted the Order" : status.replace(/_/g, " ")}
              </span>
            </div>

            {status === "PENDING" && timeLeft > 0 && (
              <div className="tracker-cancel-bar">
                <div>
                  <h3>Waiting for Confirmation</h3>
                  <p>Cancel with full refund in: {formatTime(timeLeft)}</p>
                </div>
                <button className="ui-btn secondary" onClick={handleCancelOrder} disabled={isCancelling}>
                  {isCancelling ? "Cancelling..." : "Cancel Order"}
                </button>
              </div>
            )}

            {(status === "UNASSIGNED" || (status === "PENDING" && timeLeft <= 0)) && (
              <div className="tracker-searching">
                <h3>Looking for a nearby delivery partner...</h3>
              </div>
            )}

            {!(status === "UNASSIGNED" || (status === "PENDING" && timeLeft <= 0)) && (
              <div className="tracker-stepper">
                {["PREPARING", "AGENT_REACHING_STORE", "ON_THE_WAY", "DELIVERED"].map((step) => {
                  const stepRank =
                    ["PREPARING", "AGENT_REACHING_STORE", "ON_THE_WAY", "DELIVERED"].indexOf(step) + 1;

                  let mappedCurrentRank = currentRank;
                  if (status === "REACHED") mappedCurrentRank = 3;
                  if (status === "PENDING" || status === "UNASSIGNED") mappedCurrentRank = 0;

                  const done = status === "DELIVERED" ? true : stepRank < mappedCurrentRank;
                  const active = status !== "DELIVERED" && stepRank === mappedCurrentRank;

                  return (
                    <div
                      key={step}
                      className={`tracker-step ${done ? "done" : ""} ${active ? "active" : ""}`.trim()}
                    >
                      <span className="dot" />
                      <span>{step.replace(/_/g, " ")}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="tracker-map-card glass-panel">
              <div className="tracker-map-wrap">
                <MapContainer
                  center={deliveryCoords || storeLocation || userLocation || [17.385, 78.4867]}
                  zoom={14}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution={tileLayer.attribution}
                    url={tileLayer.url}
                  />

                  {storeLocation && (
                    <Marker position={storeLocation} icon={storeIcon}>
                      <Popup>Store</Popup>
                    </Marker>
                  )}

                  {userLocation && (
                    <Marker position={userLocation} icon={userIcon}>
                      <Popup>Customer</Popup>
                    </Marker>
                  )}

                  {deliveryCoords && !["PENDING", "UNASSIGNED", "DELIVERED"].includes(status) && (
                    <Marker position={deliveryCoords} icon={agentIcon}>
                      <Popup>Delivery Partner</Popup>
                    </Marker>
                  )}

                  {routePath.length > 0 && !["PENDING", "UNASSIGNED"].includes(status) && (
                    <Polyline
                      positions={routePath}
                      color={
                        ["PREPARING", "AGENT_REACHING_STORE", "ASSIGNED"].includes(status)
                          ? "orange"
                          : "#1be8ff"
                      }
                      weight={5}
                    />
                  )}
                </MapContainer>
              </div>

              <p className="tracker-meta">
                Delivery Partner ID: {deliveryAgentId || "-"}, Name: {deliveryAgentName || "-"}
              </p>
              <p className="tracker-meta">
                {status === "DELIVERED"
                  ? "Delivered successfully."
                  : `Arriving in approximately ${eta === "--" ? "--" : eta} mins.`}
              </p>

              {status === "REACHED" && (
                <div className="tracker-otp">
                  <p>Agent has reached your location. Share this OTP:</p>
                  <strong>{String(orderId * 73 + 1000).substring(0, 4)}</strong>
                </div>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
