import { useState, useEffect, useRef, useCallback } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/api/supabaseClient";
import { Compass, Globe2, RefreshCw, MapPin } from "lucide-react";
import ZoneDetailPanel from "@/components/map/ZoneDetailPanel";
import ConquestVictoryModal from "@/components/map/ConquestVictoryModal";
import ChampionCelebration from "@/components/map/ChampionCelebration";
import MapHUD from "@/components/map/MapHUD";
import { resolveDisplayName } from "@/lib/displayName";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { computeUserZoneScores, getSurroundingZoneIds, getZoneId, ZONE_DEG } from "@/lib/zones";

function getZoneRect(zone_id) {
  const [zLat, zLng] = zone_id.split("_").map(Number);
  return {
    latMin: zLat * ZONE_DEG,
    latMax: (zLat + 1) * ZONE_DEG,
    lngMin: zLng * ZONE_DEG,
    lngMax: (zLng + 1) * ZONE_DEG,
    centerLat: (zLat + 0.5) * ZONE_DEG,
    centerLng: (zLng + 0.5) * ZONE_DEG,
  };
}

function getVisibleZoneBounds(lat, lng, radiusZones = 5) {
  const baseZLat = Math.floor(lat / ZONE_DEG);
  const baseZLng = Math.floor(lng / ZONE_DEG);
  return {
    latMin: (baseZLat - radiusZones) * ZONE_DEG,
    latMax: (baseZLat + radiusZones + 1) * ZONE_DEG,
    lngMin: (baseZLng - radiusZones) * ZONE_DEG,
    lngMax: (baseZLng + radiusZones + 1) * ZONE_DEG,
  };
}

// Convert lat/lng delta to pixels on the grid canvas
function latLngToPixel(lat, lng, originLat, originLng, pxPerZone) {
  const dLat = (lat - originLat) / ZONE_DEG;
  const dLng = (lng - originLng) / ZONE_DEG;
  return {
    x: dLng * pxPerZone,
    y: -dLat * pxPerZone, // invert Y (lat grows up, pixels grow down)
  };
}

const PX_PER_ZONE = 72; // pixel size of each zone cell
const GRID_RADIUS = 5;   // zones to show in each direction
const ATLAS_VIEWPORTS = {
  world: { center: [22, 8], zoom: 2 },
  europe: { center: [48.8, 8.5], zoom: 4 },
};

const CELL_VISUALS = {
  mastered: {
    background: "radial-gradient(circle at 50% 46%, rgba(255,226,142,0.28) 0%, rgba(255,218,120,0.13) 38%, rgba(9,8,5,0.34) 100%)",
    border: "rgba(255,218,120,0.86)",
    marker: "rgba(255,226,142,0.94)",
    glow: "0 0 0 1px rgba(255,226,142,0.3), 0 0 22px rgba(255,218,120,0.28), inset 0 0 18px rgba(255,218,120,0.055)",
    pulse: "masteredPresencePulse",
  },
  potential: {
    background: "radial-gradient(circle at 50% 48%, rgba(190,180,96,0.075) 0%, rgba(130,152,80,0.035) 44%, rgba(8,13,9,0.18) 100%)",
    border: "rgba(190,180,96,0.24)",
    marker: "rgba(196,190,118,0.54)",
    glow: "inset 0 0 14px rgba(190,180,96,0.035)",
    pulse: null,
  },
  documented: {
    background: "radial-gradient(circle at 50% 48%, rgba(72,142,186,0.075) 0%, rgba(70,154,168,0.035) 44%, rgba(8,13,16,0.2) 100%)",
    border: "rgba(112,176,216,0.22)",
    marker: "rgba(132,196,230,0.48)",
    glow: "inset 0 0 14px rgba(70,136,196,0.028)",
    pulse: null,
  },
  neutral: {
    background: "rgba(237,240,230,0.012)",
    border: "rgba(237,240,230,0.044)",
    marker: "rgba(237,240,230,0.16)",
    glow: "none",
    pulse: null,
  },
};

function getZonePotential(zoneId) {
  const seed = String(zoneId || "zone").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return seed % 17 === 0;
}

function getCellState({ isOwned, isDocumented, isPotential }) {
  if (isOwned) return "mastered";
  if (isPotential) return "potential";
  if (isDocumented) return "documented";
  return "neutral";
}

function emptyZoneActivity() {
  return {
    observationCount: 0,
    speciesCount: 0,
    explorerCount: 0,
  };
}

function getSpeciesKey(discovery) {
  return (discovery?.scientific_name || discovery?.common_name || "").trim().toLowerCase();
}

function computeZoneActivityStats(discoveries = []) {
  const map = {};

  for (const discovery of discoveries) {
    if (!Number.isFinite(discovery?.latitude) || !Number.isFinite(discovery?.longitude)) continue;

    const zoneId = getZoneId(discovery.latitude, discovery.longitude);
    if (!map[zoneId]) {
      map[zoneId] = {
        observationCount: 0,
        species: new Set(),
        explorers: new Set(),
      };
    }

    const speciesKey = getSpeciesKey(discovery);
    map[zoneId].observationCount += 1;
    if (speciesKey) map[zoneId].species.add(speciesKey);
    if (discovery.user_email) map[zoneId].explorers.add(discovery.user_email);
  }

  return Object.fromEntries(
    Object.entries(map).map(([zoneId, stats]) => [
      zoneId,
      {
        observationCount: stats.observationCount,
        speciesCount: stats.species.size,
        explorerCount: stats.explorers.size,
      },
    ]),
  );
}

function emptyAtlasStats() {
  return {
    observationCount: 0,
    speciesCount: 0,
    sectorCount: 0,
    macroAreaCount: 0,
    topZoneId: null,
    topZoneScore: 0,
  };
}

function getMacroAreaId(lat, lng) {
  return `${Math.floor(lat * 2) / 2}_${Math.floor(lng * 2) / 2}`;
}

function computeAtlasStats(discoveries = []) {
  const cleanDiscoveries = discoveries.filter((discovery) =>
    Number.isFinite(discovery?.latitude) && Number.isFinite(discovery?.longitude)
  );
  const species = new Set();
  const macroAreas = new Set();
  const zoneScores = computeUserZoneScores(cleanDiscoveries);

  for (const discovery of cleanDiscoveries) {
    const speciesKey = getSpeciesKey(discovery);
    if (speciesKey) species.add(speciesKey);
    macroAreas.add(getMacroAreaId(discovery.latitude, discovery.longitude));
  }

  const [topZoneId, topZoneScore = 0] = Object.entries(zoneScores)
    .sort((a, b) => b[1] - a[1])[0] || [null, 0];

  return {
    observationCount: cleanDiscoveries.length,
    speciesCount: species.size,
    sectorCount: Object.keys(zoneScores).length,
    macroAreaCount: macroAreas.size,
    topZoneId,
    topZoneScore,
  };
}

function normalizeAtlasPoint(discovery, index) {
  const latitude = Number(discovery?.latitude);
  const longitude = Number(discovery?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const commonName = discovery?.common_name?.trim() || "Observation";
  const scientificName = discovery?.scientific_name?.trim() || "";

  return {
    id: `${latitude.toFixed(5)}_${longitude.toFixed(5)}_${index}`,
    latitude,
    longitude,
    commonName,
    scientificName,
    speciesKey: getSpeciesKey(discovery) || commonName.toLowerCase(),
  };
}

function buildAtlasPoints(discoveries = []) {
  return discoveries
    .map(normalizeAtlasPoint)
    .filter(Boolean)
    .slice(0, 5000);
}

function AtlasCamera({ view, points }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    if (view === "traces" && points.length > 0) {
      if (points.length === 1) {
        map.setView([points[0].latitude, points[0].longitude], 8, { animate: true });
        return;
      }

      const bounds = points.map((point) => [point.latitude, point.longitude]);
      map.fitBounds(bounds, {
        animate: true,
        duration: 0.8,
        maxZoom: 8,
        padding: [42, 42],
      });
      return;
    }

    const viewport = ATLAS_VIEWPORTS[view] || ATLAS_VIEWPORTS.world;
    map.setView(viewport.center, viewport.zoom, { animate: true, duration: 0.8 });
  }, [map, points, view]);

  return null;
}

function AtlasZoomButtons() {
  const map = useMap();

  return (
    <div
      className="absolute right-4 z-[700] flex flex-col overflow-hidden rounded-2xl"
      style={{
        top: 176,
        background: "rgba(6,10,9,0.82)",
        border: "1px solid rgba(237,240,230,0.1)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
      }}
    >
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="h-11 w-11 text-lg font-black active:scale-95"
        style={{ color: "rgba(237,240,230,0.92)", borderBottom: "1px solid rgba(237,240,230,0.08)" }}
        aria-label="Zoomer"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="h-11 w-11 text-lg font-black active:scale-95"
        style={{ color: "rgba(237,240,230,0.92)" }}
        aria-label="Dézoomer"
      >
        −
      </button>
    </div>
  );
}

function AtlasWorldMap({ points, view, onViewChange, stats }) {
  const pointCount = points.length;
  const hasPoints = pointCount > 0;

  return (
    <div className="absolute inset-0 z-10">
      <MapContainer
        center={ATLAS_VIEWPORTS.world.center}
        zoom={ATLAS_VIEWPORTS.world.zoom}
        minZoom={2}
        maxZoom={11}
        zoomControl={false}
        worldCopyJump
        style={{ width: "100%", height: "100%", background: "#050807" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <AtlasCamera view={view} points={points} />
        <AtlasZoomButtons />

        {points.map((point, index) => (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={index < 80 ? 5 : 4}
            pathOptions={{
              color: "rgba(174,255,188,0.92)",
              fillColor: "rgba(54,211,122,0.62)",
              fillOpacity: 0.72,
              opacity: 0.9,
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.96}>
              <div style={{ minWidth: 120 }}>
                <strong>{point.commonName}</strong>
                {point.scientificName && (
                  <div style={{ opacity: 0.68, fontStyle: "italic" }}>{point.scientificName}</div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-4 pt-4"
        style={{
          background: "linear-gradient(180deg, rgba(5,8,7,0.72), rgba(5,8,7,0))",
        }}
      >
        <div
          className="pointer-events-auto rounded-[28px] p-4"
          style={{
            background: "linear-gradient(145deg, rgba(6,10,9,0.88), rgba(10,16,14,0.62))",
            border: "1px solid rgba(237,240,230,0.08)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 18px 46px rgba(0,0,0,0.32)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "rgba(59,125,232,0.12)",
                border: "1px solid rgba(132,196,230,0.2)",
              }}
            >
              <Globe2 className="h-4 w-4" style={{ color: "rgba(174,255,188,0.94)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(237,240,230,0.42)" }}>
                Atlas mondial
              </p>
              <p className="mt-1 text-lg font-black uppercase leading-tight" style={{ color: "var(--v1v-fg)" }}>
                {hasPoints
                  ? `${stats.speciesCount} espèces cartographiées`
                  : "Aucune espèce cartographiée"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                Dézoome, zoome, et retrouve toutes les traces que tu as laissées dans le vivant.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { id: "world", label: "Monde" },
              { id: "europe", label: "Europe" },
              { id: "traces", label: "Mes traces" },
            ].map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className="rounded-2xl px-2 py-2 text-center text-[8px] font-black uppercase tracking-[0.16em] transition-all active:scale-[0.97]"
                  style={{
                    background: active ? "rgba(174,255,188,0.12)" : "rgba(237,240,230,0.04)",
                    border: `1px solid ${active ? "rgba(174,255,188,0.22)" : "rgba(237,240,230,0.07)"}`,
                    color: active ? "rgba(174,255,188,0.92)" : "rgba(237,240,230,0.55)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!hasPoints && (
        <div className="absolute inset-x-6 top-1/2 z-[500] -translate-y-1/2 rounded-[28px] p-5 text-center"
          style={{
            background: "rgba(6,10,9,0.82)",
            border: "1px solid rgba(237,240,230,0.08)",
            backdropFilter: "blur(16px)",
          }}
        >
          <p className="text-sm font-black uppercase tracking-[0.12em]" style={{ color: "var(--v1v-fg)" }}>
            Ton atlas attend sa première trace
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
            Chaque observation géolocalisée apparaîtra ici à l’échelle du monde.
          </p>
        </div>
      )}
    </div>
  );
}

export default function TerritorialMap() {
  const isActive = useIsActivePage("TerritorialMap");
  // Extract target coordinates from URL query params
  const params = new URLSearchParams(window.location.search);
  const targetLat = params.get('lat') ? parseFloat(params.get('lat')) : null;
  const targetLng = params.get('lng') ? parseFloat(params.get('lng')) : null;
  const targetZoneId = params.get('zoneId') || null;

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [leaders, setLeaders] = useState({});   // zone_id → ZoneLeader record
  const [userScores, setUserScores] = useState({}); // zone_id → int
  const [zoneActivity, setZoneActivity] = useState({});
  const [atlasStats, setAtlasStats] = useState(emptyAtlasStats());
  const [atlasPoints, setAtlasPoints] = useState([]);
  const [atlasView, setAtlasView] = useState("world");
  const [mapMode, setMapMode] = useState("local");
  const [userEmail, setUserEmail] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null); // { zone_id, leader, userScore }
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [notifications, setNotifications] = useState([]); // [{id, type, msg}]
  const [conquestZone, setConquestZone] = useState(null); // { zone_id, userScore }
  const [championZone, setChampionZone] = useState(null); // Zone où on devient champion
  const [userDisplayName, setUserDisplayName] = useState(null);
  const prevLeadersRef = useRef({});
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);
  const [dragged, setDragged] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive) return;
    // If URL contains target coords, use those; otherwise use user geolocation
    if (targetLat !== null && targetLng !== null) {
      setUserLocation({ lat: targetLat, lng: targetLng });
    } else {
      navigator.geolocation?.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocationError(true),
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  }, [isActive, targetLat, targetLng]);

  useEffect(() => {
    if (!isActive || !userLocation) return;
    loadData();
  }, [isActive, userLocation]);

  useEffect(() => {
    if (!targetZoneId) return;
    const targetLeader = leaders[targetZoneId] || null;
    const targetScore = userScores[targetZoneId] || 0;
    setSelectedZone({
      zone_id: targetZoneId,
      leader: targetLeader,
      userScore: targetScore,
      activity: zoneActivity[targetZoneId] || emptyZoneActivity(),
    });
  }, [targetZoneId, leaders, userScores, zoneActivity]);

  useEffect(() => {
    setSelectedZone((current) => {
      if (!current?.zone_id) return current;
      return {
        ...current,
        leader: leaders[current.zone_id] || null,
        userScore: userScores[current.zone_id] || 0,
        activity: zoneActivity[current.zone_id] || emptyZoneActivity(),
      };
    });
  }, [leaders, userScores, zoneActivity]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email);
    if (user?.email) {
      const { data: profileRows } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("user_email", user.email)
        .limit(1);

      setUserDisplayName(resolveDisplayName({
        displayName: profileRows?.[0]?.display_name,
        fullName: user.user_metadata?.full_name,
        email: user.email,
      }));
    }

    // Load zone leaders for surrounding area
    const zoneIds = getSurroundingZoneIds(userLocation.lat, userLocation.lng, GRID_RADIUS);
    const visibleBounds = getVisibleZoneBounds(userLocation.lat, userLocation.lng, GRID_RADIUS);
    const { data: allLeaders } = await supabase
      .from('zone_leaders')
      .select('zone_id,user_email,display_name,species_count,last_updated')
      .in('zone_id', zoneIds);
    const leaderMap = {};
    for (const l of (allLeaders || [])) {
      leaderMap[l.zone_id] = l;
    }
    // Detect lost zones & newly conquered zones
    const prevMap = prevLeadersRef.current;
    const lostZones = Object.entries(prevMap).filter(([zid, prev]) =>
      prev.user_email === user?.email && leaderMap[zid] && leaderMap[zid].user_email !== user?.email
    );
    const newlyConquered = Object.entries(leaderMap).filter(([zid, cur]) =>
      cur.user_email === user?.email && (!prevMap[zid] || prevMap[zid].user_email !== user?.email)
    );
    if (lostZones.length > 0) {
      setNotifications(n => [...n, { id: Date.now() + 1, type: "lost", msg: `${lostZones.length} secteur${lostZones.length > 1 ? "s ont" : " a"} changé de référence` }]);
    }
    prevLeadersRef.current = leaderMap;
    setLeaders(leaderMap);

    const { data: visibleDiscoveries, error: visibleDiscoveriesError } = await supabase
      .from('plant_discoveries')
      .select('latitude,longitude,user_email,common_name,scientific_name')
      .gte('latitude', visibleBounds.latMin)
      .lte('latitude', visibleBounds.latMax)
      .gte('longitude', visibleBounds.lngMin)
      .lte('longitude', visibleBounds.lngMax)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(2500);

    if (visibleDiscoveriesError) {
      console.warn("[TerritorialMap] Impossible de charger l'activité des secteurs:", visibleDiscoveriesError.message);
    }

    const discoveriesInView = visibleDiscoveriesError ? [] : (visibleDiscoveries || []);
    const activityMap = computeZoneActivityStats(discoveriesInView);
    setZoneActivity(activityMap);

    // Load user discoveries to compute scores locally
    let newScores = {};
    if (user) {
      const { data: globalUserDiscoveries, error: globalUserDiscoveriesError } = await supabase
        .from('plant_discoveries')
        .select('latitude,longitude,common_name,scientific_name')
        .eq('user_email', user.email)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(5000);

      if (globalUserDiscoveriesError) {
        console.warn("[TerritorialMap] Atlas limité à la vue locale:", globalUserDiscoveriesError.message);
      }

      const userDiscoveries = globalUserDiscoveriesError
        ? discoveriesInView.filter((discovery) => discovery.user_email === user.email)
        : (globalUserDiscoveries || []);
      newScores = computeUserZoneScores(userDiscoveries);
      setUserScores(newScores);
      setAtlasStats(computeAtlasStats(userDiscoveries));
      setAtlasPoints(buildAtlasPoints(userDiscoveries));

      // Show victory modal for first newly conquered zone
      if (newlyConquered.length > 0) {
        const [firstZid] = newlyConquered[0];
        setConquestZone({ zone_id: firstZid, userScore: newScores[firstZid] || 0 });
      }

      // Detect takeable zones
      const takeableCount = Object.entries(leaderMap).filter(([zid, l]) =>
        l.user_email !== user.email && (newScores[zid] || 0) > l.species_count
      ).length;
      if (takeableCount > 0) {
        setNotifications(n => [...n, { id: Date.now() + 2, type: "takeable", msg: `${takeableCount} secteur${takeableCount > 1 ? "s prêts" : " prêt"} à être enrichi${takeableCount > 1 ? "s" : ""}` }]);
      }

      // Detect zones where user leads but someone is close (gap ≤ 2)
      const threatenedZones = Object.entries(leaderMap).filter(([zid, l]) => {
        if (l.user_email !== user.email) return false;
        // We can't know rivals' scores here, but if leader score is low, warn
        // A real signal would require all user scores — approximate by checking close challengers
        return false; // placeholder — triggered via separate per-zone check below
      }).length;
      // Better: check owned zones where userScore is low (potential vulnerability)
      const ownedLowScore = Object.entries(leaderMap).filter(([zid, l]) =>
        l.user_email === user.email && (newScores[zid] || l.species_count) <= 3
      ).length;
      if (ownedLowScore > 0 && newlyConquered.length === 0) {
        // Don't spam — only when syncing manually
      }
    } else {
      setUserScores(newScores);
      setAtlasStats(emptyAtlasStats());
      setAtlasPoints([]);
    }

    if (targetZoneId && zoneIds.includes(targetZoneId)) {
      setSelectedZone({
        zone_id: targetZoneId,
        leader: leaderMap[targetZoneId] || null,
        userScore: newScores[targetZoneId] || 0,
        activity: activityMap[targetZoneId] || emptyZoneActivity(),
      });
    }

    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const displayName = resolveDisplayName({
        displayName: userDisplayName,
        fullName: user.user_metadata?.full_name,
        email: user.email,
      });
      const { data: discoveries } = await supabase
        .from('plant_discoveries')
        .select('latitude,longitude,common_name,scientific_name')
        .eq('user_email', user.email);
      const zoneMap = computeUserZoneScores(discoveries || []);
      for (const [zone_id, speciesCount] of Object.entries(zoneMap)) {
        await supabase.from('zone_leaders').upsert({
          zone_id, user_email: user.email, display_name: displayName,
          species_count: speciesCount, last_updated: new Date().toISOString(),
        }, { onConflict: 'zone_id' });
      }
      setSyncMsg(`${Object.keys(zoneMap).length} secteurs mis à jour`);
    } catch (e) {
      console.error('[handleSync]', e.message);
    }
    setSyncing(false);
    await loadData();
    setTimeout(() => setSyncMsg(null), 3000);
  };

  const handleZoneTap = useCallback((zone_id) => {
    const leader = leaders[zone_id] || null;
    const userScore = userScores[zone_id] || 0;
    setSelectedZone({
      zone_id,
      leader,
      userScore,
      activity: zoneActivity[zone_id] || emptyZoneActivity(),
    });
  }, [leaders, userScores, zoneActivity]);

  // Pan handling
  const handlePointerDown = (e) => {
    dragStart.current = { x: e.clientX - dragged.x, y: e.clientY - dragged.y };
  };
  const handlePointerMove = (e) => {
    if (!dragStart.current) return;
    setDragged({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handlePointerUp = () => { dragStart.current = null; };

  if (locationError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--v1v-bg)" }}>
        <div className="text-center">
          <MapPin className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--v1v-blue)" }} />
          <p className="text-base font-black uppercase tracking-wider mb-2" style={{ color: "var(--v1v-fg)" }}>
            Localisation requise
          </p>
          <p className="text-xs" style={{ color: "var(--v1v-fg-muted)" }}>
            Activez la géolocalisation pour accéder à la carte du vivant.
          </p>
        </div>
      </div>
    );
  }

  if (!userLocation || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--v1v-bg)" }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3" style={{ borderColor: "var(--v1v-blue)", borderTopColor: "transparent" }} />
          <p className="text-[9px] font-black uppercase tracking-[0.5em]" style={{ color: "rgba(43,107,232,0.5)" }}>
            Lecture du territoire...
          </p>
        </div>
      </div>
    );
  }

  const originLat = userLocation.lat;
  const originLng = userLocation.lng;
  const zoneIds = getSurroundingZoneIds(originLat, originLng, GRID_RADIUS);
  const userZoneId = getZoneId(originLat, originLng);

  // Grid dimensions
  const total = GRID_RADIUS * 2 + 1;
  const gridPx = total * PX_PER_ZONE;
  const baseZLat = Math.floor(originLat / ZONE_DEG);
  const baseZLng = Math.floor(originLng / ZONE_DEG);
  const gridOriginLat = (baseZLat + GRID_RADIUS + 1) * ZONE_DEG; // top of grid
  const gridOriginLng = (baseZLng - GRID_RADIUS) * ZONE_DEG;     // left of grid

  // Stats
  const myZones = Object.values(leaders).filter(l => l.user_email === userEmail).length;
  const totalZones = Object.keys(leaders).length;
  const isAtlasMode = mapMode === "atlas";

  // Tension score: conquerable > close (1-3 gap) > others
  const tensionScore = (zone_id) => {
    const leader = leaders[zone_id];
    if (!leader || leader.user_email === userEmail) return 0;
    const uScore = userScores[zone_id] || 0;
    if (uScore > leader.species_count) return 1000;
    const gap = leader.species_count - uScore;
    if (gap <= 3) return 100 - gap;
    return 0;
  };

  const dismissNotif = (id) => setNotifications(n => n.filter(x => x.id !== id));

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Header — Atlas */}
      <div
        className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{
          background: "linear-gradient(180deg, rgba(18,23,18,0.97) 0%, rgba(14,19,14,0.92) 100%)",
          borderBottom: "1px solid rgba(125,160,90,0.12)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-fg-faint)" }}>Atlas du vivant</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center w-8 h-8 transition-opacity"
            style={{ opacity: syncing ? 0.5 : 1 }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} style={{ color: "var(--v1v-fg-faint)" }} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { id: "local", label: "Local", sub: "agir maintenant" },
            { id: "atlas", label: "Atlas", sub: `${atlasStats.sectorCount} secteurs` },
          ].map((item) => {
            const active = mapMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMapMode(item.id)}
                className="rounded-2xl px-3 py-2 text-left transition-all active:scale-[0.98]"
                style={{
                  background: active ? "rgba(237,240,230,0.075)" : "rgba(237,240,230,0.028)",
                  border: `1px solid ${active ? "rgba(237,240,230,0.16)" : "rgba(237,240,230,0.055)"}`,
                  color: active ? "var(--v1v-fg)" : "var(--v1v-fg-muted)",
                }}
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.22em]">{item.label}</span>
                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--v1v-fg-faint)" }}>
                  {item.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>



      {/* Grid Map — Visible grid + zones */}
      <div
        className="relative overflow-hidden"
        style={{
          height: "calc(100vh - 128px - env(safe-area-inset-bottom))",
          cursor: isAtlasMode ? "default" : "grab",
          userSelect: "none",
          background: isAtlasMode
            ? "radial-gradient(circle at 50% 38%, rgba(59,125,232,0.085) 0%, rgba(13,17,13,0) 34%), radial-gradient(circle at 50% 52%, rgba(54,211,122,0.045) 0%, rgba(13,17,13,0) 52%), linear-gradient(180deg, rgba(9,13,12,0.76) 0%, rgba(5,8,7,0.56) 100%)"
            : "radial-gradient(circle at 50% 47%, rgba(54,211,122,0.055) 0%, rgba(13,17,13,0) 28%), radial-gradient(circle at 52% 48%, rgba(59,125,232,0.032) 0%, rgba(13,17,13,0) 46%), linear-gradient(180deg, rgba(14,18,15,0.62) 0%, rgba(7,10,8,0.42) 100%)",
        }}
        onPointerDown={isAtlasMode ? undefined : handlePointerDown}
        onPointerMove={isAtlasMode ? undefined : handlePointerMove}
        onPointerUp={isAtlasMode ? undefined : handlePointerUp}
        onPointerLeave={isAtlasMode ? undefined : handlePointerUp}
      >
        {isAtlasMode && (
          <AtlasWorldMap
            points={atlasPoints}
            view={atlasView}
            onViewChange={setAtlasView}
            stats={atlasStats}
          />
        )}

        {/* Grid background */}
        {!isAtlasMode && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: 0.06 }}
            width="100%"
            height="100%"
          >
            <defs>
              <pattern id="gridlines" width={PX_PER_ZONE} height={PX_PER_ZONE} patternUnits="userSpaceOnUse">
                <path d={`M ${PX_PER_ZONE} 0 L 0 0 0 ${PX_PER_ZONE}`} fill="none" stroke="rgba(174,255,188,0.42)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridlines)" />
          </svg>
        )}

        {/* Zones draggable container */}
        {!isAtlasMode && <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${dragged.x}px), calc(-50% + ${dragged.y}px)) scale(${isAtlasMode ? 0.86 : 1})`,
            width: gridPx,
            height: gridPx,
            opacity: isAtlasMode ? 0.74 : 1,
            transition: "opacity 0.28s ease, transform 0.28s ease",
          }}
        >
          {[...zoneIds].sort((a, b) => tensionScore(b) - tensionScore(a)).map(zone_id => {
            const leader = leaders[zone_id];
            const uScore = userScores[zone_id] || 0;
            const activity = zoneActivity[zone_id] || emptyZoneActivity();
            const isOwned = leader?.user_email === userEmail;
            const isFree = !leader;
            const isUser = zone_id === userZoneId;
            const isSelected = selectedZone?.zone_id === zone_id;
            const leaderScore = leader?.species_count || 0;
            const isOpenable = !isOwned && ((leader && uScore > leaderScore) || (isFree && uScore > 0));
            const isDocumented = Boolean(leader) || activity.observationCount > 0 || activity.speciesCount > 0;
            const isPotential = !isOwned && (
              isOpenable
              || (!isDocumented && (isUser || getZonePotential(zone_id)))
              || (leader && uScore > 0 && leaderScore - uScore <= 3)
            );
            const cellState = getCellState({ isOwned, isDocumented, isPotential });
            const visual = CELL_VISUALS[cellState];

            const [zLat, zLng] = zone_id.split("_").map(Number);
            const dLat = baseZLat + GRID_RADIUS - zLat;
            const dLng = zLng - (baseZLng - GRID_RADIUS);
            const x = dLng * PX_PER_ZONE;
            const y = dLat * PX_PER_ZONE;
            const background = isSelected
              ? `radial-gradient(circle at 50% 48%, rgba(237,240,230,0.09), transparent 62%), ${visual.background}`
              : visual.background;
            const baseGlow = visual.glow === "none" ? "" : visual.glow;
            const selectedGlow = isSelected ? "0 0 0 1px rgba(237,240,230,0.44), 0 0 20px rgba(237,240,230,0.09)" : "";
            const userGlow = isUser && !isOwned ? "0 0 0 1px rgba(54,211,122,0.56), 0 0 30px rgba(54,211,122,0.24)" : "";
            const boxShadow = [baseGlow, selectedGlow, userGlow].filter(Boolean).join(", ") || "none";
            const borderWidth = isOwned || isUser || isSelected ? 1.5 : 1;

            return (
              <button
                key={zone_id}
                onClick={() => handleZoneTap(zone_id)}
                style={{
                  position: "absolute",
                  left: x + 1,
                  top: y + 1,
                  width: PX_PER_ZONE - 2,
                  height: PX_PER_ZONE - 2,
                  background,
                  border: `${borderWidth}px solid ${isSelected ? "rgba(237,240,230,0.86)" : visual.border}`,
                  borderRadius: cellState === "neutral" ? 10 : 12,
                  boxShadow: boxShadow,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  padding: 2,
                  overflow: "visible",
                  transition: "transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease, background 0.24s ease",
                  transform: isSelected ? "scale(1.03)" : "scale(1)",
                  cursor: "pointer",
                }}
              >
                {visual.pulse && (
                  <div
                    className="absolute -inset-[5px] pointer-events-none"
                    style={{
                      border: `1px solid ${visual.border}`,
                      borderRadius: 15,
                      boxShadow: baseGlow || `0 0 18px ${visual.border}`,
                      animation: `${visual.pulse} 2.8s ease-in-out infinite`,
                    }}
                  />
                )}
                <div
                  className="absolute inset-[7px] pointer-events-none"
                  style={{
                    border: `1px solid ${cellState === "neutral" ? "rgba(237,240,230,0.026)" : visual.border}`,
                    borderRadius: 8,
                    opacity: cellState === "neutral" ? 0.16 : 0.28,
                  }}
                />
                {cellState !== "neutral" && (
                  <div
                    className="absolute left-1/2 top-1/2 pointer-events-none"
                    style={{
                      width: cellState === "mastered" ? 17 : cellState === "documented" ? 8 : 7,
                      height: cellState === "mastered" ? 17 : cellState === "documented" ? 8 : 7,
                      borderRadius: cellState === "mastered" ? 6 : 999,
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      background: cellState === "documented" ? "transparent" : visual.marker,
                      border: `1px solid ${visual.marker}`,
                      boxShadow: cellState === "mastered" ? "0 0 16px rgba(255,218,120,0.32)" : "none",
                      opacity: cellState === "potential" ? 0.5 : 0.86,
                    }}
                  />
                )}
                {isOwned && cellState === "mastered" && (
                  <>
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: -10,
                        right: -9,
                        animation: "guardianSealFloat 2.4s ease-in-out infinite",
                        zIndex: 3,
                      }}
                    >
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: isSelected
                            ? "radial-gradient(circle, rgba(255,245,206,0.98) 0%, rgba(255,218,120,0.9) 58%, rgba(232,198,108,0.86) 100%)"
                            : "radial-gradient(circle, rgba(255,245,206,0.94) 0%, rgba(255,218,120,0.78) 58%, rgba(232,198,108,0.72) 100%)",
                          border: "1px solid rgba(255,245,206,0.92)",
                          boxShadow: isSelected
                            ? "0 0 24px rgba(255,218,120,0.5), 0 4px 14px rgba(0,0,0,0.35)"
                            : "0 0 17px rgba(232,198,108,0.36), 0 4px 12px rgba(0,0,0,0.28)",
                          opacity: 1,
                        }}
                      >
                        <Compass style={{ width: 12, height: 12, color: "#241800" }} />
                      </div>
                    </div>
                  </>
                )}
                {isUser && (
                  <div
                    className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full"
                    style={{
                      background: cellState === "mastered" ? "rgba(255,218,120,0.95)" : "rgba(54,211,122,0.95)",
                      border: "1px solid rgba(237,240,230,0.78)",
                      boxShadow: cellState === "mastered" ? "0 0 12px rgba(255,218,120,0.6)" : "0 0 12px rgba(54,211,122,0.62)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>}

        {/* User position anchor */}
        {!isAtlasMode && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            className="relative flex h-32 w-32 items-center justify-center"
            style={{
              filter: "drop-shadow(0 0 26px rgba(54,211,122,0.24))",
            }}
          >
            <div className="absolute h-px w-24" style={{ background: "linear-gradient(90deg, transparent, rgba(174,255,188,0.28), transparent)" }} />
            <div className="absolute h-24 w-px" style={{ background: "linear-gradient(180deg, transparent, rgba(174,255,188,0.24), transparent)" }} />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "1px solid rgba(54,211,122,0.18)",
                animation: "userAnchorPulse 3.6s ease-in-out infinite",
              }}
            />
            <div
              className="absolute h-16 w-16 rounded-full"
              style={{
                border: "1px solid rgba(59,125,232,0.22)",
                background: "radial-gradient(circle, rgba(54,211,122,0.075), transparent 68%)",
              }}
            />
            <div
              className="relative h-4 w-4 rounded-full"
              style={{
                background: "rgba(54,211,122,0.96)",
                border: "1px solid rgba(230,255,238,0.92)",
                boxShadow: "0 0 0 8px rgba(54,211,122,0.085), 0 0 28px rgba(54,211,122,0.46)",
              }}
            />
          </div>
        </div>}
      </div>

      {/* HUD — Bottom cockpit */}
      <MapHUD
        currentZone={selectedZone}
        userEmail={userEmail}
        userZoneId={userZoneId}
        leaders={leaders}
        userScores={userScores}
        zoneActivity={zoneActivity}
        mode={mapMode}
        atlasStats={atlasStats}
        atlasView={atlasView}
      />

      <ZoneDetailPanel
        zone={selectedZone}
        onClose={() => setSelectedZone(null)}
        userEmail={userEmail}
        onConquest={(zone) => setChampionZone(zone)}
      />
      <ConquestVictoryModal
        zone={conquestZone}
        userDisplayName={userDisplayName}
        onClose={() => setConquestZone(null)}
      />
      <ChampionCelebration
        zone={championZone}
        onClose={() => setChampionZone(null)}
      />
      <style>{`
        @keyframes masteredPresencePulse {
          0%, 100% { opacity: 0.42; transform: scale(0.985); }
          50% { opacity: 0.88; transform: scale(1.035); }
        }
        @keyframes guardianSealFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes userAnchorPulse {
          0%, 100% { opacity: 0.34; transform: scale(0.78); }
          50% { opacity: 0.84; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
