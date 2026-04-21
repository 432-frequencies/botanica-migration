import { useEffect, useState } from "react";
import { MapPin, BadgeCheck, Target } from "lucide-react";
import { useCurrentZoneData } from "@/hooks/useCurrentZoneData";

const G = "var(--v1v-blue)";
const GDB = "var(--v1v-blue-bg)";
const BLUE_FAINT = "var(--v1v-fg-faint)";
const EARTH = "var(--v1v-earth)";
const EARTH_BG = "var(--v1v-earth-bg)";
const EARTH_BORDER = "var(--v1v-earth-border)";

export default function ZoneCard({ userEmail, displayName, discoveries, isActive = true }) {
  const [geoCoords, setGeoCoords] = useState(null);
  const [locationState, setLocationState] = useState("loading");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationState("granted");
        setLoading(false);
      },
      () => {
        setLocationState("denied");
        setLoading(false);
      },
      { timeout: 6000 }
    );
  }, [isActive]);

  const zoneData = useCurrentZoneData({
    userEmail,
    discoveries,
    geoCoords,
    active: isActive && locationState === "granted",
  });

  if (loading || zoneData.loading) return (
    <div className="p-4" style={{ border: "1px solid var(--v1v-blue-border)", background: GDB }}>
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 animate-pulse" style={{ color: G }} />
        <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: BLUE_FAINT }}>
           Lecture de zone…
        </span>
      </div>
    </div>
  );

  if (locationState === "denied") {
    return (
      <div className="p-4" style={{ border: "1px solid var(--v1v-blue-border)", background: GDB }}>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4" style={{ color: G }} />
          <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: BLUE_FAINT }}>
             Zone locale masquée
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
          Active la localisation pour voir le repère le plus proche et comment ta présence terrain le fait évoluer.
        </p>
      </div>
    );
  }

  if (zoneData.error && !zoneData.zoneId) return null;

  const zone = {
    zone_id: zoneData.zoneId,
    leader: zoneData.leader?.display_name || null,
    leaderSpecies: zoneData.leader?.species_count || 0,
    userSpecies: zoneData.localSpeciesCount || 0,
    isLeader: zoneData.isLeader,
  };

  if (!zone.zone_id) return null;

  const noLeader = !zone.leader;
  const canConquer = !zone.isLeader && zone.userSpecies > zone.leaderSpecies;
  const gap = zone.leaderSpecies - zone.userSpecies;
  const isClose = !zone.isLeader && !noLeader && gap > 0 && gap <= 3;
  const isNear = !zone.isLeader && !noLeader && !isClose && !canConquer && gap > 3 && gap <= 5;
  const progressPct = zone.leaderSpecies > 0
    ? Math.min(100, Math.round((zone.userSpecies / zone.leaderSpecies) * 100))
    : 100;
  const zoneName = zoneData.zoneName;

  return (
    <div className="p-4" style={{ border: `1px solid ${zone.isLeader ? EARTH_BORDER : "var(--v1v-blue-border)"}`, background: zone.isLeader ? EARTH_BG : GDB }}>

      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-3.5 h-3.5" style={{ color: zone.isLeader ? EARTH : G }} />
        <span className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: zone.isLeader ? EARTH : BLUE_FAINT }}>
           Zone proche
        </span>
        {zone.isLeader && (
          <span className="ml-auto flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.3em] px-2 py-0.5"
            style={{ background: EARTH_BG, color: EARTH, border: `1px solid ${EARTH_BORDER}` }}>
            <BadgeCheck className="w-2.5 h-2.5" /> Référent local
          </span>
        )}
      </div>

      {noLeader ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-2" style={{ color: BLUE_FAINT }}>
            {zoneName || zone.zone_id}
          </p>
          <p className="text-base font-black uppercase tracking-wider mb-1" style={{ color: G }}>
            Zone à documenter
          </p>
          <p className="text-xs" style={{ color: BLUE_FAINT }}>
            Quelques observations utiles suffisent pour ouvrir cette référence locale
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
                {zone.isLeader ? "Vous documentez" : "Référent local"}
              </p>
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: zone.isLeader ? EARTH : "var(--v1v-fg)" }}>
                {zone.isLeader ? displayName : zone.leader}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: zone.isLeader ? EARTH : G }}>
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
                  Prochain repère : {zone.leaderSpecies + 1}
                </span>
              </div>
              <div className="h-0.5 w-full" style={{ background: "var(--v1v-blue-border)" }}>
                <div
                  className="h-0.5 transition-all duration-700"
                  style={{ width: `${progressPct}%`, background: canConquer ? "var(--v1v-amber)" : G }}
                />
              </div>
              {canConquer && (
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1.5" style={{ color: "var(--v1v-amber)" }}>
                  Une observation utile ici peut faire évoluer la référence locale
                </p>
              )}
              {isClose && (
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1.5" style={{ color: "var(--v1v-green)" }}>
                  Encore {gap} espèce{gap > 1 ? "s" : ""} pour rejoindre le niveau de référence
                </p>
              )}
              {isNear && (
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mt-1.5" style={{ color: EARTH }}>
                  Cette zone peut vite gagner en profondeur avec quelques relevés ciblés
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
