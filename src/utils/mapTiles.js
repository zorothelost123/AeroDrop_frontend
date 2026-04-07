const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const getMapTileLayer = (theme) => {
  if (theme === "dark") {
    return {
      // Keep a single readable base map and let CSS handle the dark-mode transformation.
      attribution: ATTRIBUTION,
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    };
  }

  return {
    attribution: ATTRIBUTION,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };
};
