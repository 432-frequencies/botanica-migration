import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/api/supabaseClient";
import { Compass, RefreshCw, MapPin } from "lucide-react";
import ZoneDetailPanel from "@/components/map/ZoneDetailPanel";
import ConquestVictoryModal from "@/components/map/ConquestVictoryModal";
import ChampionCelebration from "@/components/map/ChampionCelebration";
import MapHUD from "@/components/map/MapHUD";
import { resolveDisplayName } from "@/lib/displayName";

const ZONE_DEG = 0.0045; // ~500m par carré

function getZoneId(lat, lng) {
  return `${Math.floor(lat / ZONE_DEG)}_${Math.floor(lng / ZONE_DEG)}`;
}

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

// Compute zones around a center point (radius in zone units)
function getSurroundingZoneIds(lat, lng, radiusZones = 5) {
  const baseZLat = Math.floor(lat / ZONE_DEG);
  const baseZLng = Math.floor(lng / ZONE_DEG);
  const zones = [];
  for (let dLat = -radiusZones; dLat <= radiusZones; dLat++) {
    for (let dLng = -radiusZones; dLng <= radiusZones; dLng++) {
      zones.push(`${baseZLat + dLat}_${baseZLng + dLng}`);
    }
  }
  return zones;
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

// Compute user score per zone from discoveries
function computeUserZoneScores(discoveries) {
  const map = {};
  for (const d of discoveries) {
    if (!d.latitude || !d.longitude || !d.common_name) continue;
    const zid = getZoneId(d.latitude, d.longitude);
    if (!map[zid]) map[zid] = new Set();
    map[zid].add(d.common_name.toLowerCase().trim());
  }
  const result = {};
  for (const [zid, set] of Object.entries(map)) result[zid] = set.size;
  return result;
}

const PX_PER_ZONE = 72; // pixel size of each zone cell
const GRID_RADIUS = 5;   // zones to show in each direction

export default function TerritorialMap() {
  // Extract target coordinates from URL query params
  const params = new URLSearchParams(window.location.search);
  const targetLat = params.get('lat') ? parseFloat(params.get('lat')) : null;
  const targetLng = params.get('lng') ? parseFloat(params.get('lng')) : null;
  const targetZoneId = params.get('zoneId') || null;

  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [leaders, setLeaders] = useState({});   // zone_id → ZoneLeader record
  const [userScores, setUserScores] = useState({}); // zone_id → int
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
  }, [targetLat, targetLng]);

  useEffect(() => {
    if (!userLocation) return;
    loadData();
  }, [userLocation]);

  useEffect(() => {
    if (!targetZoneId) return;
    const targetLeader = leaders[targetZoneId] || null;
    const targetScore = userScores[targetZoneId] || 0;
    setSelectedZone({
      zone_id: targetZoneId,
      leader: targetLeader,
      userScore: targetScore,
    });
  }, [targetZoneId, leaders, userScores]);

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
    const { data: allLeaders } = await supabase.from('zone_leaders').select('*').order('species_count', { ascending: false }).limit(500);
    const leaderMap = {};
    for (const l of (allLeaders || [])) {
      if (zoneIds.includes(l.zone_id)) leaderMap[l.zone_id] = l;
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
      setNotifications(n => [...n, { id: Date.now() + 1, type: "lost", msg: `${lostZones.length} zone${lostZones.length > 1 ? "s ont" : " a"} changé de référence` }]);
    }
    prevLeadersRef.current = leaderMap;
    setLeaders(leaderMap);

    // Load user discoveries to compute scores locally
    let newScores = {};
    if (user) {
      const { data: discoveries } = await supabase.from('plant_discoveries').select('*').eq('user_email', user.email);
      newScores = computeUserZoneScores(discoveries);
      setUserScores(newScores);

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
        setNotifications(n => [...n, { id: Date.now() + 2, type: "takeable", msg: `${takeableCount} zone${takeableCount > 1 ? "s peuvent" : " peut"} être enrichie${takeableCount > 1 ? "s" : ""}` }]);
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
    }

    if (targetZoneId && zoneIds.includes(targetZoneId)) {
      setSelectedZone({
        zone_id: targetZoneId,
        leader: leaderMap[targetZoneId] || null,
        userScore: newScores[targetZoneId] || 0,
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
      const { data: discoveries } = await supabase.from('plant_discoveries').select('*').eq('user_email', user.email);
      // Recompute zone scores from discoveries
      const zoneMap = {};
      for (const d of (discoveries || [])) {
        if (!d.latitude || !d.longitude || !d.common_name) continue;
        const zid = `${Math.floor(d.latitude / ZONE_DEG)}_${Math.floor(d.longitude / ZONE_DEG)}`;
        if (!zoneMap[zid]) zoneMap[zid] = new Set();
        zoneMap[zid].add(d.common_name.toLowerCase());
      }
      for (const [zone_id, speciesSet] of Object.entries(zoneMap)) {
        await supabase.from('zone_leaders').upsert({
          zone_id, user_email: user.email, display_name: displayName,
          species_count: speciesSet.size, last_updated: new Date().toISOString(),
        }, { onConflict: 'zone_id' });
      }
      setSyncMsg(`${Object.keys(zoneMap).length} zones mises à jour`);
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
    setSelectedZone({ zone_id, leader, userScore });
  }, [leaders, userScores]);

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
            Chargement du terrain...
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

      {/* Header — Minimal */}
      <div
        className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{ background: "var(--v1v-bg-overlay-heavy)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-fg-faint)" }}>Carte du vivant</p>
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
      </div>



      {/* Grid Map — Visible grid + zones */}
      <div
        className="relative overflow-hidden"
        style={{ height: "calc(100vh - 140px - env(safe-area-inset-bottom))", cursor: "grab", userSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Grid background */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.06 }}
          width="100%"
          height="100%"
        >
          <defs>
            <pattern id="gridlines" width={PX_PER_ZONE} height={PX_PER_ZONE} patternUnits="userSpaceOnUse">
              <path d={`M ${PX_PER_ZONE} 0 L 0 0 0 ${PX_PER_ZONE}`} fill="none" stroke="#2EA80F" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridlines)" />
        </svg>

        {/* Zones draggable container */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${dragged.x}px), calc(-50% + ${dragged.y}px))`,
            width: gridPx,
            height: gridPx,
          }}
        >
          {[...zoneIds].sort((a, b) => tensionScore(b) - tensionScore(a)).map(zone_id => {
            const leader = leaders[zone_id];
            const uScore = userScores[zone_id] || 0;
            const isOwned = leader?.user_email === userEmail;
            const isConquerable = !isOwned && leader && uScore > leader.species_count;
            const isFree = !leader;
            const isUser = zone_id === userZoneId;
            const isSelected = selectedZone?.zone_id === zone_id;

            const [zLat, zLng] = zone_id.split("_").map(Number);
            const dLat = baseZLat + GRID_RADIUS - zLat;
            const dLng = zLng - (baseZLng - GRID_RADIUS);
            const x = dLng * PX_PER_ZONE;
            const y = dLat * PX_PER_ZONE;

            let bg, border, boxShadow;
            if (isOwned) {
              // Zone documentée : présence dorée chaleureuse
              bg = isSelected
                ? "linear-gradient(145deg, rgba(196,154,10,0.6) 0%, rgba(255,215,0,0.28) 45%, rgba(120,78,0,0.2) 100%)"
                : "linear-gradient(145deg, rgba(196,154,10,0.42) 0%, rgba(255,215,0,0.2) 45%, rgba(120,78,0,0.16) 100%)";
              border = isSelected ? "rgba(255,215,0,0.95)" : "rgba(196,154,10,0.82)";
              boxShadow = isSelected
                ? "0 0 0 1px rgba(255,215,0,0.55), 0 0 28px rgba(255,215,0,0.52), inset 0 0 34px rgba(255,215,0,0.18)"
                : "0 0 20px rgba(196,154,10,0.5), inset 0 0 28px rgba(255,215,0,0.12)";
            } else if (isConquerable) {
              bg = "rgba(46,168,15,0.14)";
              border = "rgba(46,168,15,0.45)";
              boxShadow = "0 0 8px rgba(46,168,15,0.2)";
            } else if (isFree) {
              bg = "rgba(59,125,232,0.08)";
              border = "rgba(59,125,232,0.25)";
              boxShadow = "none";
            } else {
              bg = "rgba(226,234,224,0.04)";
              border = "rgba(226,234,224,0.12)";
              boxShadow = "none";
            }
            if (isUser) {
              border = isOwned ? "rgba(196,154,10,0.9)" : "rgba(59,125,232,0.75)";
              boxShadow = isOwned ? "0 0 16px rgba(196,154,10,0.6), inset 0 0 24px rgba(255,215,0,0.15)" : "0 0 12px rgba(59,125,232,0.4)";
            }
            if (isSelected && !isOwned) {
              border = isConquerable ? "rgba(46,168,15,0.85)" : isFree ? "rgba(59,125,232,0.8)" : "rgba(255,255,255,0.4)";
              boxShadow = isConquerable
                ? "0 0 18px rgba(46,168,15,0.35), inset 0 0 18px rgba(46,168,15,0.08)"
                : isFree
                ? "0 0 18px rgba(59,125,232,0.3), inset 0 0 18px rgba(59,125,232,0.08)"
                : "0 0 12px rgba(255,255,255,0.12)";
            }

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
                  background: bg,
                  border: `${isOwned ? 3 : isUser ? 2 : 1}px solid ${border}`,
                  boxShadow: boxShadow,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  padding: 2,
                  overflow: "visible",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
              >
                {isOwned && (
                  <>
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: -14,
                        left: "50%",
                        transform: "translateX(-50%)",
                        animation: "championCrownFloat 2.2s ease-in-out infinite",
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
                            ? "radial-gradient(circle, rgba(255,245,190,0.98) 0%, rgba(255,215,0,0.92) 55%, rgba(196,154,10,0.96) 100%)"
                            : "radial-gradient(circle, rgba(255,237,160,0.96) 0%, rgba(255,215,0,0.86) 55%, rgba(196,154,10,0.9) 100%)",
                          border: "1px solid rgba(255,240,170,0.95)",
                          boxShadow: isSelected
                            ? "0 0 22px rgba(255,215,0,0.6), 0 4px 14px rgba(0,0,0,0.35)"
                            : "0 0 16px rgba(255,215,0,0.45), 0 4px 12px rgba(0,0,0,0.28)",
                        }}
                      >
                        <Compass style={{ width: 12, height: 12, color: "#5F4100" }} />
                      </div>
                    </div>
                    <div
                      className="absolute -inset-[4px] pointer-events-none"
                      style={{
                        border: `2px solid ${isSelected ? "rgba(255,235,150,0.95)" : "rgba(255,215,0,0.58)"}`,
                        boxShadow: "0 0 18px rgba(255,215,0,0.28)",
                        animation: "ownedZonePulse 2.4s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="absolute inset-[3px] pointer-events-none"
                      style={{
                        border: `1px solid ${isSelected ? "rgba(255,235,150,0.7)" : "rgba(255,235,150,0.35)"}`,
                        boxShadow: isSelected ? "inset 0 0 18px rgba(255,235,150,0.16)" : "none",
                      }}
                    />
                    <div
                      className="absolute top-1 left-1 px-1.5 py-[1px] text-[6px] font-black tracking-[0.18em]"
                      style={{
                        background: "rgba(255,215,0,0.14)",
                        color: "rgba(255,235,150,0.95)",
                        border: "1px solid rgba(255,215,0,0.28)",
                        textTransform: "uppercase",
                      }}
                    >
                      REPERE
                    </div>
                  </>
                )}
                {isUser && (
                  <div
                    className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full"
                    style={{ background: isOwned ? "var(--v1v-amber)" : "var(--v1v-blue)" }}
                  />
                )}
                {leader && (
                  <>
                    <span className="font-black text-center leading-none" style={{ fontSize: 8, color: isOwned ? "var(--v1v-amber)" : "var(--v1v-fg-muted)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {leader.display_name.slice(0, 6)}
                    </span>
                    <span className="font-black number-display" style={{ fontSize: 11, color: isOwned ? "var(--v1v-amber)" : "var(--v1v-fg)" }}>
                      {leader.species_count}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Center marker */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: "transparent",
              border: "2px solid rgba(59,125,232,0.6)",
              boxShadow: "0 0 0 1px rgba(59,125,232,0.3), 0 0 8px rgba(59,125,232,0.4)",
            }}
          />
        </div>
      </div>

      {/* HUD — Bottom cockpit */}
      <MapHUD
        currentZone={selectedZone}
        userEmail={userEmail}
        userZoneId={userZoneId}
        leaders={leaders}
        userScores={userScores}
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
        @keyframes ownedZonePulse {
          0%, 100% { opacity: 0.45; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes championCrownFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
