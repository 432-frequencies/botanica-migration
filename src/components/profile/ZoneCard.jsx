import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useZoneLabel } from "@/lib/locationMeta";
import { MapPin, Crown, Target } from "lucide-react";

const G = "var(--v1v-blue)";
const GDB = "var(--v1v-blue-bg)";
const BLUE_FAINT = "rgba(43,107,232,0.45)";

// 500m grid — 0.0045° ≈ 500m latitude
function getZoneId(lat, lng) {
  return `${Math.floor(lat / 0.0045)}_${Math.floor(lng / 0.0045)}`;
}

export default function ZoneCard({ userEmail, displayName, discoveries }) {
  const [zone, setZone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const { label: zoneName } = useZoneLabel(zone?.zone_id);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setHasLocation(true);
        loadZone(pos.coords.latitude, pos.coords.longitude);
      },
      () => setLoading(false),
      { timeout: 6000 }
    );
  }, []);

  const loadZone = async (lat, lng) => {
    setLoading(true);
    const zone_id = getZoneId(lat, lng);

    // Count unique species for current user in this zone
    const userSpecies = new Set(
      discoveries
        .filter(d => d.latitude && d.longitude && getZoneId(d.latitude, d.longitude) === zone_id)
        .map(d => (d.common_name || "").toLowerCase())
    ).size;

    const { data } = await supabase.from('zone_leaders').select('*').eq('zone_id', zone_id).limit(1);
    const leader = data?.[0] || null;

    setZone({
      zone_id,
      leader: leader?.display_name || null,
      leaderSpecies: leader?.species_count || 0,
      userSpecies,
      isLeader: leader?.user_email === userEmail,
    });
    setLoading(false);
  };

  if (!hasLocation && !loading) return null;

  if (loading) return (
    <div className="p-4" style={{ border: "1px solid var(--v1v-blue-border)", background: GDB }}>
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 animate-pulse" style={{ color: G }} />
        <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: BLUE_FAINT }}>
           Détection de zone…
        </span>
      </div>
    </div>
  );

  if (!zone) return null;

  const noLeader = !zone.leader;
  const canConquer = !zone.isLeader && zone.userSpecies > zone.leaderSpecies;
  const gap = zone.leaderSpecies - zone.userSpecies;
  const isClose = !zone.isLeader && !noLeader && gap > 0 && gap <= 3;
  const isNear = !zone.isLeader && !noLeader && !isClose && !canConquer && gap > 3 && gap <= 5;
  const progressPct = zone.leaderSpecies > 0
    ? Math.min(100, Math.round((zone.userSpecies / zone.leaderSpecies) * 100))
    : 100;

  return (
    <div className="p-4" style={{ border: `1px solid ${zone.isLeader ? "rgba(200,150,10,0.5)" : "var(--v1v-blue-border)"}`, background: zone.isLeader ? "rgba(200,150,10,0.06)" : GDB }}>

      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-3.5 h-3.5" style={{ color: zone.isLeader ? "#C8960A" : G }} />
        <span className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: zone.isLeader ? "rgba(200,150,10,0.7)" : BLUE_FAINT }}>
           Zone actuelle
        </span>
        {zone.isLeader && (
          <span className="ml-auto flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.3em] px-2 py-0.5"
            style={{ background: "rgba(200,150,10,0.15)", color: "#C8960A", border: "1px solid rgba(200,150,10,0.4)" }}>
            <Crown className="w-2.5 h-2.5" /> Référence
          </span>
        )}
      </div>

      {noLeader ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-2" style={{ color: BLUE_FAINT }}>
            {zoneName || zone.zone_id}
          </p>
          <p className="text-base font-black uppercase tracking-wider mb-1" style={{ color: G }}>
            Zone à initier
          </p>
          <p className="text-xs" style={{ color: BLUE_FAINT }}>
            Observe des espèces ici pour lancer la documentation locale
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1" style={{ color: BLUE_FAINT }}>
                {zoneName || zone.zone_id}
              </p>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ color: BLUE_FAINT }}>
                {zone.isLeader ? "Vous documentez" : "Référence"}
              </p>
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: zone.isLeader ? "#C8960A" : "var(--v1v-fg)" }}>
                {zone.isLeader ? displayName : zone.leader}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: zone.isLeader ? "#C8960A" : G }}>
                {zone.isLeader ? zone.userSpecies : zone.leaderSpecies}
              </p>
              <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: BLUE_FAINT }}>espèces</p>
            </div>
          </div>

          {!zone.isLeader && (
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: BLUE_FAINT }}>
                  <Target className="w-2.5 h-2.5" /> Vous : {zone.userSpecies}
                </span>
                <span className="text-[8px] uppercase tracking-widest" style={{ color: BLUE_FAINT }}>
                  Objectif : {zone.leaderSpecies + 1}
                </span>
              </div>
              <div className="h-0.5 w-full" style={{ background: "rgba(43,107,232,0.15)" }}>
                <div
                  className="h-0.5 transition-all duration-700"
                  style={{ width: `${progressPct}%`, background: canConquer ? "#C8960A" : G }}
                />
              </div>
              {canConquer && (
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1.5" style={{ color: "#C8960A" }}>
                  ★ Référence accessible — une espèce ici peut faire évoluer la zone
                </p>
              )}
              {isClose && (
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1.5" style={{ color: "var(--v1v-green)" }}>
                  ⚡ Tu es à {gap} espèce{gap > 1 ? "s" : ""} de la référence
                </p>
              )}
              {isNear && (
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1.5" style={{ color: "var(--v1v-amber)" }}>
                  🎯 Tu es à {gap} espèces de la référence
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
