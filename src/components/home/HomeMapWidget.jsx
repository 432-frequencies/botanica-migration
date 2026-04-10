import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { Crown, MapPin, Zap, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ConquestVictoryModal from "@/components/map/ConquestVictoryModal";

const ZONE_DEG = 0.0045;
const PX = 56;
const RADIUS = 3;

function getZoneId(lat, lng) {
  return `${Math.floor(lat / ZONE_DEG)}_${Math.floor(lng / ZONE_DEG)}`;
}

function getSurroundingZoneIds(lat, lng, r) {
  const bLat = Math.floor(lat / ZONE_DEG);
  const bLng = Math.floor(lng / ZONE_DEG);
  const zones = [];
  for (let dLat = -r; dLat <= r; dLat++)
    for (let dLng = -r; dLng <= r; dLng++)
      zones.push(`${bLat + dLat}_${bLng + dLng}`);
  return zones;
}

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

export default function HomeMapWidget({ userEmail, userDisplayName }) {
  const [location, setLocation] = useState(null);
  const [leaders, setLeaders] = useState({});
  const [userScores, setUserScores] = useState({});
  const [conquestZone, setConquestZone] = useState(null);
  const prevLeadersRef = useRef({});
  const [dragged, setDragged] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (!location || !userEmail) return;
    loadZoneData();
  }, [location, userEmail]);

  const loadZoneData = async () => {
    const zoneIds = getSurroundingZoneIds(location.lat, location.lng, RADIUS);
    const { data: allLeaders } = await supabase.from('zone_leaders').select('*').order('species_count', { ascending: false }).limit(500);
    const leaderMap = {};
    for (const l of (allLeaders || [])) {
      if (zoneIds.includes(l.zone_id)) leaderMap[l.zone_id] = l;
    }

    // Detect conquests
    const prevMap = prevLeadersRef.current;
    const newlyConquered = Object.entries(leaderMap).filter(([zid, cur]) =>
      cur.user_email === userEmail && (!prevMap[zid] || prevMap[zid].user_email !== userEmail)
    );

    prevLeadersRef.current = leaderMap;
    setLeaders(leaderMap);

    const { data: discoveries } = await supabase.from('plant_discoveries').select('*').eq('user_email', userEmail);
    const scores = computeUserZoneScores(discoveries);
    setUserScores(scores);

    if (newlyConquered.length > 0 && Object.keys(prevMap).length > 0) {
      const [firstZid] = newlyConquered[0];
      setConquestZone({ zone_id: firstZid, userScore: scores[firstZid] || 0 });
    }
  };

  const handlePointerDown = (e) => { dragStart.current = { x: e.clientX - dragged.x, y: e.clientY - dragged.y }; };
  const handlePointerMove = (e) => {
    if (!dragStart.current) return;
    setDragged({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handlePointerUp = () => { dragStart.current = null; };

  if (!location) {
    return (
      <div className="flex items-center justify-center py-12" style={{ background: "var(--v1v-blue-bg)", border: "1px solid var(--v1v-blue-border)" }}>
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 animate-pulse" style={{ color: "var(--v1v-blue)" }} />
          <span className="text-[9px] font-black uppercase tracking-[0.5em]" style={{ color: "rgba(43,107,232,0.5)" }}>Localisation…</span>
        </div>
      </div>
    );
  }

  const zoneIds = getSurroundingZoneIds(location.lat, location.lng, RADIUS);
  const userZoneId = getZoneId(location.lat, location.lng);
  const total = RADIUS * 2 + 1;
  const gridPx = total * PX;
  const baseZLat = Math.floor(location.lat / ZONE_DEG);
  const baseZLng = Math.floor(location.lng / ZONE_DEG);
  const myZones = Object.values(leaders).filter(l => l.user_email === userEmail).length;

  // Tension targets (gap ≤ 5)
  const targets = zoneIds
    .map(zid => {
      const leader = leaders[zid];
      if (!leader || leader.user_email === userEmail) return null;
      const uScore = userScores[zid] || 0;
      const conquerable = uScore > leader.species_count;
      const gap = leader.species_count - uScore;
      if (!conquerable && gap > 5) return null;
      return { zid, leader, uScore, gap: conquerable ? 0 : gap, conquerable };
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 3);

  return (
    <>
      {/* Map header */}
      <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: "1px solid var(--v1v-blue-border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--v1v-blue)", boxShadow: "0 0 6px var(--v1v-blue)" }} />
          <span className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: "rgba(43,107,232,0.6)" }}>Territoire</span>
        </div>
        <div className="flex items-center gap-3">
          {myZones > 0 && (
            <div className="flex items-center gap-1.5">
              <Crown className="w-3 h-3" style={{ color: "var(--v1v-amber)" }} />
              <span className="text-xs font-black number-display" style={{ color: "var(--v1v-amber)" }}>{myZones}</span>
              <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: "rgba(200,150,10,0.5)" }}>zones</span>
            </div>
          )}
          <Link to={createPageUrl("TerritorialMap")} className="text-[7px] font-black uppercase tracking-wider px-2.5 py-1.5" style={{ border: "1px solid var(--v1v-blue-border)", color: "var(--v1v-blue)" }}>
            Voir tout →
          </Link>
        </div>
      </div>

      {/* Grid map */}
      <div
        className="relative overflow-hidden"
        style={{ height: "44vw", maxHeight: 260, cursor: "grab", userSelect: "none", background: "var(--v1v-bg)" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(calc(-50% + ${dragged.x}px), calc(-50% + ${dragged.y}px))`,
          width: gridPx, height: gridPx,
        }}>
          {zoneIds.map(zone_id => {
            const leader = leaders[zone_id];
            const uScore = userScores[zone_id] || 0;
            const isOwned = leader?.user_email === userEmail;
            const isConquerable = !isOwned && leader && uScore > leader.species_count;
            const gap = leader && !isOwned ? leader.species_count - uScore : Infinity;
            const isClose = !isConquerable && !isOwned && leader && gap > 0 && gap <= 3;
            const isNear = !isConquerable && !isClose && !isOwned && leader && gap > 3 && gap <= 5;
            const isFree = !leader;
            const isUser = zone_id === userZoneId;

            const [zLat, zLng] = zone_id.split("_").map(Number);
            const x = (zLng - (baseZLng - RADIUS)) * PX;
            const y = (baseZLat + RADIUS - zLat) * PX;

            let bg, border, labelColor;
            if (isOwned) { bg = "rgba(200,150,10,0.18)"; border = "rgba(200,150,10,0.6)"; labelColor = "var(--v1v-amber)"; }
            else if (isConquerable) { bg = "rgba(57,184,20,0.12)"; border = "rgba(57,184,20,0.5)"; labelColor = "var(--v1v-green)"; }
            else if (isNear) { bg = "rgba(200,150,10,0.06)"; border = "rgba(200,150,10,0.35)"; labelColor = "rgba(200,150,10,0.8)"; }
            else if (isFree) { bg = "rgba(43,107,232,0.07)"; border = "rgba(43,107,232,0.2)"; labelColor = "rgba(43,107,232,0.6)"; }
            else { bg = "rgba(220,80,80,0.08)"; border = "rgba(220,80,80,0.3)"; labelColor = "rgba(220,100,100,0.8)"; }
            if (isUser) border = isOwned ? "rgba(200,150,10,0.95)" : "rgba(43,107,232,0.9)";

            return (
              <div
                key={zone_id}
                style={{
                  position: "absolute", left: x, top: y,
                  width: PX - 1, height: PX - 1,
                  background: bg, border: `${isUser ? 2 : 1}px solid ${border}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 3,
                }}
              >
                {isClose && <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full animate-pulse" style={{ background: "var(--v1v-green)" }} />}
                {isUser && <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: isOwned ? "var(--v1v-amber)" : "var(--v1v-blue)" }} />}
                {isOwned && <Crown style={{ width: 8, height: 8, color: "var(--v1v-amber)" }} />}
                {leader ? (
                  <>
                    <span style={{ fontSize: 7, color: labelColor, fontWeight: 900, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase" }}>
                      {leader.display_name.length > 6 ? leader.display_name.slice(0, 5) + "…" : leader.display_name}
                    </span>
                    <span style={{ fontSize: 11, color: labelColor, fontWeight: 900, fontFamily: "'Bebas Neue', sans-serif" }}>{leader.species_count}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 6, color: labelColor, fontWeight: 900 }}>LIBRE</span>
                )}
              </div>
            );
          })}
        </div>
        {/* You are here */}
        <div className="absolute pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "white", boxShadow: "0 0 0 3px rgba(43,107,232,0.8), 0 0 10px rgba(43,107,232,0.5)" }} />
        </div>
      </div>

      {/* Tension targets */}
      {targets.length > 0 && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid var(--v1v-blue-border)", background: "var(--v1v-bg-overlay)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
            <span className="text-[8px] font-black uppercase tracking-[0.4em]" style={{ color: "rgba(57,184,20,0.6)" }}>Objectifs à portée</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${targets.length}, 1fr)` }}>
            {targets.map(({ zid, leader, uScore, gap, conquerable }) => (
              <div key={zid} className="px-2.5 py-2 flex flex-col gap-1"
                style={{ background: conquerable ? "rgba(57,184,20,0.08)" : "rgba(200,150,10,0.07)", border: `1px solid ${conquerable ? "rgba(57,184,20,0.35)" : "rgba(200,150,10,0.25)"}` }}>
                <div className="flex items-center gap-1">
                  {conquerable
                    ? <Crown className="w-2.5 h-2.5" style={{ color: "var(--v1v-green)" }} />
                    : <Target className="w-2.5 h-2.5" style={{ color: "var(--v1v-amber)" }} />}
                  <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: conquerable ? "var(--v1v-green)" : "var(--v1v-amber)" }}>
                    {conquerable ? "Prenable" : `−${gap} esp.`}
                  </span>
                </div>
                <span className="text-[8px] font-black uppercase leading-tight" style={{ color: "var(--v1v-fg-muted)" }}>
                  {leader.display_name.length > 8 ? leader.display_name.slice(0, 7) + "…" : leader.display_name}
                </span>
                <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-0.5" style={{
                    width: `${Math.min(100, leader.species_count > 0 ? Math.round((uScore / (leader.species_count + 1)) * 100) : 100)}%`,
                    background: conquerable ? "var(--v1v-green)" : "var(--v1v-amber)",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConquestVictoryModal
        zone={conquestZone}
        userDisplayName={userDisplayName}
        onClose={() => setConquestZone(null)}
      />
    </>
  );
}