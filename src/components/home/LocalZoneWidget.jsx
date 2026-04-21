import { useEffect, useState } from "react";
import { Compass, Flame, MapPin, Share2, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { getLevelProgress } from "@/lib/leveling";
import { buildLocalTerrainSignals } from "@/lib/localTerrain";
import { useZoneLabel } from "@/lib/locationMeta";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { getSpeciesKey, normalizeSpeciesCategory } from "@/lib/species";
import { getZoneCenter, getZoneId } from "@/lib/zones";
import { useCurrentZoneData } from "@/hooks/useCurrentZoneData";
import { createPageUrl } from "@/utils";
import ZoneShareCard from "@/components/home/ZoneShareCard";
import { useNavigate } from "react-router-dom";

const G = "var(--v1v-green)";
const GOLD = "var(--v1v-earth)";
const EARTH_BG = "var(--v1v-earth-bg)";
const EARTH_BORDER = "var(--v1v-earth-border)";
const LEGEND_ZONE_GOAL = 10;
const COLLECTOR_GOALS = [10, 25, 50, 100, 150, 250];

function pluralize(count, singular, plural = `${singular}s`) {
  return count > 1 ? plural : singular;
}

function computeUniqueSpeciesCount(discoveries = []) {
  return new Set(discoveries.map(getSpeciesKey).filter(Boolean)).size;
}

function computeUniqueCategoryCount(discoveries = [], category) {
  const species = new Set();
  for (const discovery of discoveries) {
    if (normalizeSpeciesCategory(discovery.category, discovery) !== category) continue;
    const key = getSpeciesKey(discovery);
    if (key) species.add(key);
  }
  return species.size;
}

function computeDiscoveryStreak(discoveries = []) {
  const uniqueDates = [...new Set(
    discoveries
      .map((discovery) => discovery.discovered_date || discovery.created_at?.split("T")[0])
      .filter(Boolean),
  )].sort().reverse();

  if (!uniqueDates.length) return 0;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = today.toISOString().split("T")[0];
  const yesterdayKey = yesterday.toISOString().split("T")[0];

  if (uniqueDates[0] !== todayKey && uniqueDates[0] !== yesterdayKey) return 0;

  let streak = 0;
  let cursor = new Date(uniqueDates[0]);

  while (uniqueDates.includes(cursor.toISOString().split("T")[0])) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getNextGoal(currentValue, goals) {
  return goals.find((goal) => goal > currentValue) || Math.ceil((currentValue + 1) / 25) * 25;
}

function buildChallenges({
  discoveries,
  isLeader,
  leader,
  localSpeciesCount,
  ownedZonesCount,
  totalPoints,
}) {
  const challenges = [];
  const { current, next, progressPct, xpToNext } = getLevelProgress(totalPoints);
  const uniqueSpeciesCount = computeUniqueSpeciesCount(discoveries);
  const streakDays = computeDiscoveryStreak(discoveries);
  const effectiveOwnedZonesCount = Math.max(ownedZonesCount, isLeader ? 1 : 0);

  challenges.push({
      key: "level",
      icon: <Trophy className="w-3.5 h-3.5" style={{ color: G }} />,
      title: next ? `Palier ${next.level}` : `Palier ${current.level}`,
      description: next
        ? `Encore ${xpToNext} XP pour débloquer ${next.label}`
        : "Palier maximal atteint. Continue à enrichir le terrain autour de toi.",
      progress: next ? progressPct : 100,
      progressText: next ? `${totalPoints}/${next.xp} XP` : `${totalPoints} XP`,
    });

  if (isLeader) {
    const leadMargin = Math.max(0, localSpeciesCount - (leader?.species_count || 0));
      challenges.push({
        key: "defense",
        icon: <Compass className="w-3.5 h-3.5" style={{ color: GOLD }} />,
        title: "Ancrer le repère",
        description: leadMargin > 0
          ? `Tu documentes ${leadMargin} ${pluralize(leadMargin, "espèce")} d'avance dans cette zone`
          : "Une observation de plus stabiliserait immédiatement ton rôle de référent local",
        progress: Math.min(100, Math.max(leadMargin, 1) * 20),
        progressText: leadMargin > 0 ? `+${leadMargin} d'avance` : "Repère à renforcer",
      });
    } else {
      const target = Math.max(1, (leader?.species_count || 0) + 1);
      const gap = Math.max(1, target - localSpeciesCount);
      const canReachReference = leader ? localSpeciesCount >= target : localSpeciesCount >= 1;
      challenges.push({
        key: "zone",
        icon: <Target className="w-3.5 h-3.5" style={{ color: G }} />,
        title: leader ? "Atteindre la référence" : "Ouvrir la zone",
        description: canReachReference
          ? leader
          ? "Tu as déjà le score pour rejoindre la référence locale. Ouvre la carte et enregistre cette avancée."
          : "La zone est prête à accueillir sa première observation structurante. Ouvre la carte et initie sa documentation."
        : leader
        ? `Encore ${gap} ${pluralize(gap, "espèce")} unique pour rejoindre ${leader.display_name || "la référence actuelle"}`
        : "La zone est ouverte. Une espèce unique ici suffit pour lancer la documentation.",
      progress: canReachReference ? 100 : Math.min(100, (localSpeciesCount / target) * 100),
      progressText: leader ? `${localSpeciesCount}/${target} espèces` : `${Math.min(localSpeciesCount, 1)}/1 zone`,
      });
    }

  const legendProgress = Math.min(100, (effectiveOwnedZonesCount / LEGEND_ZONE_GOAL) * 100);
  challenges.push({
    key: "legend",
    icon: <Compass className="w-3.5 h-3.5" style={{ color: effectiveOwnedZonesCount > 0 ? GOLD : G }} />,
    title: effectiveOwnedZonesCount > 0 ? "Chemin vers Légende" : "Devenir gardien",
    description: effectiveOwnedZonesCount > 0
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentées - encore ${Math.max(0, LEGEND_ZONE_GOAL - effectiveOwnedZonesCount)} avant Légende`
      : "0/1 zone documentée - initie ta première zone pour lancer ton parcours",
    progress: effectiveOwnedZonesCount > 0 ? legendProgress : 0,
    progressText: effectiveOwnedZonesCount > 0
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones`
      : "Première zone",
  });

  const nextCollectorGoal = getNextGoal(uniqueSpeciesCount, COLLECTOR_GOALS);
  challenges.push({
    key: "collector",
    icon: <Sparkles className="w-3.5 h-3.5" style={{ color: G }} />,
    title: "Collectionneur",
    description: `Encore ${Math.max(0, nextCollectorGoal - uniqueSpeciesCount)} ${pluralize(Math.max(0, nextCollectorGoal - uniqueSpeciesCount), "espèce")} unique avant le palier ${nextCollectorGoal}`,
    progress: Math.min(100, (uniqueSpeciesCount / nextCollectorGoal) * 100),
    progressText: `${uniqueSpeciesCount}/${nextCollectorGoal} espèces`,
  });

  const specialistTracks = [
    { key: "bird", title: "Ornithologue", goal: 5, noun: "oiseau", plural: "oiseaux", icon: <Zap className="w-3.5 h-3.5" style={{ color: G }} /> },
    { key: "fungus", title: "Mycologue", goal: 5, noun: "champignon", plural: "champignons", icon: <Sparkles className="w-3.5 h-3.5" style={{ color: G }} /> },
    { key: "arachnid", title: "Arachnologue", goal: 3, noun: "araignée", plural: "araignées", icon: <Target className="w-3.5 h-3.5" style={{ color: G }} /> },
  ];

  const specialist = specialistTracks
    .map((track) => {
      const count = computeUniqueCategoryCount(discoveries, track.key);
      return {
        ...track,
        count,
        progress: Math.min(100, (count / track.goal) * 100),
      };
    })
    .sort((a, b) => a.progress - b.progress)[0];

  challenges.push({
    key: "specialist",
    icon: specialist.icon,
    title: specialist.title,
    description: `Trouve encore ${Math.max(0, specialist.goal - specialist.count)} ${pluralize(Math.max(0, specialist.goal - specialist.count), specialist.noun, specialist.plural)} à repérer pour renforcer cette spécialité`,
    progress: specialist.progress,
    progressText: `${specialist.count}/${specialist.goal} ${pluralize(specialist.goal, specialist.noun, specialist.plural)}`,
  });

  const streakGoal = streakDays >= 7 ? 14 : 7;
  challenges.push({
    key: "streak",
    icon: <Flame className="w-3.5 h-3.5" style={{ color: streakDays >= 3 ? "#FF6B35" : G }} />,
      title: "Série active",
      description: streakDays > 0
      ? `Encore ${Math.max(0, streakGoal - streakDays)} jour${Math.max(0, streakGoal - streakDays) > 1 ? "s" : ""} pour ton prochain palier de série`
      : "Observe aujourd'hui pour lancer une nouvelle série de terrain",
    progress: streakDays > 0 ? Math.min(100, (streakDays / streakGoal) * 100) : 0,
    progressText: streakDays > 0 ? `${streakDays}/${streakGoal} jours` : "0/7 jours",
  });

  return challenges;
}

function StatTile({ label, value, accent = G }) {
  return (
    <div className="v1v-surface-card-soft px-2.5 py-2">
      <p className="text-[7px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: "rgba(45,122,31,0.45)" }}>
        {label}
      </p>
      <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function getZoneRoute(zoneId) {
  const baseRoute = createPageUrl("TerritorialMap");
  const center = getZoneCenter(zoneId);
  if (!center) return baseRoute;
  return `${baseRoute}?lat=${center.lat}&lng=${center.lng}&zoneId=${encodeURIComponent(zoneId)}`;
}

export default function LocalZoneWidget({ userEmail, geoCoords, profile, discoveries = [], zoneData = null }) {
  const navigate = useNavigate();
  const isHomeActive = useIsActivePage("Home");
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [showShareCard, setShowShareCard] = useState(false);
  const fallbackZoneData = useCurrentZoneData({
    userEmail,
    discoveries,
    geoCoords,
    active: !zoneData && isHomeActive,
    nearbyRadius: 3,
    includeOwnedZonesCount: true,
  });
  const data = zoneData || fallbackZoneData;

  const zoneScores = data.zoneScores || {};
  const activeZoneId = data.zoneId || getZoneId(geoCoords?.lat, geoCoords?.lng);
  const localSpeciesCount = data.localSpeciesCount ?? (activeZoneId ? (zoneScores[activeZoneId] || 0) : 0);
  const leader = data.leader || null;
  const nearbyLeaders = data.leadersByZone || {};
  const isLeader = data.isLeader;
  const effectiveOwnedZonesCount = Math.max(data.ownedZonesCount || 0, isLeader ? 1 : 0);
  const noLeader = data.noLeader;
  const zoneTarget = data.zoneTarget ?? Math.max(1, (leader?.species_count || 0) + (isLeader ? 0 : 1));
  const zoneGap = data.zoneGap ?? (leader ? Math.max(1, zoneTarget - localSpeciesCount) : 1);
  const canDocumentNow = data.canDocumentNow;
  const zoneProgress = data.zoneProgress ?? Math.min(100, (localSpeciesCount / zoneTarget) * 100);
  const legendProgress = Math.min(100, (effectiveOwnedZonesCount / LEGEND_ZONE_GOAL) * 100);
  const totalPoints = profile?.total_points || 0;
  const streakDays = computeDiscoveryStreak(discoveries);
  const terrainSignals = data.terrainSignals || buildLocalTerrainSignals({
    currentZoneId: activeZoneId,
    surroundingZoneIds: data.surroundingZoneIds || [],
    leadersByZone: nearbyLeaders,
    zoneScores,
    userEmail,
  });
  const challenges = buildChallenges({
    discoveries,
    isLeader,
    leader,
    localSpeciesCount,
    ownedZonesCount: effectiveOwnedZonesCount,
    totalPoints,
  });
  const challengeCount = challenges.length;
  const nearbyOpportunities = terrainSignals.nearbyOpportunities || [];
  const defenseWatch = terrainSignals.fragileOwnedZones?.[0] || null;

  const primeTarget = nearbyOpportunities[0] || null;
  const activeZoneName = data.zoneName || "";
  const { label: primeTargetName } = useZoneLabel(primeTarget?.zoneId);
  const { label: defenseZoneName } = useZoneLabel(defenseWatch?.zoneId);
  const displayedActiveZone = activeZoneName || activeZoneId || "Zone locale";
  const displayedPrimeTarget = primeTargetName || primeTarget?.zoneId || "secteur voisin";
  const displayedDefenseZone = defenseZoneName || defenseWatch?.zoneId || "secteur voisin";
  const primaryActionZoneId = isLeader
    ? defenseWatch?.zoneId || activeZoneId
    : canDocumentNow || noLeader
      ? activeZoneId
      : primeTarget?.zoneId || activeZoneId;
  const primaryActionLabel = isLeader
    ? "Explorer la carte"
    : canDocumentNow
      ? "Documenter ici"
    : noLeader
        ? "Ouvrir cette zone"
        : "Explorer la carte";

  useEffect(() => {
    if (!isHomeActive || challengeCount <= 1) return;
    const interval = setInterval(() => {
      setCurrentChallengeIndex((prev) => (prev + 1) % challengeCount);
    }, 12000);
    return () => clearInterval(interval);
  }, [challengeCount, isHomeActive]);

  useEffect(() => {
    if (!challengeCount) {
      setCurrentChallengeIndex(0);
      return;
    }
    setCurrentChallengeIndex((prev) => prev % challengeCount);
  }, [challengeCount]);

  if (!geoCoords || !userEmail) return null;

  if (data.loading) {
    return (
      <div className="v1v-surface-card-soft p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.32em] mb-2" style={{ color: "rgba(57,184,20,0.5)" }}>
          Lecture de ta zone…
        </p>
        <div className="space-y-2">
          <div className="h-3 rounded-full" style={{ background: "rgba(45,122,31,0.12)" }} />
          <div className="h-3 rounded-full w-2/3" style={{ background: "rgba(45,122,31,0.08)" }} />
          <div className="h-10 rounded-xl mt-3" style={{ background: "rgba(45,122,31,0.06)" }} />
        </div>
      </div>
    );
  }

  if (data.error && !leader) {
    return (
      <div
        className="v1v-surface-card-soft p-4"
        style={{ background: "rgba(21,101,192,0.08)", borderColor: "rgba(21,101,192,0.18)" }}
      >
        <p className="text-[9px] font-black uppercase tracking-[0.32em] mb-2" style={{ color: "var(--v1v-blue)" }}>
          Zone locale partielle
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
          Ta progression locale est prête. Les repères du voisinage reviendront dès que la connexion se stabilise.
        </p>
      </div>
    );
  }

  const headline = isLeader
    ? "Tu es le référent de cette zone"
    : canDocumentNow
      ? "Ton observation peut faire évoluer cette zone"
    : noLeader
      ? "Cette zone attend sa première référence"
      : `Encore ${zoneGap} ${pluralize(zoneGap, "espèce")} pour rejoindre la référence locale`;

  const supportingCopy = isLeader
    ? effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
      ? "Ton parcours local est déjà bien établi. Continue à enrichir le vivant zone après zone."
      : `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentées - plus que ${LEGEND_ZONE_GOAL - effectiveOwnedZonesCount} avant le rang Légende`
    : effectiveOwnedZonesCount > 0
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentées - une nouvelle zone te rapproche du rang Légende`
      : canDocumentNow
        ? "0/1 zone documentée - ouvre la carte et enregistre ton premier repère local"
      : noLeader
        ? "0/1 zone documentée - une seule espèce unique ici suffit pour lancer cette zone"
        : `0/1 zone documentée - rejoins ${leader?.display_name || "la référence actuelle"} et signe ta première zone`;

  const contributionStatus = isLeader
    ? effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
      ? "Légende active"
      : "Référent établi"
    : canDocumentNow
      ? "Prêt à documenter"
    : noLeader
      ? "Première trace"
        : "Elan local";

  const missionBrief = isLeader
    ? effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
      ? "Continue à documenter tes zones et montre que ton parcours local reste utile et durable."
      : "Trouve une nouvelle espèce ici pour rendre cette zone encore plus riche et fiable."
    : canDocumentNow
      ? "Tu as déjà le score. Ouvre la carte, enregistre cette observation utile et partage ton repère."
    : noLeader
        ? "Une espèce unique ici suffit pour lancer la documentation de cette zone."
        : `Trouve encore ${zoneGap} ${pluralize(zoneGap, "espèce")} unique pour rejoindre la référence devant ${leader?.display_name || "la référence actuelle"}.`;

  const broadcastLabel = isLeader
    ? "Partager le repère"
    : canDocumentNow
      ? "Partager l'observation"
      : noLeader
        ? "Partager l'ouverture"
        : "Partager l'observation";

  const sharePayload = {
    kind: isLeader ? "reference" : canDocumentNow ? "milestone" : noLeader ? "opening" : "progress",
    zoneId: activeZoneId,
    zoneLabel: displayedActiveZone,
    headline: isLeader ? "Référent local" : canDocumentNow ? "Observation utile" : noLeader ? "Zone à ouvrir" : "Progression locale",
    detail: isLeader
      ? `Je documente ${displayedActiveZone} sur W1LD et j'enrichis cette zone espèce après espèce.`
      : canDocumentNow
        ? `${displayedActiveZone} est prête à accueillir une observation utile.`
        : noLeader
          ? `${displayedActiveZone} n'a pas encore de référence locale. C'est le moment de lancer sa documentation.`
          : `Je progresse dans ${displayedActiveZone}. Encore ${zoneGap} ${pluralize(zoneGap, "espèce")} pour rejoindre la référence locale.`,
    metricValue: isLeader ? `${effectiveOwnedZonesCount}` : canDocumentNow ? "1" : noLeader ? "0-1" : `${zoneGap}`,
    metricLabel: isLeader ? "Zones documentées" : canDocumentNow ? "Validation proche" : noLeader ? "Zone à lancer" : "Espèces restantes",
    mission: missionBrief,
    broadcast: isLeader
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentées avant le rang Légende.`
      : canDocumentNow
        ? "Cette zone peut accueillir une observation utile dès maintenant."
        : noLeader
          ? "Une découverte ici suffit pour lancer une nouvelle zone documentée."
          : `${localSpeciesCount}/${zoneTarget} espèces locales. La progression se construit dans cette zone.`,
    footerHeadline: isLeader
      ? `${Math.max(1, streakDays)} jours de présence terrain`
      : streakDays > 0
        ? `Série terrain ${streakDays} jours`
        : "Le vivant n'attend pas",
    footerDetail: isLeader
      ? `${Math.max(0, LEGEND_ZONE_GOAL - effectiveOwnedZonesCount)} zones encore avant Légende`
      : canDocumentNow
        ? "Observation utile disponible dès maintenant"
        : noLeader
          ? "Première zone à ouvrir"
          : `${zoneGap} ${pluralize(zoneGap, "espèce")} pour rejoindre la référence`,
    shareTitle: isLeader ? "Référent local" : canDocumentNow ? "Observation utile" : noLeader ? "Zone à ouvrir" : "Observation en cours",
    shareText: isLeader
      ? `Je suis le référent local de ${displayedActiveZone} sur W1LD. ${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentées avant le rang Légende.`
      : canDocumentNow
        ? `Je peux enregistrer une observation utile dans ${displayedActiveZone} sur W1LD.`
        : noLeader
          ? `${displayedActiveZone} attend sa première référence sur W1LD.`
          : `Je documente ${displayedActiveZone} sur W1LD. Encore ${zoneGap} ${pluralize(zoneGap, "espèce")} pour rejoindre la référence locale.`,
  };

  const primaryTrack = !isLeader && effectiveOwnedZonesCount === 0
    ? {
        label: "Première zone documentée",
        value: "0/1",
        progress: canDocumentNow ? 100 : zoneProgress,
        foot: canDocumentNow
          ? "Zone prête à être validée"
          : noLeader
          ? "Première contribution à portée immédiate"
          : `${localSpeciesCount}/${zoneTarget} espèces locales pour rejoindre la référence`,
      }
    : {
        label: "Route vers Légende",
        value: `${Math.min(effectiveOwnedZonesCount, LEGEND_ZONE_GOAL)}/${LEGEND_ZONE_GOAL}`,
        progress: legendProgress,
        foot: effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
          ? "Statut Légende atteint"
          : `${LEGEND_ZONE_GOAL - effectiveOwnedZonesCount} zones avant Légende`,
      };

  const previewChallengeIndex = challengeCount > 1 ? (currentChallengeIndex + 1) % challengeCount : currentChallengeIndex;
  const tacticalPanel = primeTarget
    ? {
        tone: primeTarget.ready ? G : primeTarget.free ? "#53C1FF" : GOLD,
        panelBg: primeTarget.ready
          ? "var(--v1v-green-bg)"
          : primeTarget.free
            ? "var(--v1v-blue-bg)"
            : "var(--v1v-earth-bg)",
        panelBorder: primeTarget.ready
          ? "var(--v1v-green-ghost)"
          : primeTarget.free
            ? "var(--v1v-blue-border)"
            : "var(--v1v-earth-border)",
        glow: primeTarget.ready
          ? "0 0 24px rgba(63,163,77,0.14)"
          : primeTarget.free
            ? "0 0 24px rgba(21,101,192,0.14)"
            : "0 0 24px rgba(109,76,65,0.14)",
        badgeBg: primeTarget.ready
          ? "rgba(63,163,77,0.18)"
          : primeTarget.free
            ? "rgba(21,101,192,0.18)"
            : "rgba(109,76,65,0.18)",
        badgeBorder: primeTarget.ready
          ? "rgba(63,163,77,0.28)"
          : primeTarget.free
            ? "rgba(21,101,192,0.28)"
            : "rgba(109,76,65,0.28)",
        badge: primeTarget.ready ? "Prête" : primeTarget.free ? "À ouvrir" : `-${primeTarget.gap} espèces`,
        title: primeTarget.ready
          ? `Observation utile sur ${displayedPrimeTarget}`
          : primeTarget.free
            ? `Zone à documenter : ${displayedPrimeTarget}`
            : `Prochaine zone à enrichir : ${displayedPrimeTarget}`,
        description: primeTarget.ready
          ? "Tu as déjà ce qu'il faut. Passe sur la carte et enregistre cette observation utile."
          : primeTarget.free
            ? "Aucune référence locale en place. Un scan bien situé peut lancer la documentation autour de toi."
            : `Plus que ${primeTarget.gap} ${pluralize(primeTarget.gap, "espèce")} unique et ${primeTarget.leaderName} n'est plus la référence locale.`,
        leftLabel: "Vous",
        leftValue: primeTarget.userScore,
        middleLabel: primeTarget.free ? "Seuil" : "Référence",
        middleValue: primeTarget.free ? 1 : primeTarget.leaderScore,
        rightLabel: "Zone",
        rightValue: displayedPrimeTarget,
      }
    : defenseWatch
      ? {
          tone: GOLD,
          panelBg: EARTH_BG,
        panelBorder: EARTH_BORDER,
        glow: "0 0 24px rgba(109,76,65,0.14)",
        badgeBg: "rgba(109,76,65,0.18)",
        badgeBorder: "rgba(109,76,65,0.28)",
        badge: "À renforcer",
        title: `Zone à renforcer : ${displayedDefenseZone}`,
        description: "Cette zone voisine reste encore légère. Une observation de plus y rendrait ta contribution beaucoup plus solide.",
        leftLabel: "Score",
        leftValue: defenseWatch.score,
        middleLabel: "État",
        middleValue: "Fragile",
        rightLabel: "Zone",
        rightValue: displayedDefenseZone,
      }
      : null;

  return (
    <>
      {showShareCard && (
        <ZoneShareCard data={sharePayload} onClose={() => setShowShareCard(false)} />
      )}

      <div
        className="v1v-surface-card w-full p-4"
        style={{
          background: isLeader ? EARTH_BG : "var(--v1v-green-bg)",
          border: `1px solid ${isLeader ? EARTH_BORDER : "var(--v1v-green-ghost)"}`,
          boxShadow: isLeader ? "0 0 28px rgba(109,76,65,0.08)" : "none",
        }}
      >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: isLeader ? GOLD : G }} />
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.5)" }}>
              Zone locale
            </p>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: isLeader ? GOLD : G }}>
              {displayedActiveZone}
            </p>
          </div>
        </div>

        <span
          className="text-[7px] font-black uppercase tracking-[0.3em] px-2 py-1"
          style={{
            background: isLeader ? "rgba(109,76,65,0.16)" : "rgba(63,163,77,0.12)",
            color: isLeader ? GOLD : G,
            border: `1px solid ${isLeader ? EARTH_BORDER : "rgba(63,163,77,0.25)"}`,
          }}
        >
          {isLeader ? "Référent" : noLeader ? "À ouvrir" : "En cours"}
        </span>
      </div>

      <div className="mb-3">
        <p
          className="text-sm font-black uppercase tracking-[0.08em] leading-tight"
          style={{ color: isLeader ? GOLD : "var(--v1v-fg)" }}
        >
          {headline}
        </p>
        <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
          {supportingCopy}
        </p>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[8px] uppercase tracking-[0.25em] font-black" style={{ color: "var(--v1v-fg-faint)" }}>
            {primaryTrack.label}
          </p>
          <p className="text-xs font-black" style={{ color: isLeader ? GOLD : G }}>
            {primaryTrack.value}
          </p>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-2 transition-all duration-500"
            style={{
              width: `${primaryTrack.progress}%`,
              background: isLeader ? `linear-gradient(90deg, ${GOLD}, var(--v1v-earth-soft))` : G,
            }}
          />
        </div>
        <p className="text-[8px] uppercase tracking-[0.24em] font-black mt-1.5" style={{ color: "var(--v1v-fg-faint)" }}>
          {primaryTrack.foot}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatTile label="Espèces locales" value={localSpeciesCount} accent={isLeader ? GOLD : G} />
        <StatTile label="Référence" value={leader?.species_count || 0} accent={G} />
        <StatTile label="Zones doc." value={effectiveOwnedZonesCount} accent={isLeader ? GOLD : G} />
      </div>

      <div
        className="v1v-surface-card-soft mb-3 p-3"
        style={{
          background: isLeader ? EARTH_BG : "var(--v1v-green-bg-light)",
          border: `1px solid ${isLeader ? EARTH_BORDER : "var(--v1v-green-ghost)"}`,
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-fg-faint)" }}>
            Mission du jour
          </p>
          <span
            className="text-[7px] font-black uppercase tracking-[0.28em] px-2 py-1"
            style={{
              color: isLeader ? GOLD : G,
              background: isLeader ? "rgba(109,76,65,0.14)" : "rgba(63,163,77,0.12)",
              border: `1px solid ${isLeader ? EARTH_BORDER : "rgba(63,163,77,0.2)"}`,
            }}
          >
            {contributionStatus}
          </span>
        </div>
        <p className="text-[10px] leading-relaxed mb-3" style={{ color: "var(--v1v-fg-muted)" }}>
          {missionBrief}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Serie"
            value={streakDays > 0 ? `${streakDays}j` : "À lancer"}
            accent={streakDays >= 3 ? "var(--v1v-coral)" : isLeader ? GOLD : G}
          />
          <StatTile
            label="Partage"
            value={broadcastLabel}
            accent={isLeader ? GOLD : G}
          />
        </div>
      </div>

      {tacticalPanel && (
        <div
          className="v1v-surface-card-soft mb-3 p-3"
          style={{
            background: tacticalPanel.panelBg,
            border: `1px solid ${tacticalPanel.panelBorder}`,
            boxShadow: tacticalPanel.glow,
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-fg-faint)" }}>
            Opportunité proche
            </p>
            <span
              className="text-[7px] font-black uppercase tracking-[0.28em] px-2 py-1"
              style={{
                color: tacticalPanel.tone,
                background: tacticalPanel.badgeBg,
                border: `1px solid ${tacticalPanel.badgeBorder}`,
              }}
            >
              {tacticalPanel.badge}
            </span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.08em] mb-1.5" style={{ color: tacticalPanel.tone }}>
            {tacticalPanel.title}
          </p>
          <p className="text-[9px] leading-relaxed mb-3" style={{ color: "var(--v1v-fg-muted)" }}>
            {tacticalPanel.description}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={tacticalPanel.leftLabel} value={tacticalPanel.leftValue} accent={tacticalPanel.tone} />
            <StatTile label={tacticalPanel.middleLabel} value={tacticalPanel.middleValue} accent={tacticalPanel.tone} />
            <StatTile label={tacticalPanel.rightLabel} value={tacticalPanel.rightValue} accent={tacticalPanel.tone} />
          </div>
        </div>
      )}

      <button
        onClick={() => navigate(getZoneRoute(primaryActionZoneId))}
        className="v1v-button-primary mb-2 flex w-full items-center justify-center gap-2"
        style={{
          background: isLeader ? "rgba(109,76,65,0.16)" : "rgba(63,163,77,0.18)",
          color: isLeader ? GOLD : G,
          border: `1px solid ${isLeader ? EARTH_BORDER : "rgba(63,163,77,0.3)"}`,
          boxShadow: isLeader ? "0 0 20px rgba(109,76,65,0.12)" : "0 0 18px rgba(63,163,77,0.08)",
        }}
      >
        {isLeader ? <Compass className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
        {primaryActionLabel}
      </button>

      {(isLeader || canDocumentNow || noLeader) && (
        <button
          onClick={() => setShowShareCard(true)}
          className="v1v-button-secondary mb-3 flex w-full items-center justify-center gap-2"
          style={{
            background: "transparent",
            color: isLeader ? GOLD : G,
            border: `1px solid ${isLeader ? EARTH_BORDER : "rgba(63,163,77,0.22)"}`,
          }}
        >
          <Share2 className="w-3.5 h-3.5" />
          Partager cette note
        </button>
      )}

      {challengeCount > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: "rgba(45,122,31,0.2)" }}>
          <p className="text-[7px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: "var(--v1v-fg-faint)" }}>
            Objectifs actifs
          </p>
          <div className="space-y-2">
            {challenges.map((challenge, index) => {
              const isCurrent = index === currentChallengeIndex;
              const isPreview = challengeCount > 1 && index === previewChallengeIndex;
              if (!isCurrent && !isPreview) return null;

              return (
                <div
                  key={challenge.key}
                  className={`transition-all duration-500 ${isCurrent ? "opacity-100" : "opacity-45 scale-95"}`}
                  style={{ transform: isCurrent ? "scale(1)" : "scale(0.97)" }}
                >
                  <div
                    className="v1v-surface-card-soft flex items-start gap-2 p-2"
                    style={{
                      background: isCurrent ? "var(--v1v-green-bg)" : "var(--v1v-green-bg-light)",
                      border: `1px solid ${isCurrent ? "var(--v1v-green-ghost)" : "rgba(63,163,77,0.12)"}`,
                    }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {challenge.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: G }}>
                        {challenge.title}
                      </p>
                      <p className="text-[8px] leading-relaxed mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>
                        {challenge.description}
                      </p>
                      {challenge.progress !== null && challenge.progress !== undefined && (
                        <div className="mt-1.5">
                          <div className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div
                              className="h-1 rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(challenge.progress, 100)}%`,
                                background: challenge.progress >= 100 ? "var(--v1v-green)" : "rgba(63,163,77,0.5)",
                              }}
                            />
                          </div>
                          <p className="text-[7px] font-black uppercase mt-0.5" style={{ color: "var(--v1v-fg-faint)" }}>
                            {challenge.progressText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
