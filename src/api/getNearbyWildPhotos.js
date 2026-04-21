import { supabase } from "@/api/supabaseClient";

const PHOTO_FIELDS = [
  "id",
  "photo_url",
  "thumbnail_url",
  "common_name",
  "scientific_name",
  "category",
  "latitude",
  "longitude",
  "location_name",
  "observation_context",
  "created_at",
  "discovered_date",
].join(",");

const REFERENCE_PHOTO_FIELDS = [
  "id",
  "photo_url",
  "common_name",
  "scientific_name",
  "category",
  "latitude",
  "longitude",
  "rarity",
  "description",
  "created_at",
].join(",");

const REFERENCE_MINIMAL_FIELDS = [
  "id",
  "common_name",
  "scientific_name",
  "category",
  "latitude",
  "longitude",
  "rarity",
  "description",
  "created_at",
].join(",");

const DEFAULT_RADIUS_METERS = 12000;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getDistanceMeters(from, to) {
  const lat1 = toNumber(from?.lat);
  const lng1 = toNumber(from?.lng);
  const lat2 = toNumber(to?.lat);
  const lng2 = toNumber(to?.lng);

  if ([lat1, lng1, lat2, lng2].some((value) => value === null)) return null;

  const earthRadius = 6371000;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getBounds(coords, radiusMeters) {
  const lat = toNumber(coords?.lat);
  const lng = toNumber(coords?.lng);
  if (lat === null || lng === null) return null;

  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

function normalizePhoto(row, coords, { contextVerified = true } = {}) {
  const imageUrl = String(row?.photo_url || row?.thumbnail_url || "").trim();
  if (!imageUrl) return null;

  const distanceMeters = getDistanceMeters(coords, {
    lat: row?.latitude,
    lng: row?.longitude,
  });

  return {
    id: row.id,
    photoUrl: imageUrl,
    commonName: row.common_name || "Observation locale",
    scientificName: row.scientific_name || "",
    category: row.category || "plant",
    locationName: row.location_name || "",
    distanceMeters,
    observedAt: row.created_at || row.discovered_date || null,
    observationContext: row.observation_context || "unknown",
    contextVerified: contextVerified && row.observation_context === "wild",
    source: "discovery",
  };
}

function getReferenceImageUrl(row) {
  const photoUrl = String(row?.photo_url || "").trim();
  if (photoUrl) return photoUrl;

  const description = String(row?.description || "").trim();
  return /^https?:\/\//i.test(description) ? description : "";
}

function normalizeReferencePhoto(row, coords) {
  const imageUrl = getReferenceImageUrl(row);

  const distanceMeters = getDistanceMeters(coords, {
    lat: row?.latitude,
    lng: row?.longitude,
  });

  return {
    id: `reference-${row.id}`,
    photoUrl: imageUrl,
    hasImage: Boolean(imageUrl),
    commonName: row.common_name || "Espèce locale",
    scientificName: row.scientific_name || "",
    category: row.category || "plant",
    locationName: "",
    distanceMeters,
    observedAt: row.created_at || null,
    observationContext: "reference",
    contextVerified: false,
    source: "reference",
    rarity: row.rarity || "commune",
  };
}

function dedupePhotos(photos) {
  const seen = new Set();

  return photos.filter((photo) => {
    const key = String(photo.scientificName || photo.commonName || photo.photoUrl)
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildBaseQuery({ bounds, useContextFilter, includeContext = true }) {
  let query = supabase
    .from("plant_discoveries")
    .select(includeContext ? PHOTO_FIELDS : PHOTO_FIELDS.replace(",observation_context", ""))
    .not("photo_url", "is", null)
    .neq("photo_url", "")
    .order("created_at", { ascending: false })
    .limit(bounds ? 80 : 40);

  if (useContextFilter) {
    query = query.eq("observation_context", "wild");
  }

  if (bounds) {
    query = query
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", bounds.minLat)
      .lte("latitude", bounds.maxLat)
      .gte("longitude", bounds.minLng)
      .lte("longitude", bounds.maxLng);
  }

  return query;
}

async function fetchPhotoRows({ bounds }) {
  const wildQuery = buildBaseQuery({ bounds, useContextFilter: true });
  const wildResult = await wildQuery;

  if (!wildResult.error) {
    return { rows: wildResult.data || [], contextVerified: true };
  }

  const missingContextColumn = /observation_context/i.test(wildResult.error.message || "");
  if (!missingContextColumn) {
    console.warn("[getNearbyWildPhotos] unable to load local wild photos:", wildResult.error.message);
    return { rows: [], contextVerified: true };
  }

  const fallbackQuery = buildBaseQuery({ bounds, useContextFilter: false, includeContext: false });
  const fallbackResult = await fallbackQuery;
  if (fallbackResult.error) {
    console.warn("[getNearbyWildPhotos] unable to load recent photo fallback:", fallbackResult.error.message);
    return { rows: [], contextVerified: false };
  }

  return { rows: fallbackResult.data || [], contextVerified: false };
}

async function fetchReferenceRows({ bounds, limit = 160 } = {}) {
  const buildQuery = (fields) => {
    let query = supabase
      .from("reference_species")
      .select(fields)
      .limit(limit);

    if (bounds) {
      query = query
        .gte("latitude", bounds.minLat)
        .lte("latitude", bounds.maxLat)
        .gte("longitude", bounds.minLng)
        .lte("longitude", bounds.maxLng);
    }

    return query;
  };

  let result = await buildQuery(REFERENCE_PHOTO_FIELDS);

  if (result.error && /photo_url/i.test(result.error.message || "")) {
    result = await buildQuery(REFERENCE_MINIMAL_FIELDS);
  }

  if (result.error) {
    console.warn("[getNearbyWildPhotos] unable to load reference species fallback:", result.error.message);
    return [];
  }

  return result.data || [];
}

async function getReferenceFallbackPhotos({ coords, limit, radiusMeters }) {
  const localBounds = getBounds(coords, Math.max(radiusMeters, DEFAULT_RADIUS_METERS));
  const localRows = await fetchReferenceRows({ bounds: localBounds, limit: 120 });

  let rows = localRows;
  if (!rows.length) {
    // If no referenced species exists in the immediate area, keep the Home alive
    // with the nearest known reference photos instead of showing an empty section.
    rows = await fetchReferenceRows({ bounds: null, limit: 240 });
  }

  const references = rows
    .map((row) => normalizeReferencePhoto(row, coords))
    .filter(Boolean)
    .sort((a, b) => {
      if (Number.isFinite(a.distanceMeters) && Number.isFinite(b.distanceMeters)) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (Number.isFinite(a.distanceMeters)) return -1;
      if (Number.isFinite(b.distanceMeters)) return 1;
      return String(a.commonName).localeCompare(String(b.commonName));
    });

  return dedupePhotos(references).slice(0, limit);
}

export async function getNearbyWildPhotos({ coords, limit = 8, radiusMeters = DEFAULT_RADIUS_METERS } = {}) {
  const bounds = getBounds(coords, radiusMeters);
  const { rows, contextVerified } = await fetchPhotoRows({ bounds });

  const photos = rows
    .map((row) => normalizePhoto(row, coords, { contextVerified }))
    .filter(Boolean)
    .filter((photo) => !bounds || (Number.isFinite(photo.distanceMeters) && photo.distanceMeters <= radiusMeters))
    .sort((a, b) => {
      if (Number.isFinite(a.distanceMeters) && Number.isFinite(b.distanceMeters)) {
        return a.distanceMeters - b.distanceMeters;
      }
      return new Date(b.observedAt || 0).getTime() - new Date(a.observedAt || 0).getTime();
    });

  const localPhotos = dedupePhotos(photos).slice(0, limit);
  if (localPhotos.length) return localPhotos;

  return getReferenceFallbackPhotos({ coords, limit, radiusMeters });
}
