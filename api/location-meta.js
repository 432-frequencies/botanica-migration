const ZONE_DEG = 0.0045;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const runtimeCache = globalThis.__W1LD_LOCATION_META_CACHE__ || new Map();
globalThis.__W1LD_LOCATION_META_CACHE__ = runtimeCache;
const CITY_CODE_OVERRIDES = Object.freeze({
  paris: "PAR",
  bordeaux: "BDX",
  lyon: "LYN",
  marseille: "MRS",
  toulouse: "TLS",
  nantes: "NTE",
  lille: "LIL",
  nice: "NCE",
  montpellier: "MTP",
  strasbourg: "SBG",
  barcelona: "BCN",
  madrid: "MAD",
  sevilla: "SVQ",
  seville: "SVQ",
  valencia: "VLC",
  bilbao: "BIO",
  lisbonne: "LIS",
  lisbon: "LIS",
  londres: "LDN",
  london: "LDN",
});

function parseZoneId(zoneId) {
  if (!zoneId || typeof zoneId !== "string" || !zoneId.includes("_")) return null;
  const [zLat, zLng] = zoneId.split("_").map(Number);
  if (!Number.isFinite(zLat) || !Number.isFinite(zLng)) return null;
  return { zLat, zLng };
}

function getZoneCenter(zoneId) {
  const parsed = parseZoneId(zoneId);
  if (!parsed) return null;
  return {
    lat: (parsed.zLat + 0.5) * ZONE_DEG,
    lng: (parsed.zLng + 0.5) * ZONE_DEG,
  };
}

function getZoneOrdinal(zoneId) {
  const parsed = parseZoneId(zoneId);
  if (!parsed) return 1;
  return (Math.abs(parsed.zLat * 17 + parsed.zLng * 31) % 12) + 1;
}

function sanitizeLocality(value) {
  if (!value) return "";
  return String(value)
    .split(",")[0]
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeLocalityKey(value) {
  return sanitizeLocality(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildLocalityCode(locality, countryCode = "") {
  const safeLocality = sanitizeLocality(locality);
  const localityKey = normalizeLocalityKey(safeLocality);
  if (localityKey && CITY_CODE_OVERRIDES[localityKey]) {
    return CITY_CODE_OVERRIDES[localityKey];
  }

  const condensed = localityKey.replace(/[^a-z]/g, "");
  if (condensed.length >= 3) return condensed.slice(0, 3).toUpperCase();
  if (condensed.length > 0) return condensed.toUpperCase().padEnd(3, "X");

  const safeCountryCode = String(countryCode || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (safeCountryCode) return safeCountryCode.slice(0, 3).padEnd(3, "X");

  return "ZNE";
}

function pickLocality(address = {}) {
  return sanitizeLocality(
    address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.city_district ||
      address.suburb ||
      address.county ||
      address.state_district ||
      address.state ||
      address.country ||
      "",
  );
}

function buildZoneLabel(zoneId, address) {
  const locality = pickLocality(address);
  const code = buildLocalityCode(locality, address?.country_code || "");
  return zoneId ? `${code} ${getZoneOrdinal(zoneId)}` : "";
}

function readCache(cacheKey) {
  const cached = runtimeCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.ts >= CACHE_TTL_MS) {
    runtimeCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function writeCache(cacheKey, value) {
  runtimeCache.set(cacheKey, { value, ts: Date.now() });
}

async function reverseGeocode(lat, lng) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "12");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "fr");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "W1LD/1.0",
      "Accept-Language": "fr",
    },
  });

  if (!res.ok) throw new Error("REVERSE_GEOCODE_FAILED");

  const payload = await res.json();
  const address = payload.address || {};

  return {
    city: pickLocality(address),
    region: sanitizeLocality(address.state || address.state_district || address.county || ""),
    country: sanitizeLocality(address.country || ""),
    country_code: String(address.country_code || "").toUpperCase(),
    address,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = new URL(req.url, "https://w1ld.app");
    const zoneId = url.searchParams.get("zoneId");
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");
    let lat = latParam === null ? Number.NaN : Number(latParam);
    let lng = lngParam === null ? Number.NaN : Number(lngParam);

    if (zoneId) {
      const center = getZoneCenter(zoneId);
      if (!center) return res.status(400).json({ error: "Invalid zoneId" });
      lat = center.lat;
      lng = center.lng;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat/lng or zoneId required" });
    }

    const cacheKey = zoneId
      ? `zone:${zoneId}`
      : `coords:${lat.toFixed(3)}:${lng.toFixed(3)}`;

    const cached = readCache(cacheKey);
    if (cached) return res.status(200).json(cached);

    const geocoded = await reverseGeocode(lat, lng);
    const payload = {
      city: geocoded.city,
      region: geocoded.region,
      country: geocoded.country,
      country_code: geocoded.country_code,
      zone_label: zoneId ? buildZoneLabel(zoneId, geocoded.address) : null,
    };

    writeCache(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[location-meta] error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
