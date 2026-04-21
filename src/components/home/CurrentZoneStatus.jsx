import { Compass, MapPin, Sparkles } from "lucide-react";
import { useCurrentZoneData } from "@/hooks/useCurrentZoneData";

const G = "var(--v1v-green)";
const GOLD = "var(--v1v-earth)";
const BLUE = "var(--v1v-blue)";

export default function CurrentZoneStatus({ userEmail, lat, lng, discoveries = [], zoneData = null }) {
  const fallbackZoneData = useCurrentZoneData({
    userEmail,
    discoveries,
    geoCoords: lat != null && lng != null ? { lat, lng } : null,
    active: !zoneData,
  });
  const data = zoneData || fallbackZoneData;
  const {
    zoneId,
    zoneName,
    leader,
    loading,
    error,
    localSpeciesCount: userSpecies,
    isLeader,
    noLeader,
    zoneTarget: targetScore,
    canDocumentNow: canContributeDecisively,
    zoneProgress: progressPct,
  } = data;

  if (!zoneId) return null;

  if (loading) {
    return (
      <div
        className="v1v-surface-card-soft p-4 mt-2 text-xs"
        style={{
          background: "rgba(45,122,31,0.06)",
          border: "1px solid rgba(45,122,31,0.16)",
        }}
      >
        <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(57,184,20,0.45)" }}>
          Lecture du repère local…
        </p>
      </div>
    );
  }

  if (error && !leader) {
    return (
      <div
        className="v1v-surface-card-soft p-4 mt-2 text-xs"
        style={{
          background: "rgba(21,101,192,0.08)",
          border: "1px solid rgba(21,101,192,0.18)",
        }}
      >
        <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: BLUE }}>
          Lecture locale en pause
        </p>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
          Ton score local est prêt. Le statut de la zone revient dès que la connexion se stabilise.
        </p>
      </div>
    );
  }

  const gap = leader ? Math.max(1, leader.species_count + 1 - userSpecies) : 1;
  const tone = isLeader ? GOLD : canContributeDecisively ? G : noLeader ? BLUE : G;
  const statusTitle = isLeader
    ? "Référent local"
    : canContributeDecisively
      ? "Contribution clé"
      : noLeader
        ? "Zone à ouvrir"
        : "Contribution en cours";
  const mission = isLeader
    ? "Ajoute une espèce locale pour consolider la qualité documentaire de cette zone."
    : canContributeDecisively
      ? "Tu as déjà ce qu'il faut. Ouvre la carte et enregistre une observation utile ici."
      : noLeader
        ? "Une seule espèce unique ici suffit pour ouvrir la documentation locale."
        : `Encore ${gap} espèce${gap > 1 ? "s" : ""} unique${gap > 1 ? "s" : ""} pour rejoindre la référence devant ${leader.display_name}.`;

  return (
      <div
      className="v1v-surface-card p-4 mt-2 text-xs"
      style={{
        background: isLeader ? "var(--v1v-earth-bg)" : noLeader ? "var(--v1v-blue-bg)" : "var(--v1v-green-bg)",
        border: `1px solid ${isLeader ? "var(--v1v-earth-border)" : noLeader ? "var(--v1v-blue-border)" : "var(--v1v-green-ghost)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: tone }}>
            Repere terrain
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: tone }}>
            {statusTitle}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: tone }}>
          {isLeader ? <Compass className="w-3 h-3" /> : noLeader ? <Sparkles className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
          {zoneName || zoneId}
        </div>
      </div>

      <p className="mb-2 leading-relaxed" style={{ color: "rgba(226,234,224,0.78)" }}>
        {mission}
      </p>

      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,234,224,0.45)" }}>
          Progression locale
        </p>
        <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: tone }}>
          {userSpecies}/{targetScore}
        </p>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: tone }} />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2" style={{ color: "rgba(226,234,224,0.72)" }}>
        <div>
          <p className="text-[7px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,234,224,0.4)" }}>
            Référence
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: tone }}>
            {noLeader ? "À ouvrir" : leader.display_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[7px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,234,224,0.4)" }}>
            Dynamique
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: tone }}>
            {isLeader ? "Stable" : canContributeDecisively ? "Prête" : noLeader ? "Ouverte" : `-${gap}`}
          </p>
        </div>
      </div>
    </div>
  );
}
