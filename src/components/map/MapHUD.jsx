import { Compass, Crosshair } from "lucide-react";
import { useZoneLabel } from "@/lib/locationMeta";
import { useNavigate } from "react-router-dom";

export default function MapHUD({ currentZone, userEmail, userZoneId, leaders, userScores }) {
  const navigate = useNavigate();
  const zone = currentZone || (userZoneId ? { zone_id: userZoneId } : null);
  const { label: zoneName } = useZoneLabel(zone?.zone_id);
  const leader = zone ? leaders[zone.zone_id] : null;
  const userScore = zone ? (userScores[zone.zone_id] || 0) : 0;
  const isOwned = leader?.user_email === userEmail;
  const isLocalZone = zone?.zone_id === userZoneId;

  const handleScan = () => {
    navigate("/?openCamera=true");
  };

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 px-4 pb-4"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      {/* HUD Panel */}
      <div
        className="relative p-4"
        style={{
          background: "rgba(8,14,8,0.85)",
          border: "1px solid rgba(46,168,15,0.2)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4), inset 0 0 20px rgba(46,168,15,0.04)",
        }}
      >
        {/* Corner accents */}
        <div
          className="absolute top-1 left-1 w-2 h-2"
          style={{ border: "1px solid rgba(46,168,15,0.35)" }}
        />
        <div
          className="absolute top-1 right-1 w-2 h-2"
          style={{ border: "1px solid rgba(46,168,15,0.35)" }}
        />
        <div
          className="absolute bottom-1 left-1 w-2 h-2"
          style={{ border: "1px solid rgba(46,168,15,0.35)" }}
        />
        <div
          className="absolute bottom-1 right-1 w-2 h-2"
          style={{ border: "1px solid rgba(46,168,15,0.35)" }}
        />

        {/* Content grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Zone Info */}
          <div className="flex flex-col gap-1">
            <p className="text-[7px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-faint)" }}>
              {isLocalZone ? "Zone locale" : "Zone observée"}
            </p>
            {zone ? (
              <p className="text-[10px] font-black uppercase leading-tight" style={{ color: "var(--v1v-green)" }}>
                {zoneName || zone.zone_id}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--v1v-fg-faint)" }}>—</p>
            )}
          </div>

          {/* Leader Status */}
          <div className="flex flex-col gap-1">
            <p className="text-[7px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-faint)" }}>
              Référence
            </p>
            {isOwned ? (
              <div className="flex items-center gap-1">
                <Compass className="w-3 h-3" style={{ color: "var(--v1v-amber)" }} />
                <span className="text-xs font-black" style={{ color: "var(--v1v-amber)" }}>Vous</span>
              </div>
            ) : leader ? (
              <p className="text-xs font-black truncate" style={{ color: "var(--v1v-fg)" }}>
                {leader.display_name.slice(0, 8)}
              </p>
            ) : (
              <p className="text-xs font-black" style={{ color: "var(--v1v-blue)" }}>À initier</p>
            )}
          </div>

          {/* Score */}
          <div className="flex flex-col gap-1 text-right">
            <p className="text-[7px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-faint)" }}>
              Observations
            </p>
            <p className="text-lg font-black number-display" style={{ color: "var(--v1v-green)" }}>
              {userScore}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {zone && leader && (
          <div className="mb-4">
            <div
              style={{
                height: 2,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (userScore / (leader.species_count + 1)) * 100)}%`,
                  background: userScore > leader.species_count ? "var(--v1v-green)" : "var(--v1v-fg-muted)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Scan button */}
        <button
          onClick={handleScan}
          className="w-full flex items-center justify-center gap-2 py-3.5 font-black uppercase tracking-[0.15em] text-xs transition-all active:scale-[0.97]"
          style={{
            background: "var(--v1v-green)",
            color: "var(--v1v-bg)",
            boxShadow: "0 4px 16px rgba(46,168,15,0.3)",
          }}
        >
          <Crosshair className="w-4 h-4" />
          Observer
        </button>
      </div>
    </div>
  );
}
