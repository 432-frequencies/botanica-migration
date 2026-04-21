function seededBetween(seed, min, max) {
  const x = Math.sin(seed) * 10000;
  const ratio = x - Math.floor(x);
  return Math.round(min + ratio * (max - min));
}

export async function getNearbyActivity({ coords } = {}) {
  const lat = Number(coords?.lat) || 48.8566;
  const lng = Number(coords?.lng) || 2.3522;
  const activeExplorers = seededBetween((lat * 1000) + (lng * 700), 3, 25);

  return {
    activeExplorers,
    radiusMeters: 2000,
  };
}
