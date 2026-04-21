import { useEffect, useState } from "react";
import { getZoneCenter, parseZoneId } from "@/lib/zones";
import { createApiUrl } from "@/lib/app-config";

const CACHE_PREFIX = "w1ld-location-meta:v3:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const memoryCache = new Map();
const inflight = new Map();
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
  lisbon: "LIS",
  lisbonne: "LIS",
  london: "LDN",
  londres: "LDN",
});

function titleCase(value) {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeLocality(value) {
  if (!value) return "";
  return titleCase(String(value).split(",")[0].trim());
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
  if (condensed.length >= 3) {
    return condensed.slice(0, 3).toUpperCase();
  }

  if (condensed.length > 0) {
    return condensed.toUpperCase().padEnd(3, "X");
  }

  const safeCountryCode = String(countryCode || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (safeCountryCode) return safeCountryCode.slice(0, 3).padEnd(3, "X");

  return "ZNE";
}

function getZoneCacheKey(zoneId) {
  return `${CACHE_PREFIX}zone:${zoneId}`;
}

function getCoordsCacheKey(lat, lng) {
  return `${CACHE_PREFIX}coords:${Number(lat).toFixed(3)}:${Number(lng).toFixed(3)}`;
}

function readCache(cacheKey) {
  const memoryValue = memoryCache.get(cacheKey);
  if (memoryValue && Date.now() - memoryValue.ts < CACHE_TTL_MS) {
    return memoryValue.value;
  }

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.value || Date.now() - parsed.ts >= CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, value) {
  if (!value) return;
  const payload = { value, ts: Date.now() };
  memoryCache.set(cacheKey, payload);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {}
}

function pickLocality(meta = {}) {
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  return sanitizeLocality(
    safeMeta.city ||
      safeMeta.town ||
      safeMeta.village ||
      safeMeta.municipality ||
      safeMeta.city_district ||
      safeMeta.suburb ||
      safeMeta.county ||
      safeMeta.region ||
      safeMeta.country ||
      "",
  );
}

export function getZoneOrdinal(zoneId) {
  const parsed = parseZoneId(zoneId);
  if (!parsed) return 1;
  return (Math.abs(parsed.zLat * 17 + parsed.zLng * 31) % 12) + 1;
}

export function getZoneShortCode(zoneId, meta = null) {
  if (!zoneId) return "—";
  const locality = pickLocality(meta);
  return buildLocalityCode(locality, meta?.country_code);
}

export function buildZoneLabel(zoneId, meta = null) {
  if (!zoneId) return "";
  const locality = pickLocality(meta);
  const code = buildLocalityCode(locality, meta?.country_code);
  return `${code} ${getZoneOrdinal(zoneId)}`;
}

function normalizeLocationMeta(payload, zoneId = null) {
  if (!payload) return null;

  const meta = {
    city: sanitizeLocality(payload.city || payload.town || payload.village || payload.municipality || payload.city_district || payload.suburb || ""),
    region: sanitizeLocality(payload.region || payload.state || payload.state_district || payload.county || ""),
    country: sanitizeLocality(payload.country || ""),
    country_code: (payload.country_code || "").toUpperCase(),
  };

  if (zoneId) {
    meta.zone_label = buildZoneLabel(zoneId, meta);
  }

  return meta;
}

async function fetchLocationMeta(params) {
  const query = new URLSearchParams();
  if (params.zoneId) query.set("zoneId", params.zoneId);
  if (Number.isFinite(Number(params.lat))) query.set("lat", Number(params.lat));
  if (Number.isFinite(Number(params.lng))) query.set("lng", Number(params.lng));

  const res = await fetch(createApiUrl(`/api/location-meta?${query.toString()}`));
  if (!res.ok) throw new Error("LOCATION_META_FAILED");

  const payload = await res.json();
  return normalizeLocationMeta(payload, params.zoneId || null);
}

export async function resolveLocationMeta({ lat, lng, zoneId = null }) {
  if (!zoneId && (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))) return null;

  const cacheKey = zoneId ? getZoneCacheKey(zoneId) : getCoordsCacheKey(lat, lng);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const promise = fetchLocationMeta({ lat, lng, zoneId })
    .then((value) => {
      writeCache(cacheKey, value);
      return value;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, promise);
  return promise;
}

export async function resolveZoneMeta(zoneId) {
  if (!zoneId) return null;
  const center = getZoneCenter(zoneId);
  if (!center) return null;
  return resolveLocationMeta({ zoneId, lat: center.lat, lng: center.lng });
}

export function getCachedZoneLabel(zoneId) {
  if (!zoneId) return "";
  const cached = readCache(getZoneCacheKey(zoneId));
  return buildZoneLabel(zoneId, cached);
}

export function useZoneLabel(zoneId) {
  const [meta, setMeta] = useState(() => (zoneId ? readCache(getZoneCacheKey(zoneId)) : null));

  useEffect(() => {
    if (!zoneId) {
      setMeta(null);
      return;
    }

    const cached = readCache(getZoneCacheKey(zoneId));
    if (cached) setMeta(cached);

    let cancelled = false;
    resolveZoneMeta(zoneId)
      .then((nextMeta) => {
        if (!cancelled && nextMeta) setMeta(nextMeta);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  return {
    meta,
    label: zoneId ? buildZoneLabel(zoneId, meta) : "",
    shortCode: getZoneShortCode(zoneId, meta),
  };
}

export function useZoneLabels(zoneIds = []) {
  const uniqueZoneIds = [...new Set(zoneIds.filter(Boolean))];
  const [labels, setLabels] = useState(() =>
    Object.fromEntries(uniqueZoneIds.map((zoneId) => [zoneId, getCachedZoneLabel(zoneId)])),
  );

  useEffect(() => {
    if (!uniqueZoneIds.length) {
      setLabels({});
      return;
    }

    let cancelled = false;

    const nextLabels = Object.fromEntries(
      uniqueZoneIds.map((zoneId) => [zoneId, getCachedZoneLabel(zoneId)]),
    );
    setLabels((prev) => ({ ...prev, ...nextLabels }));

    (async () => {
      const unresolvedZoneIds = uniqueZoneIds.filter((zoneId) => !readCache(getZoneCacheKey(zoneId)));
      if (!unresolvedZoneIds.length) return;

      const results = await Promise.allSettled(
        unresolvedZoneIds.map(async (zoneId) => {
          const meta = await resolveZoneMeta(zoneId);
          return [zoneId, meta];
        }),
      );

      if (cancelled) return;

      const resolvedLabels = {};
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const [zoneId, meta] = result.value;
        if (!meta) continue;
        resolvedLabels[zoneId] = buildZoneLabel(zoneId, meta);
      }

      if (Object.keys(resolvedLabels).length) {
        setLabels((prev) => ({ ...prev, ...resolvedLabels }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uniqueZoneIds.join("|")]);

  return labels;
}
