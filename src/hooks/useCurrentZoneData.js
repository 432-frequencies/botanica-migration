import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { buildLocalTerrainSignals } from "@/lib/localTerrain";
import { buildZoneLabel, getCachedZoneLabel, resolveZoneMeta } from "@/lib/locationMeta";
import { computeUserZoneScores, getSurroundingZoneIds, getZoneId } from "@/lib/zones";

const IS_DEV = import.meta.env.DEV;

function debugError(...args) {
  if (IS_DEV) {
    console.error(...args);
  }
}

export function useCurrentZoneData({
  userEmail,
  discoveries = [],
  geoCoords = null,
  active = true,
  nearbyRadius = 0,
  includeOwnedZonesCount = false,
} = {}) {
  const zoneId = useMemo(
    () => getZoneId(geoCoords?.lat, geoCoords?.lng),
    [geoCoords?.lat, geoCoords?.lng],
  );
  const surroundingZoneIds = useMemo(() => {
    if (!zoneId || !geoCoords) return [];
    return nearbyRadius > 0
      ? getSurroundingZoneIds(geoCoords.lat, geoCoords.lng, nearbyRadius)
      : [zoneId];
  }, [geoCoords?.lat, geoCoords?.lng, nearbyRadius, zoneId]);
  const zoneScores = useMemo(() => computeUserZoneScores(discoveries), [discoveries]);
  const localSpeciesCount = zoneId ? (zoneScores[zoneId] || 0) : 0;

  const [leadersByZone, setLeadersByZone] = useState({});
  const [ownedZonesCount, setOwnedZonesCount] = useState(0);
  const [zoneName, setZoneName] = useState(() => getCachedZoneLabel(zoneId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setZoneName(getCachedZoneLabel(zoneId));
  }, [zoneId]);

  useEffect(() => {
    if (!active || !zoneId) return;

    let cancelled = false;
    resolveZoneMeta(zoneId)
      .then((meta) => {
        if (cancelled || !meta) return;
        setZoneName(buildZoneLabel(zoneId, meta));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [active, zoneId]);

  useEffect(() => {
    if (!active || !userEmail || !zoneId) {
      setLeadersByZone({});
      setOwnedZonesCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadZoneData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [leadersRes, ownedZonesRes] = await Promise.all([
          supabase
            .from("zone_leaders")
            .select("zone_id,user_email,display_name,species_count,last_updated")
            .in("zone_id", surroundingZoneIds.length ? surroundingZoneIds : [zoneId]),
          includeOwnedZonesCount
            ? supabase
                .from("zone_leaders")
                .select("zone_id", { count: "exact", head: true })
                .eq("user_email", userEmail)
            : Promise.resolve({ count: 0 }),
        ]);

        if (cancelled) return;

        const map = {};
        for (const row of leadersRes.data || []) {
          if (!row?.zone_id) continue;
          const previous = map[row.zone_id];
          if (!previous || (row.species_count || 0) > (previous.species_count || 0)) {
            map[row.zone_id] = row;
          }
        }

        setLeadersByZone(map);
        setOwnedZonesCount(includeOwnedZonesCount ? (ownedZonesRes.count || 0) : 0);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError);
        debugError("[useCurrentZoneData] load failed:", loadError?.message || loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadZoneData();

    return () => {
      cancelled = true;
    };
  }, [active, includeOwnedZonesCount, surroundingZoneIds.join("|"), userEmail, zoneId]);

  const leader = zoneId ? (leadersByZone[zoneId] || null) : null;
  const isLeader = leader?.user_email === userEmail;
  const noLeader = !leader;
  const zoneTarget = Math.max(1, (leader?.species_count || 0) + (isLeader ? 0 : 1));
  const zoneGap = leader ? Math.max(1, zoneTarget - localSpeciesCount) : 1;
  const canDocumentNow = !isLeader && (leader ? localSpeciesCount >= zoneTarget : localSpeciesCount >= 1);
  const zoneProgress = Math.min(100, (localSpeciesCount / zoneTarget) * 100);
  const terrainSignals = useMemo(() => buildLocalTerrainSignals({
    currentZoneId: zoneId,
    surroundingZoneIds,
    leadersByZone,
    zoneScores,
    userEmail,
  }), [leadersByZone, surroundingZoneIds, userEmail, zoneId, zoneScores]);

  return {
    zoneId,
    zoneName,
    zoneScores,
    localSpeciesCount,
    leadersByZone,
    leader,
    ownedZonesCount,
    surroundingZoneIds,
    loading,
    error,
    isLeader,
    noLeader,
    zoneTarget,
    zoneGap,
    canDocumentNow,
    zoneProgress,
    terrainSignals,
  };
}
