import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Compass, Shield, Target } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { useZoneLabel } from "@/lib/locationMeta";
import { createPageUrl } from "@/utils";
import { computeUserZoneScores, getSurroundingZoneIds, getZoneCenter, getZoneId } from "@/lib/zones";

const SNAPSHOT_PREFIX = "w1ld-terrain-snapshot-v1";

function zoneLink(zoneId) {
  const center = getZoneCenter(zoneId);
  if (!center) return createPageUrl("TerritorialMap");
  return `${createPageUrl("TerritorialMap")}?lat=${center.lat}&lng=${center.lng}&zoneId=${encodeURIComponent(zoneId)}`;
}

function countNearbyFreeZones(zoneIds, leadersByZone) {
  return zoneIds.filter((zoneId) => !leadersByZone[zoneId]).length;
}

export default function TerrainAlertDeck({ userEmail, geoCoords, discoveries = [] }) {
  const [leadersByZone, setLeadersByZone] = useState({});
  const [eventState, setEventState] = useState({ lostZones: [], gainedZones: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userEmail || !geoCoords) return;

    const loadLeaders = async () => {
      setLoading(true);
      try {
        const zoneIds = getSurroundingZoneIds(geoCoords.lat, geoCoords.lng, 3);
        const { data } = await supabase
          .from("zone_leaders")
          .select("*")
          .in("zone_id", zoneIds)
          .order("species_count", { ascending: false });

        const map = {};
        for (const row of data || []) {
          if (!map[row.zone_id]) map[row.zone_id] = row;
        }
        setLeadersByZone(map);
      } catch (error) {
        console.error("[TerrainAlertDeck] loadLeaders failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaders();
  }, [geoCoords?.lat, geoCoords?.lng, userEmail]);

  useEffect(() => {
    if (!userEmail || !geoCoords) return;

    const originZoneId = getZoneId(geoCoords.lat, geoCoords.lng);
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
  }, [leadersByZone, geoCoords?.lat, geoCoords?.lng, userEmail]);

  const zoneIds = geoCoords ? getSurroundingZoneIds(geoCoords.lat, geoCoords.lng, 3) : [];
  const zoneScores = computeUserZoneScores(discoveries);
  const currentZoneId = geoCoords ? getZoneId(geoCoords.lat, geoCoords.lng) : null;
  const lostZone = eventState.lostZones[0] || null;
  const gainedZone = eventState.gainedZones[0] || null;

  const readyTargets = zoneIds
    .map((zoneId) => {
      if (!zoneId || zoneId === currentZoneId) return null;
      const leader = leadersByZone[zoneId] || null;
      if (leader?.user_email === userEmail) return null;

      const userScore = zoneScores[zoneId] || 0;
      const free = !leader;
      const targetScore = free ? 1 : (leader.species_count || 0) + 1;
      const ready = userScore >= targetScore;

      if (!ready) return null;

      return {
        zoneId,
        free,
        userScore,
        leaderName: leader?.display_name || "Libre",
      };
    })
    .filter(Boolean);

  const pressureTargets = zoneIds
    .map((zoneId) => {
      if (!zoneId || zoneId === currentZoneId) return null;
      const leader = leadersByZone[zoneId] || null;
      if (!leader || leader.user_email === userEmail) return null;

      const userScore = zoneScores[zoneId] || 0;
      const targetScore = (leader.species_count || 0) + 1;
      const gap = Math.max(0, targetScore - userScore);

      if (gap === 0 || gap > 2) return null;

      return {
        zoneId,
        gap,
        leaderName: leader.display_name || "le referent",
        userScore,
        leaderScore: leader.species_count || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap);

  const fragileOwnedZones = zoneIds
    .map((zoneId) => {
      const leader = leadersByZone[zoneId];
      if (!leader || leader.user_email !== userEmail) return null;

      const score = Math.max(zoneScores[zoneId] || 0, leader.species_count || 0);
      if (score > 3) return null;

      return { zoneId, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  const freeZonesCount = countNearbyFreeZones(zoneIds.filter((zoneId) => zoneId !== currentZoneId), leadersByZone);
  const readyTarget = readyTargets[0] || null;
  const pressureTarget = pressureTargets[0] || null;
  const fragileZone = fragileOwnedZones[0] || null;
  const { label: lostZoneLabel } = useZoneLabel(lostZone);
  const { label: gainedZoneLabel } = useZoneLabel(gainedZone);
  const { label: readyTargetLabel } = useZoneLabel(readyTarget?.zoneId);
  const { label: pressureTargetLabel } = useZoneLabel(pressureTarget?.zoneId);
  const { label: fragileZoneLabel } = useZoneLabel(fragileZone?.zoneId);

  if (!userEmail || !geoCoords || loading) return null;

  let primaryAlert = null;

  if (lostZone) {
    primaryAlert = {
      tone: "#E35B5B",
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
      tone: readyTarget.free ? "#53C1FF" : "var(--v1v-green)",
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
      tone: "#C8960A",
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
      tone: "#C8960A",
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
    { label: "À enrichir", value: pressureTargets.length, tone: "#C8960A" },
    { label: "À initier", value: freeZonesCount, tone: "#53C1FF" },
  ];

  const Icon = primaryAlert.icon;

  return (
    <div className="px-5 py-1">
      <div
        className="p-4"
        style={{
          background: "rgba(8,14,8,0.72)",
          border: `1px solid ${primaryAlert.tone}33`,
          boxShadow: `0 0 28px ${primaryAlert.tone === "var(--v1v-green)" ? "rgba(46,168,15,0.12)" : primaryAlert.tone === "#53C1FF" ? "rgba(83,193,255,0.12)" : primaryAlert.tone === "#E35B5B" ? "rgba(227,91,91,0.12)" : "rgba(200,150,10,0.12)"}`,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" style={{ color: primaryAlert.tone }} />
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.32em]" style={{ color: "rgba(226,234,224,0.38)" }}>
                Repères du terrain
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: primaryAlert.tone }}>
                {primaryAlert.badge}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(226,234,224,0.35)" }}>
              {primaryAlert.metricLabel}
            </p>
            <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: primaryAlert.tone }}>
              {primaryAlert.metricValue}
            </p>
          </div>
        </div>

        <p className="text-sm font-black uppercase tracking-[0.08em] leading-tight mb-1.5" style={{ color: "#F4F8F1" }}>
          {primaryAlert.title}
        </p>
        <p className="text-[10px] leading-relaxed mb-3" style={{ color: "rgba(226,234,224,0.72)" }}>
          {primaryAlert.description}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {secondaryStats.map((item) => (
            <div
              key={item.label}
              className="px-2.5 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[7px] font-black uppercase tracking-[0.24em] mb-1" style={{ color: "rgba(226,234,224,0.38)" }}>
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
            className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "#F4F8F1",
              border: "1px solid rgba(255,255,255,0.1)",
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
