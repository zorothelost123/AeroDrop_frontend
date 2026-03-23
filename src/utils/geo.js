const EARTH_RADIUS_M = 6371000;

export const parseCoords = (coords) => {
  if (!coords) return null;

  if (Array.isArray(coords) && coords.length >= 2) {
    const lat = Number(coords[0]);
    const lng = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }

  if (typeof coords === "string") {
    const [lat, lng] = coords.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }

  if (typeof coords === "object") {
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  return null;
};

export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

export const generateStoreWithin700m = (centerLat, centerLng, seed = Date.now()) => {
  const base = Number(String(seed).replace(/\D/g, "").slice(-6) || "9973");
  const hash = ((base * 9301 + 49297) % 233280) / 233280;
  const angle = hash * 2 * Math.PI;
  const radiusMeters = 700 * Math.sqrt(Math.max(0.08, hash));

  const north = radiusMeters * Math.sin(angle);
  const east = radiusMeters * Math.cos(angle);

  const latOffset = (north / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngOffset =
    (east / (EARTH_RADIUS_M * Math.cos((centerLat * Math.PI) / 180))) *
    (180 / Math.PI);

  return [centerLat + latOffset, centerLng + lngOffset];
};
