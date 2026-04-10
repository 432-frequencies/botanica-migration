import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Crown, Flame, MapPin, Share2, Shield, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { getLevelProgress } from "@/lib/leveling";
import { useZoneLabel } from "@/lib/locationMeta";
import { getSpeciesKey, normalizeSpeciesCategory } from "@/lib/species";
import { computeUserZoneScores, getSurroundingZoneIds, getZoneCenter, getZoneId } from "@/lib/zones";
import { createPageUrl } from "@/utils";
import ZoneShareCard from "@/components/home/ZoneShareCard";
import { useNavigate } from "react-router-dom";

const G = "var(--v1v-green)";
const GOLD = "#C8960A";
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
    title: next ? `Niveau ${next.level}` : `Niveau ${current.level}`,
    description: next
      ? `Encore ${xpToNext} XP pour débloquer ${next.label}`
      : "Rang maximal atteint. Continue a enrichir le terrain autour de toi.",
    progress: next ? progressPct : 100,
    progressText: next ? `${totalPoints}/${next.xp} XP` : `${totalPoints} XP`,
  });

  if (isLeader) {
    const leadMargin = Math.max(0, localSpeciesCount - (leader?.species_count || 0));
    challenges.push({
      key: "defense",
      icon: <Shield className="w-3.5 h-3.5" style={{ color: GOLD }} />,
      title: "Renforcer la zone",
      description: leadMargin > 0
        ? `Tu documentes ${leadMargin} ${pluralize(leadMargin, "espece")} d'avance dans cette zone`
        : "Une observation de plus consoliderait immediatement ta contribution locale",
      progress: Math.min(100, Math.max(leadMargin, 1) * 20),
      progressText: leadMargin > 0 ? `+${leadMargin} d'avance` : "Zone a consolider",
    });
  } else {
    const target = Math.max(1, (leader?.species_count || 0) + 1);
    const gap = Math.max(1, target - localSpeciesCount);
    const canTakeCrown = leader ? localSpeciesCount >= target : localSpeciesCount >= 1;
    challenges.push({
      key: "zone",
      icon: <Target className="w-3.5 h-3.5" style={{ color: G }} />,
      title: leader ? "Devenir referent" : "Premiere contribution",
      description: canTakeCrown
        ? leader
          ? "Tu as deja le score pour devenir la reference locale. Ouvre la carte et valide la zone."
          : "La zone est prete a accueillir sa premiere contribution. Ouvre la carte et initie sa documentation."
        : leader
        ? `Encore ${gap} ${pluralize(gap, "espece")} unique pour depasser ${leader.display_name || "la reference actuelle"}`
        : "La zone est ouverte. Une espece unique ici suffit pour lancer la documentation.",
      progress: canTakeCrown ? 100 : Math.min(100, (localSpeciesCount / target) * 100),
      progressText: leader ? `${localSpeciesCount}/${target} especes` : `${Math.min(localSpeciesCount, 1)}/1 zone`,
    });
  }

  const legendProgress = Math.min(100, (effectiveOwnedZonesCount / LEGEND_ZONE_GOAL) * 100);
  challenges.push({
    key: "legend",
    icon: <Crown className="w-3.5 h-3.5" style={{ color: effectiveOwnedZonesCount > 0 ? GOLD : G }} />,
    title: effectiveOwnedZonesCount > 0 ? "Vers Legende" : "Devenir gardien",
    description: effectiveOwnedZonesCount > 0
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentees - encore ${Math.max(0, LEGEND_ZONE_GOAL - effectiveOwnedZonesCount)} avant Legende`
      : "0/1 zone documentee - initie ta premiere zone pour lancer ton parcours",
    progress: effectiveOwnedZonesCount > 0 ? legendProgress : 0,
    progressText: effectiveOwnedZonesCount > 0
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones`
      : "Premiere zone",
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
    description: `Trouve encore ${Math.max(0, specialist.goal - specialist.count)} ${pluralize(Math.max(0, specialist.goal - specialist.count), specialist.noun, specialist.plural)} à repérer pour monter en spécialité`,
    progress: specialist.progress,
    progressText: `${specialist.count}/${specialist.goal} ${pluralize(specialist.goal, specialist.noun, specialist.plural)}`,
  });

  const streakGoal = streakDays >= 7 ? 14 : 7;
  challenges.push({
    key: "streak",
    icon: <Flame className="w-3.5 h-3.5" style={{ color: streakDays >= 3 ? "#FF6B35" : G }} />,
    title: "Série active",
    description: streakDays > 0
      ? `Encore ${Math.max(0, streakGoal - streakDays)} jour${Math.max(0, streakGoal - streakDays) > 1 ? "s" : ""} pour ton prochain palier de serie`
      : "Observe aujourd'hui pour lancer une nouvelle serie de terrain",
    progress: streakDays > 0 ? Math.min(100, (streakDays / streakGoal) * 100) : 0,
    progressText: streakDays > 0 ? `${streakDays}/${streakGoal} jours` : "0/7 jours",
  });

  return challenges;
}

function StatTile({ label, value, accent = G }) {
  return (
    <div
      className="px-2.5 py-2 rounded-lg"
      style={{ background: "rgba(45,122,31,0.05)", border: "1px solid rgba(45,122,31,0.14)" }}
    >
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

export default function LocalZoneWidget({ userEmail, geoCoords, profile, discoveries = [] }) {
  const navigate = useNavigate();
  const [zoneId, setZoneId] = useState(null);
  const [leader, setLeader] = useState(null);
  const [nearbyLeaders, setNearbyLeaders] = useState({});
  const [ownedZonesCount, setOwnedZonesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [showShareCard, setShowShareCard] = useState(false);

  useEffect(() => {
    if (!geoCoords || !userEmail) return;
    const loadZoneData = async () => {
      setLoading(true);
      try {
        const currentZoneId = getZoneId(geoCoords.lat, geoCoords.lng);
        const nearbyZoneIds = getSurroundingZoneIds(geoCoords.lat, geoCoords.lng, 2);
        const [leaderRes, nearbyLeadersRes, ownedZonesRes] = await Promise.all([
          supabase
            .from("zone_leaders")
            .select("*")
            .eq("zone_id", currentZoneId)
            .order("species_count", { ascending: false })
            .limit(1),
          supabase
            .from("zone_leaders")
            .select("*")
            .in("zone_id", nearbyZoneIds)
            .order("species_count", { ascending: false }),
          supabase
            .from("zone_leaders")
            .select("zone_id", { count: "exact", head: true })
            .eq("user_email", userEmail),
        ]);

        setZoneId(currentZoneId);
        setLeader(leaderRes.data?.[0] || null);
        setNearbyLeaders(Object.fromEntries((nearbyLeadersRes.data || []).map((entry) => [entry.zone_id, entry])));
        setOwnedZonesCount(ownedZonesRes.count || 0);
      } catch (error) {
        console.error("[LocalZoneWidget] loadZoneData failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadZoneData();
  }, [geoCoords?.lat, geoCoords?.lng, userEmail]);

  const zoneScores = computeUserZoneScores(discoveries);
  const activeZoneId = zoneId || getZoneId(geoCoords?.lat, geoCoords?.lng);
  const localSpeciesCount = activeZoneId ? (zoneScores[activeZoneId] || 0) : 0;
  const isLeader = leader?.user_email === userEmail;
  const effectiveOwnedZonesCount = Math.max(ownedZonesCount, isLeader ? 1 : 0);
  const noLeader = !leader;
  const zoneTarget = Math.max(1, (leader?.species_count || 0) + (isLeader ? 0 : 1));
  const zoneGap = leader ? Math.max(1, zoneTarget - localSpeciesCount) : 1;
  const canTakeCrown = !isLeader && (leader ? localSpeciesCount >= zoneTarget : localSpeciesCount >= 1);
  const zoneProgress = Math.min(100, (localSpeciesCount / zoneTarget) * 100);
  const legendProgress = Math.min(100, (effectiveOwnedZonesCount / LEGEND_ZONE_GOAL) * 100);
  const totalPoints = profile?.total_points || 0;
  const streakDays = computeDiscoveryStreak(discoveries);
  const challenges = buildChallenges({
    discoveries,
    isLeader,
    leader,
    localSpeciesCount,
    ownedZonesCount: effectiveOwnedZonesCount,
    totalPoints,
  });
  const challengeCount = challenges.length;
  const surroundingZoneIds = getSurroundingZoneIds(geoCoords?.lat, geoCoords?.lng, 2);

  const nearbyOpportunities = surroundingZoneIds
    .map((candidateZoneId) => {
      if (!candidateZoneId || candidateZoneId === activeZoneId) return null;

      const candidateLeader = nearbyLeaders[candidateZoneId] || null;
      if (candidateLeader?.user_email === userEmail) return null;

      const userScore = zoneScores[candidateZoneId] || 0;
      const free = !candidateLeader;
      const targetScore = free ? 1 : (candidateLeader.species_count || 0) + 1;
      const gap = Math.max(0, targetScore - userScore);
      const ready = userScore >= targetScore;

      if (!ready && !free && gap > 2) return null;

      return {
        zoneId: candidateZoneId,
        leaderName: candidateLeader?.display_name || "Libre",
        leaderScore: candidateLeader?.species_count || 0,
        userScore,
        targetScore,
        gap,
        ready,
        free,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.ready) - Number(a.ready) || a.gap - b.gap || b.userScore - a.userScore);

  const defenseWatch = surroundingZoneIds
    .map((candidateZoneId) => {
      if (!candidateZoneId || candidateZoneId === activeZoneId) return null;

      const candidateLeader = nearbyLeaders[candidateZoneId] || null;
      if (candidateLeader?.user_email !== userEmail) return null;

      const zoneScore = Math.max(zoneScores[candidateZoneId] || 0, candidateLeader?.species_count || 0);
      if (zoneScore > 3) return null;

      return {
        zoneId: candidateZoneId,
        score: zoneScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)[0] || null;

  const primeTarget = nearbyOpportunities[0] || null;
  const { label: activeZoneName } = useZoneLabel(activeZoneId);
  const { label: primeTargetName } = useZoneLabel(primeTarget?.zoneId);
  const { label: defenseZoneName } = useZoneLabel(defenseWatch?.zoneId);
  const displayedActiveZone = activeZoneName || activeZoneId || "Zone locale";
  const displayedPrimeTarget = primeTargetName || primeTarget?.zoneId || "secteur voisin";
  const displayedDefenseZone = defenseZoneName || defenseWatch?.zoneId || "secteur voisin";
  const primaryActionZoneId = isLeader
    ? defenseWatch?.zoneId || activeZoneId
    : canTakeCrown || noLeader
      ? activeZoneId
      : primeTarget?.zoneId || activeZoneId;
  const primaryActionLabel = isLeader
    ? "Renforcer la zone"
    : canTakeCrown
      ? "Documenter la zone"
      : noLeader
        ? "Initier la zone"
        : "Voir la carte";

  useEffect(() => {
    if (challengeCount <= 1) return;
    const interval = setInterval(() => {
      setCurrentChallengeIndex((prev) => (prev + 1) % challengeCount);
    }, 12000);
    return () => clearInterval(interval);
  }, [challengeCount]);

  useEffect(() => {
    if (!challengeCount) {
      setCurrentChallengeIndex(0);
      return;
    }
    setCurrentChallengeIndex((prev) => prev % challengeCount);
  }, [challengeCount]);

  if (!geoCoords || !userEmail || loading) return null;

  const headline = isLeader
    ? "Vous etes la reference de cette zone"
    : canTakeCrown
      ? "Votre contribution peut faire reference ici"
    : noLeader
      ? "Cette zone attend sa premiere reference"
      : `Encore ${zoneGap} ${pluralize(zoneGap, "espece")} pour devenir la reference locale`;

  const supportingCopy = isLeader
    ? effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
      ? "Votre parcours local est deja bien etabli. Continuez a enrichir le vivant zone apres zone."
      : `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentees - plus que ${LEGEND_ZONE_GOAL - effectiveOwnedZonesCount} avant le rang Legende`
    : effectiveOwnedZonesCount > 0
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentees - une nouvelle zone te rapproche de Legende`
      : canTakeCrown
        ? "0/1 zone documentee - ouvre la carte et officialise ta premiere contribution majeure"
      : noLeader
        ? "0/1 zone documentee - une seule espece unique ici suffit pour lancer cette zone"
        : `0/1 zone documentee - depasse ${leader?.display_name || "la reference actuelle"} et signe ta premiere zone`;

  const contributionStatus = isLeader
    ? effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
      ? "Legende active"
      : "Reference etablie"
    : canTakeCrown
      ? "Pret a valider"
      : noLeader
        ? "Premiere trace"
        : "Elan local";

  const missionBrief = isLeader
    ? effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
      ? "Continue a documenter tes zones et montre que ton parcours local est durable."
      : "Trouve une nouvelle espece ici pour rendre cette zone encore plus riche et fiable."
    : canTakeCrown
      ? "Tu as deja le score. Ouvre la carte, valide cette zone et partage ta contribution."
      : noLeader
        ? "Une espece unique ici suffit pour lancer la documentation de cette zone."
        : `Trouve encore ${zoneGap} ${pluralize(zoneGap, "espece")} unique pour devenir la reference devant ${leader?.display_name || "la reference actuelle"}.`;

  const broadcastLabel = isLeader
    ? "Partager la reference"
    : canTakeCrown
      ? "Partager la progression"
    : noLeader
        ? "Partager l'ouverture"
        : "Partager l'observation";

  const sharePayload = {
    kind: isLeader ? "reference" : canTakeCrown ? "milestone" : noLeader ? "opening" : "progress",
    zoneId: activeZoneId,
    zoneLabel: displayedActiveZone,
    headline: isLeader ? "Reference locale" : canTakeCrown ? "Contribution decisive" : noLeader ? "Zone a initier" : "Progression locale",
    detail: isLeader
      ? `Je documente ${displayedActiveZone} sur W1LD et j'enrichis cette zone espece apres espece.`
      : canTakeCrown
        ? `${displayedActiveZone} est prete a accueillir une contribution majeure.`
        : noLeader
          ? `${displayedActiveZone} n'a pas encore de reference locale. C'est le moment de lancer sa documentation.`
          : `Je progresse dans ${displayedActiveZone}. Encore ${zoneGap} ${pluralize(zoneGap, "espece")} pour devenir la reference locale.`,
    metricValue: isLeader ? `${effectiveOwnedZonesCount}` : canTakeCrown ? "1" : noLeader ? "0-1" : `${zoneGap}`,
    metricLabel: isLeader ? "Zones documentees" : canTakeCrown ? "Validation proche" : noLeader ? "Zone a lancer" : "Especes restantes",
    mission: missionBrief,
    broadcast: isLeader
      ? `${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentees avant le rang Legende.`
      : canTakeCrown
        ? "Cette zone peut basculer vers une contribution majeure des maintenant."
        : noLeader
          ? "Une decouverte ici suffit pour lancer une nouvelle zone documentee."
          : `${localSpeciesCount}/${zoneTarget} especes locales. La progression se construit dans cette zone.`,
    footerHeadline: isLeader
      ? `${Math.max(1, streakDays)} jours de presence terrain`
      : streakDays > 0
        ? `Serie terrain ${streakDays} jours`
        : "Le vivant n'attend pas",
    footerDetail: isLeader
      ? `${Math.max(0, LEGEND_ZONE_GOAL - effectiveOwnedZonesCount)} zones encore avant Legende`
      : canTakeCrown
        ? "Contribution majeure disponible des maintenant"
        : noLeader
          ? "Premiere zone a initier"
          : `${zoneGap} ${pluralize(zoneGap, "espece")} pour devenir referent`,
    shareTitle: isLeader ? "Reference locale" : canTakeCrown ? "Contribution decisive" : noLeader ? "Zone a initier" : "Observation en cours",
    shareText: isLeader
      ? `Je suis la reference locale de ${displayedActiveZone} sur W1LD. ${effectiveOwnedZonesCount}/${LEGEND_ZONE_GOAL} zones documentees avant le rang Legende.`
      : canTakeCrown
        ? `Je peux signer une contribution majeure dans ${displayedActiveZone} sur W1LD.`
        : noLeader
          ? `${displayedActiveZone} attend sa premiere reference sur W1LD.`
          : `Je documente ${displayedActiveZone} sur W1LD. Encore ${zoneGap} ${pluralize(zoneGap, "espece")} pour devenir la reference locale.`,
  };

  const primaryTrack = !isLeader && effectiveOwnedZonesCount === 0
    ? {
        label: "Premiere zone documentee",
        value: "0/1",
        progress: canTakeCrown ? 100 : zoneProgress,
        foot: canTakeCrown
          ? "Zone prete a etre validee"
          : noLeader
          ? "Premiere contribution a portee immediate"
          : `${localSpeciesCount}/${zoneTarget} especes locales pour devenir referent`,
      }
    : {
        label: "Route vers Legende",
        value: `${Math.min(effectiveOwnedZonesCount, LEGEND_ZONE_GOAL)}/${LEGEND_ZONE_GOAL}`,
        progress: legendProgress,
        foot: effectiveOwnedZonesCount >= LEGEND_ZONE_GOAL
          ? "Statut Legende atteint"
          : `${LEGEND_ZONE_GOAL - effectiveOwnedZonesCount} zones avant Legende`,
      };

  const previewChallengeIndex = challengeCount > 1 ? (currentChallengeIndex + 1) % challengeCount : currentChallengeIndex;
  const tacticalPanel = primeTarget
    ? {
        tone: primeTarget.ready ? G : primeTarget.free ? "#53C1FF" : GOLD,
        panelBg: primeTarget.ready
          ? "rgba(45,122,31,0.08)"
          : primeTarget.free
            ? "rgba(83,193,255,0.08)"
            : "rgba(200,150,10,0.08)",
        panelBorder: primeTarget.ready
          ? "rgba(45,122,31,0.28)"
          : primeTarget.free
            ? "rgba(83,193,255,0.28)"
            : "rgba(200,150,10,0.28)",
        glow: primeTarget.ready
          ? "0 0 24px rgba(45,122,31,0.14)"
          : primeTarget.free
            ? "0 0 24px rgba(83,193,255,0.14)"
            : "0 0 24px rgba(200,150,10,0.14)",
        badgeBg: primeTarget.ready
          ? "rgba(45,122,31,0.18)"
          : primeTarget.free
            ? "rgba(83,193,255,0.18)"
            : "rgba(200,150,10,0.18)",
        badgeBorder: primeTarget.ready
          ? "rgba(45,122,31,0.28)"
          : primeTarget.free
            ? "rgba(83,193,255,0.28)"
            : "rgba(200,150,10,0.28)",
        badge: primeTarget.ready ? "Prete" : primeTarget.free ? "A initier" : `-${primeTarget.gap} especes`,
        title: primeTarget.ready
          ? `Contribution decisive sur ${displayedPrimeTarget}`
          : primeTarget.free
            ? `Zone a documenter : ${displayedPrimeTarget}`
            : `Prochaine zone a enrichir : ${displayedPrimeTarget}`,
        description: primeTarget.ready
          ? "Tu as deja ce qu'il faut. Passe sur la carte et valide cette zone."
          : primeTarget.free
            ? "Aucune reference locale en place. Un scan bien situe peut lancer la documentation autour de toi."
            : `Plus que ${primeTarget.gap} ${pluralize(primeTarget.gap, "espece")} unique et ${primeTarget.leaderName} n'est plus la reference locale.`,
        leftLabel: "Vous",
        leftValue: primeTarget.userScore,
        middleLabel: primeTarget.free ? "Seuil" : "Leader",
        middleValue: primeTarget.free ? 1 : primeTarget.leaderScore,
        rightLabel: "Zone",
        rightValue: displayedPrimeTarget,
      }
    : defenseWatch
      ? {
          tone: GOLD,
          panelBg: "rgba(200,150,10,0.08)",
        panelBorder: "rgba(200,150,10,0.28)",
        glow: "0 0 24px rgba(200,150,10,0.14)",
        badgeBg: "rgba(200,150,10,0.18)",
        badgeBorder: "rgba(200,150,10,0.28)",
        badge: "A renforcer",
        title: `Zone à renforcer : ${displayedDefenseZone}`,
        description: "Cette zone voisine reste encore legere. Une observation de plus y rendrait ta contribution beaucoup plus solide.",
        leftLabel: "Score",
        leftValue: defenseWatch.score,
        middleLabel: "Etat",
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
        className="w-full p-4"
        style={{
          background: isLeader ? "rgba(200,150,10,0.07)" : "rgba(45,122,31,0.08)",
          border: `1px solid ${isLeader ? "rgba(200,150,10,0.35)" : "rgba(45,122,31,0.2)"}`,
          boxShadow: isLeader ? "0 0 28px rgba(200,150,10,0.08)" : "none",
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
            background: isLeader ? "rgba(200,150,10,0.16)" : "rgba(45,122,31,0.12)",
            color: isLeader ? GOLD : G,
            border: `1px solid ${isLeader ? "rgba(200,150,10,0.35)" : "rgba(45,122,31,0.25)"}`,
          }}
        >
          {isLeader ? "Reference" : noLeader ? "A initier" : "En cours"}
        </span>
      </div>

      <div className="mb-3">
        <p
          className="text-sm font-black uppercase tracking-[0.08em] leading-tight"
          style={{ color: isLeader ? GOLD : "var(--v1v-fg)" }}
        >
          {headline}
        </p>
        <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "rgba(45,122,31,0.7)" }}>
          {supportingCopy}
        </p>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[8px] uppercase tracking-[0.25em] font-black" style={{ color: "rgba(45,122,31,0.5)" }}>
            {primaryTrack.label}
          </p>
          <p className="text-xs font-black" style={{ color: isLeader ? GOLD : G }}>
            {primaryTrack.value}
          </p>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(45,122,31,0.1)" }}>
          <div
            className="h-2 transition-all duration-500"
            style={{
              width: `${primaryTrack.progress}%`,
              background: isLeader ? `linear-gradient(90deg, ${GOLD}, #E7C35A)` : G,
            }}
          />
        </div>
        <p className="text-[8px] uppercase tracking-[0.24em] font-black mt-1.5" style={{ color: "rgba(45,122,31,0.45)" }}>
          {primaryTrack.foot}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatTile label="Espèces locales" value={localSpeciesCount} accent={isLeader ? GOLD : G} />
        <StatTile label="Référence" value={leader?.species_count || 0} accent={G} />
        <StatTile label="Zones doc." value={effectiveOwnedZonesCount} accent={isLeader ? GOLD : G} />
      </div>

      <div
        className="mb-3 p-3 rounded-lg"
        style={{
          background: isLeader ? "rgba(200,150,10,0.08)" : "rgba(45,122,31,0.06)",
          border: `1px solid ${isLeader ? "rgba(200,150,10,0.2)" : "rgba(45,122,31,0.18)"}`,
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.5)" }}>
            Repere du jour
          </p>
          <span
            className="text-[7px] font-black uppercase tracking-[0.28em] px-2 py-1"
            style={{
              color: isLeader ? GOLD : G,
              background: isLeader ? "rgba(200,150,10,0.14)" : "rgba(45,122,31,0.12)",
              border: `1px solid ${isLeader ? "rgba(200,150,10,0.25)" : "rgba(45,122,31,0.2)"}`,
            }}
          >
            {contributionStatus}
          </span>
        </div>
        <p className="text-[10px] leading-relaxed mb-3" style={{ color: "rgba(45,122,31,0.78)" }}>
          {missionBrief}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="Serie"
            value={streakDays > 0 ? `${streakDays}j` : "À lancer"}
            accent={streakDays >= 3 ? "#FF6B35" : isLeader ? GOLD : G}
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
          className="mb-3 p-3 rounded-lg"
          style={{
            background: tacticalPanel.panelBg,
            border: `1px solid ${tacticalPanel.panelBorder}`,
            boxShadow: tacticalPanel.glow,
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.5)" }}>
              Opportunite proche
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
          <p className="text-[9px] leading-relaxed mb-3" style={{ color: "rgba(226,234,224,0.72)" }}>
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
        className="w-full mb-2 py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
        style={{
          background: isLeader ? "rgba(200,150,10,0.16)" : "rgba(45,122,31,0.18)",
          color: isLeader ? GOLD : G,
          border: `1px solid ${isLeader ? "rgba(200,150,10,0.38)" : "rgba(45,122,31,0.3)"}`,
          boxShadow: isLeader ? "0 0 20px rgba(200,150,10,0.12)" : "0 0 18px rgba(45,122,31,0.08)",
        }}
      >
        {isLeader ? <Crown className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
        {primaryActionLabel}
      </button>

      {(isLeader || canTakeCrown || noLeader) && (
        <button
          onClick={() => setShowShareCard(true)}
          className="w-full mb-3 py-2.5 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] transition-all"
          style={{
            background: "transparent",
            color: isLeader ? GOLD : G,
            border: `1px solid ${isLeader ? "rgba(200,150,10,0.22)" : "rgba(45,122,31,0.22)"}`,
          }}
        >
          <Share2 className="w-3.5 h-3.5" />
          Partager ce repere
        </button>
      )}

      {challengeCount > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: "rgba(45,122,31,0.2)" }}>
          <p className="text-[7px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: "rgba(45,122,31,0.5)" }}>
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
                    className="flex items-start gap-2 p-2 rounded-lg"
                    style={{
                      background: isCurrent ? "rgba(45,122,31,0.08)" : "rgba(45,122,31,0.04)",
                      border: `1px solid ${isCurrent ? "rgba(45,122,31,0.18)" : "rgba(45,122,31,0.12)"}`,
                    }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {challenge.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: G }}>
                        {challenge.title}
                      </p>
                      <p className="text-[8px] leading-relaxed mt-0.5" style={{ color: "rgba(45,122,31,0.7)" }}>
                        {challenge.description}
                      </p>
                      {challenge.progress !== null && challenge.progress !== undefined && (
                        <div className="mt-1.5">
                          <div className="h-1 w-full rounded-full" style={{ background: "rgba(45,122,31,0.15)" }}>
                            <div
                              className="h-1 rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(challenge.progress, 100)}%`,
                                background: challenge.progress >= 100 ? "#2EA80F" : "rgba(45,122,31,0.5)",
                              }}
                            />
                          </div>
                          <p className="text-[7px] font-black uppercase mt-0.5" style={{ color: "rgba(45,122,31,0.5)" }}>
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
