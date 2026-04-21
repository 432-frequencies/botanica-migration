const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_METERS = 9000;
const MAX_RADIUS_METERS = 18000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const runtimeCache = globalThis.__W1LD_NEARBY_SPOTS_CACHE__ || new Map();
globalThis.__W1LD_NEARBY_SPOTS_CACHE__ = runtimeCache;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isValidCoords(lat, lng) {
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function getDistanceMeters(from, to) {
  const lat1 = toNumber(from?.lat);
  const lng1 = toNumber(from?.lng);
  const lat2 = toNumber(to?.lat);
  const lng2 = toNumber(to?.lng);
  if (!isValidCoords(lat1, lng1) || !isValidCoords(lat2, lng2)) return null;

  const earthRadius = 6371000;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashSeed(value) {
  const input = String(value || "w1ld");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function getSpotKind(tags = {}) {
  if (tags.leisure === "garden") return "garden";
  if (tags.leisure === "park") return "park";
  if (tags.leisure === "nature_reserve" || tags.boundary === "protected_area") return "reserve";
  if (tags.landuse === "forest" || tags.natural === "wood") return "forest";
  if (tags.leisure === "recreation_ground") return "green";
  if (["grassland", "scrub", "heath"].includes(tags.natural)) return "wild";
  return "green";
}

function getKindMeta(kind) {
  switch (kind) {
    case "garden":
      return {
        fallbackName: "Jardin proche",
        habitatLabel: "jardin à explorer",
        opportunity: "Bon terrain pour observer fleurs, arbres d’ornement et insectes pollinisateurs.",
      };
    case "park":
      return {
        fallbackName: "Parc proche",
        habitatLabel: "parc vivant",
        opportunity: "Endroit idéal pour repérer arbres, oiseaux et espèces communes du quotidien.",
      };
    case "reserve":
      return {
        fallbackName: "Réserve naturelle proche",
        habitatLabel: "milieu protégé",
        opportunity: "Très bon secteur pour documenter une biodiversité plus riche et discrète.",
      };
    case "forest":
      return {
        fallbackName: "Bois ou forêt proche",
        habitatLabel: "bois / forêt",
        opportunity: "Canopée, lisières, lichens et insectes : un terrain fort pour observer le vivant.",
      };
    case "wild":
      return {
        fallbackName: "Milieu naturel proche",
        habitatLabel: "milieu ouvert",
        opportunity: "Un repère intéressant pour chercher traces, plantes spontanées et insectes.",
      };
    default:
      return {
        fallbackName: "Espace vert proche",
        habitatLabel: "lieu vivant",
        opportunity: "Repère simple pour commencer une observation nette autour de toi.",
      };
  }
}

function getElementCoords(element) {
  const lat = toNumber(element?.lat ?? element?.center?.lat);
  const lng = toNumber(element?.lon ?? element?.center?.lon);
  return isValidCoords(lat, lng) ? { lat, lng } : null;
}

function buildOverpassQuery(lat, lng, radiusMeters) {
  const radius = Math.max(300, Math.min(MAX_RADIUS_METERS, Math.round(radiusMeters)));
  return `
    [out:json][timeout:9];
    (
      nwr["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"](around:${radius},${lat},${lng});
      nwr["landuse"~"^(forest|recreation_ground|meadow|grass)$"](around:${radius},${lat},${lng});
      nwr["natural"~"^(wood|grassland|scrub|heath)$"](around:${radius},${lat},${lng});
      nwr["boundary"="protected_area"](around:${radius},${lat},${lng});
    );
    out center tags 80;
  `;
}

async function fetchOverpass(lat, lng, radiusMeters) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9500);

  try {
    const body = new URLSearchParams({ data: buildOverpassQuery(lat, lng, radiusMeters) });
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "W1LD/1.0 local biodiversity app",
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`OVERPASS_${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSpot(element, origin) {
  const tags = element?.tags || {};
  const coords = getElementCoords(element);
  if (!coords) return null;

  const kind = getSpotKind(tags);
  const meta = getKindMeta(kind);
  const rawName = normalizeName(tags["name:fr"] || tags.name || tags.official_name || tags.short_name);
  const distanceMeters = getDistanceMeters(origin, coords);
  const seed = hashSeed(`${rawName}:${element.id}:${kind}`);

  return {
    id: `${element.type}-${element.id}`,
    name: rawName || meta.fallbackName,
    distanceMeters,
    speciesCount: 16 + (seed % 29),
    habitatLabel: meta.habitatLabel,
    opportunity: meta.opportunity,
    kind,
    source: "osm",
    lat: coords.lat,
    lng: coords.lng,
    named: Boolean(rawName),
  };
}

function dedupeSpots(spots) {
  const seen = new Set();
  return spots.filter((spot) => {
    const key = `${spot.name.toLowerCase()}:${Math.round((spot.distanceMeters || 0) / 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackSpots(lat, lng) {
  const seed = hashSeed(`${Number(lat).toFixed(3)}:${Number(lng).toFixed(3)}`);
  return [
    {
      id: "fallback-green",
      name: "Espace vert proche",
      distanceMeters: 320 + (seed % 260),
      speciesCount: 18 + (seed % 18),
      habitatLabel: "parc ou jardin à vérifier",
      opportunity: "Ta position est prise en compte, mais les lieux proches sont en cours de synchronisation.",
      kind: "green",
      source: "fallback",
    },
    {
      id: "fallback-wood",
      name: "Bois ou jardin à explorer",
      distanceMeters: 760 + (seed % 520),
      speciesCount: 24 + (seed % 16),
      habitatLabel: "repère naturel proche",
      opportunity: "Cherche une lisière, un alignement d’arbres ou un square calme pour démarrer.",
      kind: "forest",
      source: "fallback",
    },
  ];
}

function readCache(cacheKey) {
  const cached = runtimeCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.ts > CACHE_TTL_MS) {
    runtimeCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function writeCache(cacheKey, value) {
  runtimeCache.set(cacheKey, { value, ts: Date.now() });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = new URL(req.url, "https://w1ld.app");
  const lat = toNumber(url.searchParams.get("lat"));
  const lng = toNumber(url.searchParams.get("lng"));
  const radiusMeters = toNumber(url.searchParams.get("radius")) || DEFAULT_RADIUS_METERS;

  if (!isValidCoords(lat, lng)) {
    return res.status(400).json({ error: "lat/lng required" });
  }

  const cacheKey = `${lat.toFixed(3)}:${lng.toFixed(3)}:${Math.round(radiusMeters / 1000)}`;
  const cached = readCache(cacheKey);
  if (cached) return res.status(200).json(cached);

  try {
    const origin = { lat, lng };
    const firstPass = await fetchOverpass(lat, lng, radiusMeters);
    let spots = dedupeSpots(
      (firstPass.elements || [])
        .map((element) => normalizeSpot(element, origin))
        .filter(Boolean)
        .filter((spot) => Number.isFinite(spot.distanceMeters))
        .sort((a, b) => a.distanceMeters - b.distanceMeters || Number(b.named) - Number(a.named)),
    );

    if (spots.length < 2 && radiusMeters < MAX_RADIUS_METERS) {
      const secondPass = await fetchOverpass(lat, lng, MAX_RADIUS_METERS);
      spots = dedupeSpots(
        (secondPass.elements || [])
          .map((element) => normalizeSpot(element, origin))
          .filter(Boolean)
          .filter((spot) => Number.isFinite(spot.distanceMeters))
          .sort((a, b) => a.distanceMeters - b.distanceMeters || Number(b.named) - Number(a.named)),
      );
    }

    const payload = {
      source: spots.length ? "osm" : "fallback",
      radiusMeters: spots.length ? Math.max(radiusMeters, spots[0]?.distanceMeters || radiusMeters) : radiusMeters,
      spots: (spots.length ? spots : fallbackSpots(lat, lng)).slice(0, 6),
    };

    writeCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.warn("[nearby-spots] fallback:", error?.message || error);
    const payload = {
      source: "fallback",
      radiusMeters,
      spots: fallbackSpots(lat, lng),
    };
    writeCache(cacheKey, payload);
    return res.status(200).json(payload);
  }
}
