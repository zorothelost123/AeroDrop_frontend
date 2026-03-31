import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  ADDRESS_BASE,
  DELIVERY_BASE,
  PAYMENT_BASE,
  RAZORPAY_KEY,
  STORAGE_KEYS,
} from "../../utils/api";
import { getMapTileLayer } from "../../utils/mapTiles";
import { generateStoreWithin700m } from "../../utils/geo";
import { useTheme } from "../../utils/theme";
import "./CheckoutModal.css";

const FALLBACK_PIN = [16.3067, 80.4365];

const EMPTY_ADDRESS_FORM = {
  id: null,
  full_name: "",
  phone_number: "",
  street_address: "",
  landmark: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  address_type: "HOME",
  is_default: false,
};

const deliveryIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
});

const storeHintIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/862/862856.png",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const MapCenterUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (center) {
        map.setView(center, 18);
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [center, map]);

  return null;
};

const normalizeAddressList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.addresses)) return data.addresses;
  return [];
};

const readClient = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.client) || "{}");
  } catch (error) {
    return {};
  }
};

export default function CheckoutModal({ cart, formatPrice, onClose, onOrderPlaced }) {
  const client = useMemo(() => readClient(), []);
  const { theme } = useTheme();
  const tileLayer = useMemo(() => getMapTileLayer(theme), [theme]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressFormData, setAddressFormData] = useState({ ...EMPTY_ADDRESS_FORM });
  const [isDetecting, setIsDetecting] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState(null);
  const [storeHintPin, setStoreHintPin] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [error, setError] = useState("");

  const grandTotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  useEffect(() => {
    const fetchAddresses = async () => {
      setLoadingAddresses(true);

      try {
        const response = await fetch(`${ADDRESS_BASE}/address`, {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        const list = normalizeAddressList(data);
        setAddresses(list);

        if (list.length > 0) {
          const preferred = list.find((item) => item?.is_default) || list[0];
          setSelectedAddressId(String(preferred.id));
        }
      } catch (requestError) {
        setAddresses([]);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
  }, []);

  useEffect(() => {
    let isActive = true;

    const geocodeAddress = async () => {
      if (!selectedAddressId) {
        if (isActive) {
          setDeliveryPin(null);
          setStoreHintPin(null);
        }
        return;
      }

      const selectedAddress = addresses.find(
        (item) => String(item.id) === String(selectedAddressId)
      );

      if (!selectedAddress) {
        if (isActive) {
          setDeliveryPin(FALLBACK_PIN);
          setStoreHintPin(generateStoreWithin700m(FALLBACK_PIN[0], FALLBACK_PIN[1], Date.now()));
        }
        return;
      }

      const composedAddress = [
        selectedAddress.street_address,
        selectedAddress.city,
        selectedAddress.state,
      ]
        .filter(Boolean)
        .join(", ");

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            composedAddress
          )}`
        );
        const data = await response.json().catch(() => []);
        const first = Array.isArray(data) ? data[0] : null;

        if (!first?.lat || !first?.lon) {
          throw new Error("No coordinates found");
        }

        if (isActive) {
          const pin = [Number(first.lat), Number(first.lon)];
          setDeliveryPin(pin);
          setStoreHintPin(generateStoreWithin700m(pin[0], pin[1], selectedAddress.id));
        }
      } catch (requestError) {
        if (isActive) {
          setDeliveryPin(FALLBACK_PIN);
          setStoreHintPin(generateStoreWithin700m(FALLBACK_PIN[0], FALLBACK_PIN[1], Date.now()));
        }
      }
    };

    geocodeAddress();

    return () => {
      isActive = false;
    };
  }, [addresses, selectedAddressId]);

  const refreshAddresses = async () => {
    const response = await fetch(`${ADDRESS_BASE}/address`, {
      credentials: "include",
    });
    const data = await response.json().catch(() => ({}));
    const list = normalizeAddressList(data);
    setAddresses(list);

    if (list.length > 0) {
      const preferred =
        list.find((item) => String(item.id) === String(addressFormData.id)) ||
        list.find((item) => item?.is_default) ||
        list[0];
      setSelectedAddressId(String(preferred.id));
    }
  };

  const handleAddressInput = (event) => {
    const { name, value, type, checked } = event.target;
    setAddressFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openAddAddress = () => {
    setAddressFormData({ ...EMPTY_ADDRESS_FORM });
    setShowAddressForm(true);
  };

  const openEditAddress = () => {
    if (!addresses.length) return;
    const selected =
      addresses.find((item) => String(item.id) === String(selectedAddressId)) || addresses[0];
    setAddressFormData({ ...selected });
    setShowAddressForm(true);
  };

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      window.alert("Geolocation is not supported in this browser.");
      return;
    }

    setIsDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json().catch(() => ({}));
          const address = data?.address || {};

          setAddressFormData((prev) => ({
            ...prev,
            street_address: `${address.road || ""} ${address.suburb || ""}`.trim(),
            city: address.city || address.town || address.village || "",
            state: address.state || "",
            postal_code: address.postcode || "",
            country: address.country || "India",
          }));
        } catch (requestError) {
          window.alert("Could not detect full address. Enter manually.");
        } finally {
          setIsDetecting(false);
        }
      },
      () => {
        setIsDetecting(false);
        window.alert("Location permission denied.");
      }
    );
  };

  const saveAddress = async (event) => {
    event.preventDefault();

    const payload = {
      ...addressFormData,
      country: addressFormData.country || "India",
    };

    try {
      const targetUrl = addressFormData.id
        ? `${ADDRESS_BASE}/address/${addressFormData.id}`
        : `${ADDRESS_BASE}/address/add`;

      const response = await fetch(targetUrl, {
        method: addressFormData.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save address.");
      }

      await refreshAddresses();
      setShowAddressForm(false);
    } catch (requestError) {
      window.alert("Failed to save address.");
    }
  };

  const placeDeliveryOrder = async (paymentMeta = null) => {
    const numericAddressId = Number(selectedAddressId);
    if (!Number.isInteger(numericAddressId) || numericAddressId <= 0) {
      throw new Error("Invalid address selected.");
    }

    if (!deliveryPin) {
      throw new Error("Delivery location is still loading.");
    }

    const payload = {
      address_id: numericAddressId,
      items: cart.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name,
      })),
      total_amount: grandTotal,
      user_gps: { lat: deliveryPin[0], lng: deliveryPin[1] },
      customer_coords: { lat: deliveryPin[0], lng: deliveryPin[1] },
      ...(paymentMeta || {}),
    };

    const response = await fetch(`${DELIVERY_BASE}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || "Unable to place order.");
    }

    onOrderPlaced(data?.order || data);
  };

  const handlePayAndPlaceOrder = async () => {
    setError("");
    if (!selectedAddressId) {
      setError("Select a delivery address to continue.");
      return;
    }

    if (!deliveryPin) {
      setError("Delivery pin is still loading. Please try again.");
      return;
    }

    if (!client?.user_id) {
      setError("Please log in again before placing an order.");
      return;
    }

    setIsProcessingPayment(true);
    setIsPlacingOrder(false);

    try {
      const createOrderResponse = await fetch(`${PAYMENT_BASE}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: Number(grandTotal.toFixed(2)),
          user_id: client?.user_id,
          source: "mars-mart",
          address_id: Number(selectedAddressId),
          items: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
          })),
        }),
      });

      const createOrderData = await createOrderResponse.json().catch(() => ({}));
      const razorpayOrder = createOrderData?.order;

      if (createOrderResponse.status === 404) {
        setIsPlacingOrder(true);
        try {
          await placeDeliveryOrder();
        } finally {
          setIsPlacingOrder(false);
          setIsProcessingPayment(false);
        }
        return;
      }

      if (!createOrderResponse.ok || !razorpayOrder?.id) {
        throw new Error(createOrderData?.message || "Payment order creation failed.");
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load payment gateway.");
      }

      const options = {
        key: RAZORPAY_KEY,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "AeroDrop",
        description: "AeroDrop order payment",
        order_id: razorpayOrder.id,
        prefill: {
          name: client?.name || "",
          email: client?.email || "",
          contact: client?.mobile || "",
        },
        theme: { color: "#ff6a2d" },
        modal: {
          ondismiss: () => setIsProcessingPayment(false),
        },
        handler: async (paymentResponse) => {
          try {
            setIsPlacingOrder(true);

            const verifyResponse = await fetch(`${PAYMENT_BASE}/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                user_id: client?.user_id,
                razorpay_order_id: paymentResponse?.razorpay_order_id,
                razorpay_payment_id: paymentResponse?.razorpay_payment_id,
                razorpay_signature: paymentResponse?.razorpay_signature,
                amount: Number(grandTotal.toFixed(2)),
                currency: "INR",
              }),
            });

            const verifyData = await verifyResponse.json().catch(() => ({}));
            if (!verifyResponse.ok || verifyData?.success === false) {
              throw new Error(verifyData?.message || "Payment verification failed.");
            }

            await placeDeliveryOrder({
              razorpay_order_id: paymentResponse?.razorpay_order_id,
              razorpay_payment_id: paymentResponse?.razorpay_payment_id,
            });
          } catch (paymentError) {
            setError(paymentError?.message || "Payment completed but order creation failed.");
          } finally {
            setIsProcessingPayment(false);
            setIsPlacingOrder(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (failedEvent) => {
        setError(
          failedEvent?.error?.description ||
            failedEvent?.error?.reason ||
            "Payment failed."
        );
        setIsProcessingPayment(false);
      });
      rzp.open();
    } catch (requestError) {
      setError(requestError?.message || "Unable to start payment.");
      setIsPlacingOrder(false);
      setIsProcessingPayment(false);
    }
  };

  const isBusy = isPlacingOrder || isProcessingPayment;

  return (
    <div className="checkout-overlay" onClick={onClose}>
      <section className="checkout-modal glass-panel" onClick={(event) => event.stopPropagation()}>
        <header className="checkout-header">
          <div>
            <p className="checkout-kicker">AeroDrop Checkout</p>
            <h2>Secure Checkout</h2>
          </div>
          <button
            type="button"
            className="checkout-close"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close checkout"
          >
            ×
          </button>
        </header>

        <div className="checkout-drawer-content">
          <section className="checkout-block">
            <div className="checkout-row-head">
              <h3>Delivery Address</h3>
              <div>
                <button className="ui-btn ghost" type="button" onClick={openAddAddress}>
                  Add
                </button>
                <button
                  className="ui-btn ghost"
                  type="button"
                  onClick={openEditAddress}
                  disabled={!addresses.length}
                >
                  Edit
                </button>
              </div>
            </div>

            {loadingAddresses ? (
              <p className="checkout-helper">Loading addresses...</p>
            ) : addresses.length === 0 ? (
              <p className="checkout-helper">No address found. Add one to continue.</p>
            ) : (
              <div className="checkout-address-list">
                {addresses.map((address) => {
                  const addressId = String(address.id);
                  const selected = selectedAddressId === addressId;
                  return (
                    <label
                      key={addressId}
                      className={`checkout-address ${selected ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        checked={selected}
                        onChange={() => setSelectedAddressId(addressId)}
                      />
                      <span>
                        <strong>{address.address_type || "Address"}</strong>
                        <small>
                          {[address.street_address, address.city, address.state]
                            .filter(Boolean)
                            .join(", ")}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {deliveryPin && (
            <section className="checkout-block map-block">
              <p>Drag the pin to your exact location</p>
              <div className="checkout-map-wrap">
                <MapContainer
                  center={deliveryPin}
                  zoom={18}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />
                  <Marker
                    position={deliveryPin}
                    draggable={true}
                    eventHandlers={{
                      dragend: (event) => {
                        const { lat, lng } = event.target.getLatLng();
                        setDeliveryPin([lat, lng]);
                        setStoreHintPin(generateStoreWithin700m(lat, lng, Date.now()));
                      },
                    }}
                    icon={deliveryIcon}
                  >
                    <Popup>Your delivery point</Popup>
                  </Marker>
                  {storeHintPin && (
                    <Marker position={storeHintPin} icon={storeHintIcon}>
                      <Popup>Dynamic store point generated within 700m radius</Popup>
                    </Marker>
                  )}
                  <Circle
                    center={deliveryPin}
                    radius={700}
                    pathOptions={{ color: "#1be8ff", dashArray: "6 6" }}
                  />
                  <MapCenterUpdater center={deliveryPin} />
                </MapContainer>
              </div>
            </section>
          )}

          <section className="checkout-block">
            <h3>Bill Summary</h3>
            <div className="checkout-summary-row">
              <span>Items Total</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
            <div className="checkout-summary-row">
              <span>Delivery Fee</span>
              <span>FREE</span>
            </div>
            <div className="checkout-summary-row total">
              <strong>To Pay</strong>
              <strong>{formatPrice(grandTotal)}</strong>
            </div>
          </section>

          {error && <p className="checkout-error">{error}</p>}

          <button
            className="ui-btn secondary checkout-pay"
            type="button"
            disabled={isBusy || !selectedAddressId || cart.length === 0}
            onClick={handlePayAndPlaceOrder}
          >
            {isPlacingOrder
              ? "Placing Order..."
              : isProcessingPayment
              ? "Opening Payment..."
              : "Pay and Place Order"}
          </button>
        </div>

        {showAddressForm && (
          <div className="checkout-form-overlay" onClick={() => setShowAddressForm(false)}>
            <section
              className="checkout-form-modal glass-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <h4>{addressFormData.id ? "Edit Address" : "Add Address"}</h4>
                <button className="ui-btn ghost" onClick={() => setShowAddressForm(false)}>
                  Close
                </button>
              </header>

              <button
                className="ui-btn ghost detect"
                onClick={detectCurrentLocation}
                type="button"
              >
                {isDetecting ? "Detecting..." : "Use my current location"}
              </button>

              <form className="checkout-form" onSubmit={saveAddress}>
                <label>
                  Full Name
                  <input
                    className="ui-input"
                    name="full_name"
                    value={addressFormData.full_name}
                    onChange={handleAddressInput}
                    required
                  />
                </label>

                <label>
                  Mobile Number
                  <input
                    className="ui-input"
                    name="phone_number"
                    value={addressFormData.phone_number}
                    onChange={handleAddressInput}
                    required
                  />
                </label>

                <label>
                  Street Address
                  <input
                    className="ui-input"
                    name="street_address"
                    value={addressFormData.street_address}
                    onChange={handleAddressInput}
                    required
                  />
                </label>

                <label>
                  Landmark
                  <input
                    className="ui-input"
                    name="landmark"
                    value={addressFormData.landmark || ""}
                    onChange={handleAddressInput}
                  />
                </label>

                <div className="checkout-form-row">
                  <label>
                    City
                    <input
                      className="ui-input"
                      name="city"
                      value={addressFormData.city}
                      onChange={handleAddressInput}
                      required
                    />
                  </label>

                  <label>
                    State
                    <input
                      className="ui-input"
                      name="state"
                      value={addressFormData.state}
                      onChange={handleAddressInput}
                      required
                    />
                  </label>
                </div>

                <label>
                  Pincode
                  <input
                    className="ui-input"
                    name="postal_code"
                    value={addressFormData.postal_code}
                    onChange={handleAddressInput}
                    required
                  />
                </label>

                <label className="checkout-default-toggle">
                  <input
                    type="checkbox"
                    name="is_default"
                    checked={Boolean(addressFormData.is_default)}
                    onChange={handleAddressInput}
                  />
                  Make this my default address
                </label>

                <button className="ui-btn" type="submit">
                  Save Address
                </button>
              </form>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
