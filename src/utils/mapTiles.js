const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const getMapTileLayer = (theme) => {
  if (theme === "dark") {
    return {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    };
  }

  return {
    attribution: ATTRIBUTION,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  };
};
