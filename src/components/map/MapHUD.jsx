import { Compass, Crosshair } from "lucide-react";
import { useZoneLabel } from "@/lib/locationMeta";
import { useNavigate } from "react-router-dom";

function getHeldDays(leader, zoneId) {
  if (leader?.last_updated) {
    const days = Math.max(1, Math.ceil((Date.now() - new Date(leader.last_updated).getTime()) / 86400000));
    return Number.isFinite(days) ? days : 1;
  }

  const seed = String(zoneId || "zone").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (seed % 9) + 2;
}

function emptyActivity() {
  return {
    observationCount: 0,
    speciesCount: 0,
    explorerCount: 0,
  };
}

function plural(value, singular, pluralLabel = `${singular}s`) {
  return `${value} ${value > 1 ? pluralLabel : singular}`;
}

export default function MapHUD({
  currentZone,
  userEmail,
  userZoneId,
  leaders,
  userScores,
  zoneActivity = {},
  mode = "local",
  atlasStats = null,
  atlasView = "world",
}) {
  const navigate = useNavigate();
  const isAtlasMode = mode === "atlas";
  const zone = currentZone || (userZoneId ? { zone_id: userZoneId } : null);
  const { label: zoneName } = useZoneLabel(zone?.zone_id);
  const leader = zone ? leaders[zone.zone_id] : null;
  const userScore = zone ? (userScores[zone.zone_id] || 0) : 0;
  const isOwned = leader?.user_email === userEmail;
  const isLocalZone = zone?.zone_id === userZoneId;
  const leaderScore = leader?.species_count || 0;
  const gapToReference = leader ? Math.max(1, leaderScore + 1 - userScore) : 1;
  const heldDays = isOwned ? getHeldDays(leader, zone?.zone_id) : 0;
  const rawActivity = zone?.activity || (zone?.zone_id ? zoneActivity[zone.zone_id] : null) || emptyActivity();
  const activity = {
    observationCount: Math.max(rawActivity.observationCount || 0, userScore),
    speciesCount: Math.max(rawActivity.speciesCount || 0, leaderScore, userScore),
    explorerCount: Math.max(rawActivity.explorerCount || 0, leader ? 1 : 0, userScore > 0 ? 1 : 0),
  };
  const hasReference = Boolean(leader);
  const hasTraces = activity.observationCount > 0 || activity.speciesCount > 0;
  const hasSeveralExplorers = activity.explorerCount > 1;
  const atlas = atlasStats || {
    observationCount: 0,
    speciesCount: 0,
    sectorCount: 0,
    macroAreaCount: 0,
    topZoneScore: 0,
  };
  const tone = isOwned
    ? {
        accent: "rgba(255,218,120,0.96)",
        soft: "rgba(232,198,108,0.115)",
        border: "rgba(255,218,120,0.28)",
        text: "rgba(255,241,195,0.94)",
      }
    : hasReference
      ? {
          accent: "rgba(111,180,232,0.92)",
          soft: "rgba(59,125,232,0.1)",
          border: "rgba(111,180,232,0.2)",
          text: "rgba(194,224,255,0.88)",
        }
      : hasTraces
        ? {
          accent: "rgba(174,255,188,0.86)",
          soft: "rgba(54,211,122,0.08)",
          border: "rgba(174,255,188,0.16)",
          text: "rgba(222,255,232,0.84)",
        }
        : {
          accent: "rgba(174,255,188,0.86)",
          soft: "rgba(237,240,230,0.045)",
          border: "rgba(237,240,230,0.1)",
          text: "rgba(237,240,230,0.62)",
        };
  const statusLabel = isOwned
    ? "Présence maîtrisée"
    : hasReference ? "Secteur documenté" : hasTraces ? "Repère en émergence" : "Lieu à initier";
  const mainMessage = isOwned
    ? hasSeveralExplorers
        ? `${plural(activity.explorerCount, "présence")} recensée${activity.explorerCount > 1 ? "s" : ""}. Tu portes la référence locale.`
        : `${heldDays} jour${heldDays > 1 ? "s" : ""} continus. ${plural(activity.speciesCount, "espèce")} fiable${activity.speciesCount > 1 ? "s" : ""}.`
    : hasReference
      ? hasSeveralExplorers
        ? `${plural(activity.explorerCount, "présence")} déjà recensée${activity.explorerCount > 1 ? "s" : ""}. ${plural(gapToReference, "observation")} pour approcher la référence.`
        : `${plural(activity.speciesCount, "espèce")} déjà documentée${activity.speciesCount > 1 ? "s" : ""} ici.`
      : hasTraces
        ? `Ce lieu commence à révéler des traces: ${plural(activity.observationCount, "observation")} déjà posée${activity.observationCount > 1 ? "s" : ""}.`
        : "Aucune trace fiable pour l’instant.";
  const opportunity = isOwned
    ? "Prolonge ta présence avec une observation fiable."
    : hasReference ? "Observe sur place pour enrichir ce secteur." : hasTraces ? "Transforme ces traces en repère stable." : "Initie ce lieu par une observation claire.";
  const progressPercent = isOwned
    ? Math.min(100, Math.max(48, ((leaderScore + heldDays) / Math.max(leaderScore + heldDays + 1, 1)) * 100))
    : hasReference
      ? Math.min(100, Math.max(8, (userScore / Math.max(leaderScore + 1, 1)) * 100))
      : hasTraces ? Math.min(76, Math.max(22, activity.observationCount * 18)) : 6;
  const metricValue = isOwned ? heldDays : hasReference ? gapToReference : activity.observationCount;
  const metricLabel = isOwned ? "jours" : hasReference ? "à faire" : "traces";
  const handleScan = () => {
    navigate("/?openCamera=true");
  };

  if (isAtlasMode) {
    const atlasProgress = Math.min(100, Math.max(8, atlas.sectorCount * 12 + atlas.macroAreaCount * 8));
    const viewLabel = atlasView === "europe" ? "Europe" : atlasView === "traces" ? "Mes traces" : "Monde";
    return (
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 px-4 pb-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div
          className="relative p-4"
          style={{
            background: "radial-gradient(circle at 16% 0%, rgba(59,125,232,0.12) 0%, rgba(8,14,8,0) 44%), linear-gradient(145deg, rgba(5,9,8,0.96), rgba(10,14,12,0.92))",
            border: "1px solid rgba(132,196,230,0.18)",
            borderRadius: 28,
            backdropFilter: "blur(16px)",
            boxShadow: "0 -14px 42px rgba(0,0,0,0.48), inset 0 0 26px rgba(59,125,232,0.07)",
            overflow: "hidden",
          }}
        >
          <div className="relative">
            <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(237,240,230,0.34)" }}>
              {viewLabel} · zoom libre
            </p>
            <p className="mt-1 text-[22px] font-black uppercase leading-tight" style={{ color: "rgba(194,224,255,0.94)" }}>
              Atlas vivant
            </p>
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "rgba(222,238,255,0.78)" }}>
              {atlas.sectorCount > 0
                ? `${plural(atlas.speciesCount, "espèce")} cartographiée${atlas.speciesCount > 1 ? "s" : ""}, visible${atlas.speciesCount > 1 ? "s" : ""} à l’échelle du monde.`
                : "Chaque observation fiable ouvrira une première trace sur ton atlas."}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { value: atlas.sectorCount, label: "secteurs" },
                { value: atlas.speciesCount, label: "espèces" },
                { value: atlas.observationCount, label: "observations" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl px-3 py-3"
                  style={{
                    background: "rgba(237,240,230,0.035)",
                    border: "1px solid rgba(237,240,230,0.065)",
                  }}
                >
                  <p className="text-xl font-black number-display leading-none" style={{ color: "rgba(194,224,255,0.94)" }}>
                    {item.value}
                  </p>
                  <p className="mt-1 text-[7px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(237,240,230,0.34)" }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div style={{ height: 3, background: "rgba(255,255,255,0.055)", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${atlasProgress}%`,
                    background: "linear-gradient(90deg, rgba(132,196,230,0.92), rgba(174,255,188,0.72))",
                    boxShadow: "0 0 16px rgba(132,196,230,0.38)",
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleScan}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 font-black uppercase tracking-[0.15em] text-xs transition-all active:scale-[0.97]"
              style={{
                background: "rgba(194,224,255,0.94)",
                color: "var(--v1v-bg)",
                borderRadius: 16,
                boxShadow: "0 10px 24px rgba(59,125,232,0.12)",
              }}
            >
              <Crosshair className="w-4 h-4" />
              Ajouter une trace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 px-4 pb-4"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      {/* HUD Panel */}
      <div
        className="relative p-4"
        style={{
          background: `radial-gradient(circle at 16% 0%, ${tone.soft} 0%, rgba(8,14,8,0) 44%), linear-gradient(145deg, rgba(5,9,7,0.96), rgba(10,14,11,0.92))`,
          border: `1px solid ${tone.border}`,
          borderRadius: 28,
          backdropFilter: "blur(16px)",
          boxShadow: `0 -14px 42px rgba(0,0,0,0.48), inset 0 0 26px ${tone.soft}`,
          overflow: "hidden",
        }}
      >
        <div
          className="absolute -right-12 -top-14 h-36 w-36 rounded-full"
          style={{ background: tone.soft, filter: "blur(22px)", opacity: 0.72 }}
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(237,240,230,0.34)" }}>
                {isLocalZone ? "Autour de toi" : "Secteur sélectionné"}
              </p>
              <p className="mt-1 text-[21px] font-black uppercase leading-tight" style={{ color: tone.accent }}>
                {zone ? (zoneName || zone.zone_id) : "Lieu proche"}
              </p>
            </div>
            <div
              className="shrink-0 text-right"
              aria-label={`${metricValue} ${metricLabel}`}
            >
              <p className="text-2xl font-black number-display leading-none" style={{ color: tone.accent }}>
                {metricValue}
              </p>
              <p className="mt-1 text-[7px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(237,240,230,0.34)" }}>
                {metricLabel}
              </p>
            </div>
          </div>

          <div
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2"
            style={{
              background: tone.soft,
              border: `1px solid ${tone.border}`,
              borderRadius: 999,
            }}
          >
            <Compass className="h-3.5 w-3.5" style={{ color: tone.accent }} />
            <span className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: tone.accent }}>
              {statusLabel}
            </span>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: tone.text }}>
            {mainMessage}
          </p>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(237,240,230,0.34)" }}>
                Présence
              </span>
              <span className="text-[10px] font-black" style={{ color: tone.accent }}>
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,0.055)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg, ${tone.accent}, rgba(237,240,230,0.78))`,
                  boxShadow: `0 0 16px ${tone.accent}`,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>

          <p
            className="mt-4 rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-[0.15em]"
            style={{ color: tone.text, background: tone.soft, border: `1px solid ${tone.border}` }}
          >
            {opportunity}
          </p>

          <button
            onClick={handleScan}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 font-black uppercase tracking-[0.15em] text-xs transition-all active:scale-[0.97]"
            style={{
              background: tone.accent,
              color: "var(--v1v-bg)",
              borderRadius: 16,
              boxShadow: `0 10px 24px ${tone.soft}`,
            }}
          >
            <Crosshair className="w-4 h-4" />
            Observer ici
          </button>
        </div>
      </div>
    </div>
  );
}
