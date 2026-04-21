import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Compass, Shield, Target } from "lucide-react";
import { useCurrentZoneData } from "@/hooks/useCurrentZoneData";
import { useZoneLabel } from "@/lib/locationMeta";
import { createPageUrl } from "@/utils";
import { getZoneCenter, getZoneId } from "@/lib/zones";

const SNAPSHOT_PREFIX = "w1ld-terrain-snapshot-v1";

function zoneLink(zoneId) {
  const center = getZoneCenter(zoneId);
  if (!center) return createPageUrl("TerritorialMap");
  return `${createPageUrl("TerritorialMap")}?lat=${center.lat}&lng=${center.lng}&zoneId=${encodeURIComponent(zoneId)}`;
}

export default function TerrainAlertDeck({ userEmail, geoCoords, discoveries = [], zoneData = null }) {
  const [eventState, setEventState] = useState({ lostZones: [], gainedZones: [] });
  const fallbackZoneData = useCurrentZoneData({
    userEmail,
    discoveries,
    geoCoords,
    active: !zoneData && discoveries.length > 0,
    nearbyRadius: 3,
  });
  const data = zoneData || fallbackZoneData;
  const leadersByZone = data.leadersByZone || {};
  const currentZoneId = data.zoneId || getZoneId(geoCoords?.lat, geoCoords?.lng);
  const terrainSignals = data.terrainSignals || {
    readyTargets: [],
    pressureTargets: [],
    fragileOwnedZones: [],
    freeZonesCount: 0,
  };
  const readyTargets = terrainSignals.readyTargets || [];
  const pressureTargets = terrainSignals.pressureTargets || [];
  const fragileOwnedZones = terrainSignals.fragileOwnedZones || [];
  const freeZonesCount = terrainSignals.freeZonesCount || 0;

  useEffect(() => {
    if (!userEmail || !currentZoneId) return;

    const originZoneId = currentZoneId;
    const snapshotKey = `${SNAPSHOT_PREFIX}:${userEmail}`;
    const ownedZones = Object.entries(leadersByZone)
      .filter(([, leader]) => leader?.user_email === userEmail)
      .map(([zoneId]) => zoneId)
      .sort();

    try {
      const raw = localStorage.getItem(snapshotKey);
      if (raw) {
        const previous = JSON.parse(raw);
        if (previous?.originZoneId === originZoneId) {
          const prevOwned = previous.ownedZones || [];
          const lostZones = prevOwned.filter((zoneId) => !ownedZones.includes(zoneId));
          const gainedZones = ownedZones.filter((zoneId) => !prevOwned.includes(zoneId));
          setEventState({ lostZones, gainedZones });
        } else {
          setEventState({ lostZones: [], gainedZones: [] });
        }
      } else {
        setEventState({ lostZones: [], gainedZones: [] });
      }

      localStorage.setItem(snapshotKey, JSON.stringify({
        originZoneId,
        ownedZones,
        updatedAt: Date.now(),
      }));
    } catch {
      setEventState({ lostZones: [], gainedZones: [] });
    }
  }, [currentZoneId, leadersByZone, userEmail]);

  const lostZone = eventState.lostZones[0] || null;
  const gainedZone = eventState.gainedZones[0] || null;
  const readyTarget = readyTargets[0] || null;
  const pressureTarget = pressureTargets[0] || null;
  const fragileZone = fragileOwnedZones[0] || null;
  const { label: lostZoneLabel } = useZoneLabel(lostZone);
  const { label: gainedZoneLabel } = useZoneLabel(gainedZone);
  const { label: readyTargetLabel } = useZoneLabel(readyTarget?.zoneId);
  const { label: pressureTargetLabel } = useZoneLabel(pressureTarget?.zoneId);
  const { label: fragileZoneLabel } = useZoneLabel(fragileZone?.zoneId);

  if (!userEmail || !geoCoords || discoveries.length === 0 || !currentZoneId) return null;
  if (data.loading && !Object.keys(leadersByZone).length) return null;

  let primaryAlert = null;

  if (lostZone) {
    primaryAlert = {
      tone: "var(--v1v-coral)",
      icon: AlertTriangle,
      badge: "Repère perdu",
      title: `Référence déplacée : ${lostZoneLabel || lostZone}`,
      description: "Un autre observateur est devenu la référence locale ici. Ouvre la carte et vois comment enrichir à nouveau cette zone.",
      link: zoneLink(lostZone),
      metricLabel: "Action",
      metricValue: "À revoir",
    };
  } else if (readyTarget) {
    primaryAlert = {
      tone: readyTarget.free ? "var(--v1v-blue)" : "var(--v1v-green)",
      icon: readyTarget.free ? Target : Compass,
      badge: readyTarget.free ? "Zone à initier" : "Contribution décisive",
      title: readyTarget.free
        ? `Première trace : ${readyTargetLabel || readyTarget.zoneId}`
        : `Repère accessible : ${readyTargetLabel || readyTarget.zoneId}`,
      description: readyTarget.free
        ? "Aucune référence locale n'existe encore ici. Tu as déjà le minimum pour lancer la documentation."
        : `Tu as déjà le score pour dépasser ${readyTarget.leaderName}. Passe sur la carte et enregistre une observation clé.`,
      link: zoneLink(readyTarget.zoneId),
      metricLabel: "Score",
      metricValue: readyTarget.userScore,
    };
  } else if (pressureTarget) {
    primaryAlert = {
      tone: "var(--v1v-earth)",
      icon: Target,
      badge: "Progression locale",
      title: `Zone à enrichir : ${pressureTargetLabel || pressureTarget.zoneId}`,
      description: `Encore ${pressureTarget.gap} espèce${pressureTarget.gap > 1 ? "s" : ""} pour devenir le référent devant ${pressureTarget.leaderName}.`,
      link: zoneLink(pressureTarget.zoneId),
      metricLabel: "Manque",
      metricValue: `-${pressureTarget.gap}`,
    };
  } else if (fragileZone) {
    primaryAlert = {
      tone: "var(--v1v-earth)",
      icon: Shield,
      badge: "Zone à consolider",
      title: `Zone à renforcer : ${fragileZoneLabel || fragileZone.zoneId}`,
      description: "Cette zone reste encore légère. Une observation de plus y rendra ta contribution beaucoup plus solide.",
      link: zoneLink(fragileZone.zoneId),
      metricLabel: "Profondeur",
      metricValue: fragileZone.score,
    };
  } else if (gainedZone) {
    primaryAlert = {
      tone: "var(--v1v-green)",
      icon: Compass,
      badge: "Nouvelle référence",
      title: `Zone documentée : ${gainedZoneLabel || gainedZone}`,
      description: "Ta progression a bien été consolidée. Tu peux partager cette note de terrain ou poursuivre vers une autre zone proche.",
      link: zoneLink(gainedZone),
      metricLabel: "Impact",
      metricValue: "+1",
    };
  }

  if (!primaryAlert) return null;

  const secondaryStats = [
    { label: "Prêtes", value: readyTargets.length, tone: "var(--v1v-green)" },
    { label: "À enrichir", value: pressureTargets.length, tone: "var(--v1v-earth)" },
    { label: "À initier", value: freeZonesCount, tone: "var(--v1v-blue)" },
  ];

  const Icon = primaryAlert.icon;

  return (
    <div className="px-5 py-1">
      <div
        className="v1v-surface-card p-4"
        style={{
          background: "var(--v1v-bg-overlay-heavy)",
          border: `1px solid ${primaryAlert.tone}33`,
          boxShadow: `0 0 28px rgba(0,0,0,0.18)`,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" style={{ color: primaryAlert.tone }} />
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.32em]" style={{ color: "var(--v1v-fg-faint)" }}>
                Repères du terrain
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: primaryAlert.tone }}>
                {primaryAlert.badge}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={{ color: "var(--v1v-fg-faint)" }}>
              {primaryAlert.metricLabel}
            </p>
            <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: primaryAlert.tone }}>
              {primaryAlert.metricValue}
            </p>
          </div>
        </div>

        <p className="text-sm font-black uppercase tracking-[0.08em] leading-tight mb-1.5" style={{ color: "var(--v1v-fg)" }}>
          {primaryAlert.title}
        </p>
        <p className="text-[10px] leading-relaxed mb-3" style={{ color: "var(--v1v-fg-muted)" }}>
          {primaryAlert.description}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {secondaryStats.map((item) => (
            <div
              key={item.label}
              className="px-2.5 py-2 rounded-[12px]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-[7px] font-black uppercase tracking-[0.24em] mb-1" style={{ color: "var(--v1v-fg-faint)" }}>
                {item.label}
              </p>
              <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: item.tone }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <Link to={primaryAlert.link} className="block">
          <button
            className="v1v-button-secondary w-full flex items-center justify-center gap-2"
            style={{
              background: "rgba(255,255,255,0.04)",
            }}
          >
            Ouvrir la carte
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}
