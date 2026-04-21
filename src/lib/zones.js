import { getSpeciesKey } from "@/lib/species";

export const ZONE_DEG = 0.0045;

export function getZoneId(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  return `${Math.floor(Number(lat) / ZONE_DEG)}_${Math.floor(Number(lng) / ZONE_DEG)}`;
}

export function parseZoneId(zoneId) {
  if (!zoneId || typeof zoneId !== "string" || !zoneId.includes("_")) return null;
  const [zLat, zLng] = zoneId.split("_").map(Number);
  if (!Number.isFinite(zLat) || !Number.isFinite(zLng)) return null;
  return { zLat, zLng };
}

export function getZoneCenter(zoneId) {
  const parsed = parseZoneId(zoneId);
  if (!parsed) return null;

  return {
    lat: (parsed.zLat + 0.5) * ZONE_DEG,
    lng: (parsed.zLng + 0.5) * ZONE_DEG,
  };
}

export function getSurroundingZoneIds(lat, lng, radius = 1) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return [];

  const baseLat = Math.floor(Number(lat) / ZONE_DEG);
  const baseLng = Math.floor(Number(lng) / ZONE_DEG);
  const zones = [];

  for (let dLat = -radius; dLat <= radius; dLat += 1) {
    for (let dLng = -radius; dLng <= radius; dLng += 1) {
      zones.push(`${baseLat + dLat}_${baseLng + dLng}`);
    }
  }

  return zones;
}

export function computeUserZoneScores(discoveries = []) {
  const zoneMap = {};

  for (const discovery of discoveries) {
    const zoneId = getZoneId(discovery.latitude, discovery.longitude);
    const speciesKey = getSpeciesKey(discovery);
    if (!zoneId || !speciesKey) continue;

    if (!zoneMap[zoneId]) zoneMap[zoneId] = new Set();
    zoneMap[zoneId].add(speciesKey);
  }

  return Object.fromEntries(
    Object.entries(zoneMap).map(([zoneId, species]) => [zoneId, species.size]),
  );
}

export function countUniqueSpeciesInZone(discoveries = [], zoneId) {
  if (!zoneId) return 0;
  return computeUserZoneScores(discoveries)[zoneId] || 0;
}
