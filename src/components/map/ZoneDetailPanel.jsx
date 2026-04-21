import { createPortal } from "react-dom";
import { X, MapPin, Compass, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { modalSlideUp } from "@/motion/variants";
import { supabase } from "@/api/supabaseClient";
import { resolveDisplayName } from "@/lib/displayName";
import { useZoneLabel } from "@/lib/locationMeta";
import ZoneExplorer from "./ZoneExplorer";
import BlockErrorBoundary from "@/components/shared/BlockErrorBoundary";

const ZONE_DEG = 0.0045;

function getPresenceDays(leader, zoneId) {
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

function getSpeciesKey(discovery) {
  return (discovery?.scientific_name || discovery?.common_name || "").trim().toLowerCase();
}

function plural(value, singular, pluralLabel = `${singular}s`) {
  return `${value} ${value > 1 ? pluralLabel : singular}`;
}

export default function ZoneDetailPanel({ zone, onClose, userEmail, onConquest }) {
  const [showExplorer, setShowExplorer] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previousRank, setPreviousRank] = useState(null);
  const [activityStats, setActivityStats] = useState(emptyActivity());

  const zoneId = zone?.zone_id ?? null;
  const { label: zoneName } = useZoneLabel(zoneId);
  const isOwned = zone?.leader?.user_email === userEmail;
  const userScore = zone?.userScore || 0;
  const leaderScore = zone?.leader?.species_count || 0;
  const noLeader = !zone?.leader;
  const rawActivity = zone?.activity || emptyActivity();
  const activity = {
    observationCount: Math.max(rawActivity.observationCount || 0, activityStats.observationCount || 0, userScore),
    speciesCount: Math.max(rawActivity.speciesCount || 0, activityStats.speciesCount || 0, leaderScore, userScore),
    explorerCount: Math.max(rawActivity.explorerCount || 0, activityStats.explorerCount || 0, zone?.leader ? 1 : 0, userScore > 0 ? 1 : 0),
  };
  const hasTraces = activity.observationCount > 0 || activity.speciesCount > 0;
  const hasSeveralExplorers = activity.explorerCount > 1;
  const presenceDays = isOwned ? getPresenceDays(zone?.leader, zoneId) : 0;
  const nearestRival = leaderboard.find((player) => player.user_email !== userEmail) || null;
  const leadMargin = isOwned ? Math.max(0, leaderScore - (nearestRival?.species_count || 0)) : 0;
  const conquestGap = noLeader ? 1 : Math.max(1, leaderScore + 1 - userScore);
  const championTone = isOwned
    ? leadMargin <= 1
      ? "Présence à consolider"
    : leadMargin <= 3
      ? "Référent local"
      : "Secteur maîtrisé"
    : null;
  const championCopy = isOwned
    ? leadMargin <= 1
      ? `Ta présence est visible avec ${plural(activity.speciesCount, "espèce")} documentée${activity.speciesCount > 1 ? "s" : ""}. Une observation aujourd'hui la consoliderait.`
      : leadMargin <= 3
      ? `Tu gardes ${plural(leadMargin, "observation")} d'avance. Encore un peu de présence et ce secteur devient solide.`
      : hasSeveralExplorers
      ? `${plural(activity.explorerCount, "présence")} recensée${activity.explorerCount > 1 ? "s" : ""}. Tu portes la référence locale depuis ${presenceDays} jour${presenceDays > 1 ? "s" : ""}.`
      : `Ce territoire porte clairement ta présence depuis ${presenceDays} jour${presenceDays > 1 ? "s" : ""}. Continue à l'enrichir avec des observations fiables.`
    : noLeader
    ? hasTraces
      ? hasSeveralExplorers
        ? `${plural(activity.explorerCount, "présence")} ont déjà laissé des traces. Il reste à établir une référence locale claire.`
        : `Ce lieu commence à révéler des traces: ${plural(activity.observationCount, "observation")} déjà posée${activity.observationCount > 1 ? "s" : ""}.`
      : "Rien n’a encore été documenté ici."
    : conquestGap === 1
    ? "Une observation claire peut te rendre référent local."
    : hasSeveralExplorers
      ? `${plural(activity.explorerCount, "présence")} recensée${activity.explorerCount > 1 ? "s" : ""}. ${plural(conquestGap, "observation")} locale${conquestGap > 1 ? "s" : ""} peuvent faire évoluer la référence.`
      : `${plural(conquestGap, "observation")} locale${conquestGap > 1 ? "s" : ""} peuvent faire évoluer la référence du secteur.`;
  const rivalName = nearestRival?.display_name || "les autres observateurs";
  const advanceLabel = isOwned
    ? nearestRival
      ? `+${leadMargin} sur ${rivalName}`
      : `${leaderScore} observation${leaderScore > 1 ? "s" : ""} référencée${leaderScore > 1 ? "s" : ""}`
    : `${conquestGap} observation${conquestGap > 1 ? "s" : ""}`;

  // Charger le classement de la zone
  useEffect(() => {
    setShowExplorer(false);

    if (!zoneId) {
      setLeaderboard([]);
      setUserRank(null);
      setActivityStats(emptyActivity());
      setLoading(true);
      return;
    }

    loadZoneLeaderboard();
  }, [zoneId, userEmail]);

  const loadZoneLeaderboard = async () => {
    if (!zoneId) return;

    setLoading(true);
    try {
      // Récupérer toutes les découvertes dans cette zone
      const [zLat, zLng] = zoneId.split('_').map(Number);
      const centerLat = (zLat + 0.5) * ZONE_DEG;
      const centerLng = (zLng + 0.5) * ZONE_DEG;

      const latDelta = ZONE_DEG / 2;
      const lngDelta = ZONE_DEG / 2;

      const { data: discoveries } = await supabase
        .from('plant_discoveries')
        .select('user_email, common_name, scientific_name')
        .gte('latitude', centerLat - latDelta)
        .lte('latitude', centerLat + latDelta)
        .gte('longitude', centerLng - lngDelta)
        .lte('longitude', centerLng + lngDelta)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      const discoveryRows = discoveries || [];
      const allSpecies = new Set();
      const allExplorers = new Set();

      // Compter les espèces uniques par utilisateur
      const userSpecies = {};
      discoveryRows.forEach(d => {
        const speciesKey = getSpeciesKey(d);
        if (speciesKey) allSpecies.add(speciesKey);
        if (d.user_email) allExplorers.add(d.user_email);
        if (!d.user_email || !speciesKey) return;

        if (!userSpecies[d.user_email]) {
          userSpecies[d.user_email] = new Set();
        }
        userSpecies[d.user_email].add(speciesKey);
      });

      setActivityStats({
        observationCount: discoveryRows.length,
        speciesCount: allSpecies.size,
        explorerCount: allExplorers.size,
      });

      // Créer le classement
      const rankingEmails = Object.keys(userSpecies);
      let displayNameMap = {};

      if (rankingEmails.length > 0) {
        const { data: profileRows } = await supabase
          .from("user_profiles")
          .select("user_email, display_name")
          .in("user_email", rankingEmails);

        displayNameMap = Object.fromEntries(
          (profileRows || []).map((row) => [row.user_email, row.display_name]),
        );
      }

      const ranking = Object.entries(userSpecies)
        .map(([email, species]) => ({
          user_email: email,
          display_name: resolveDisplayName({
            displayName: displayNameMap[email],
            email,
          }),
          species_count: species.size,
        }))
        .sort((a, b) => b.species_count - a.species_count);

      setLeaderboard(ranking.slice(0, 5)); // Top 5

      // Trouver le rang de l'utilisateur
      const myRank = ranking.findIndex(r => r.user_email === userEmail);
      const newRank = myRank >= 0 ? myRank + 1 : null;

      // Déclencher la célébration si on devient champion (#1)
      if (onConquest && newRank === 1 && previousRank !== 1) {
        onConquest({ zone_id: zoneId });
      }

      setPreviousRank(newRank);
      setUserRank(newRank);
    } catch (err) {
      console.error('[ZoneDetailPanel] Erreur chargement classement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExplore = () => {
    setShowExplorer(true);
  };

  if (!zoneId) return null;

  return (
    <>
      {createPortal(
        <AnimatePresence mode="wait">
          <motion.div
            className="fixed inset-0 z-[2000] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(12px)",
              pointerEvents: showExplorer ? 'none' : 'auto' // Désactiver les événements si explorer ouvert
            }}
            onClick={onClose}
          >
            <motion.div
              className="w-full max-w-md mx-auto will-animate"
              style={{
                background: "var(--v1v-bg-card)",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
                boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
                pointerEvents: showExplorer ? 'none' : 'auto' // Désactiver les événements si explorer ouvert
              }}
              variants={modalSlideUp}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={e => e.stopPropagation()}
            >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-0.5" style={{ background: "rgba(255,255,255,0.15)", borderRadius: 1 }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" style={{ color: "var(--v1v-blue)" }} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-muted)" }}>
                  {zoneName || zoneId}
                </span>
              </div>
              <motion.button
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
              </motion.button>
            </div>

            <div className="px-5 pt-4 pb-4 space-y-3">
              {/* Leader */}
              <div
                className="p-4"
                style={{
                  background: isOwned
                    ? "linear-gradient(145deg, rgba(255,218,120,0.15) 0%, rgba(232,198,108,0.07) 45%, rgba(16,13,7,0.9) 100%)"
                    : noLeader
                    ? "rgba(59,125,232,0.06)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isOwned ? "rgba(255,218,120,0.34)" : noLeader ? "rgba(59,125,232,0.18)" : "rgba(255,255,255,0.06)"
                  }`,
                  boxShadow: isOwned ? "0 0 24px rgba(255,218,120,0.12), inset 0 0 30px rgba(255,218,120,0.045)" : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-3 h-3" style={{ color: isOwned ? "rgba(255,218,120,0.94)" : "var(--v1v-blue)" }} />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: isOwned ? "rgba(255,241,195,0.68)" : "rgba(59,125,232,0.55)" }}>
                    {isOwned ? "Présence maîtrisée" : noLeader ? hasTraces ? "Repère en émergence" : "Lieu à initier" : "Référence locale"}
                  </span>
                  {isOwned && (
                    <span
                      className="ml-auto px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em]"
                      style={{
                        background: "rgba(255,218,120,0.12)",
                        color: "rgba(255,241,195,0.95)",
                        border: "1px solid rgba(255,218,120,0.22)",
                      }}
                    >
                      {championTone}
                    </span>
                  )}
                </div>
                {noLeader ? (
                  <>
                    <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-blue)" }}>
                      {hasTraces ? "Traces déjà visibles" : "Lieu à initier"}
                    </p>
                    <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                      {championCopy}
                    </p>
                    {hasTraces && (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div
                          className="px-3 py-2"
                          style={{
                            background: "rgba(54,211,122,0.07)",
                            border: "1px solid rgba(147,255,188,0.12)",
                          }}
                        >
                          <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--v1v-fg-faint)" }}>
                            Traces
                          </p>
                          <p className="text-sm font-black mt-1" style={{ color: "rgba(147,255,188,0.9)" }}>
                            {plural(activity.observationCount, "observation")}
                          </p>
                        </div>
                        <div
                          className="px-3 py-2"
                          style={{
                            background: "rgba(59,125,232,0.07)",
                            border: "1px solid rgba(59,125,232,0.12)",
                          }}
                        >
                          <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--v1v-fg-faint)" }}>
                            Présences
                          </p>
                          <p className="text-sm font-black mt-1" style={{ color: "#3B7DE8" }}>
                            {plural(activity.explorerCount, "observateur")}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.06em]" style={{ color: isOwned ? "rgba(147,255,188,0.95)" : "var(--v1v-fg)" }}>
                          {isOwned ? "Tu maîtrises ce secteur vivant" : zone.leader.display_name}
                        </p>
                        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: isOwned ? "rgba(255,241,195,0.72)" : "var(--v1v-fg-muted)" }}>
                          {championCopy}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black number-display" style={{ color: isOwned ? "rgba(255,218,120,0.95)" : "var(--v1v-fg)" }}>
                          {leaderScore}
                        </p>
                        <p className="text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--v1v-fg-faint)" }}>espèces</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div
                        className="px-3 py-2"
                        style={{
                          background: isOwned ? "rgba(255,218,120,0.08)" : "rgba(59,125,232,0.08)",
                          border: `1px solid ${isOwned ? "rgba(255,218,120,0.16)" : "rgba(59,125,232,0.14)"}`,
                        }}
                      >
                        <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--v1v-fg-faint)" }}>
                          {isOwned ? "Avance" : "Progression"}
                        </p>
                        <p className="text-sm font-black mt-1" style={{ color: isOwned ? "rgba(255,218,120,0.95)" : "#3B7DE8" }}>
                          {isOwned
                            ? advanceLabel
                            : `${advanceLabel} pour devenir référent`}
                        </p>
                      </div>
                      <div
                        className="px-3 py-2"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--v1v-fg-faint)" }}>
                          Prochaine lecture
                        </p>
                        <p className="text-sm font-black mt-1" style={{ color: "var(--v1v-fg)" }}>
                          {isOwned ? "Consolider la maîtrise" : "Observer ici"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Classement du repère */}
              {!loading && leaderboard.length > 0 && (
                <div
                  className="p-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-3.5 h-3.5" style={{ color: isOwned ? "rgba(255,218,120,0.88)" : "var(--v1v-blue)" }} />
                    <p className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-muted)" }}>
                      Présences du secteur
                    </p>
                    {userRank && (
                      <span className="ml-auto text-[8px] font-black uppercase tracking-wider px-2 py-0.5" style={{
                        background: userRank === 1 ? "rgba(255,218,120,0.14)" : "rgba(59,125,232,0.15)",
                        color: userRank === 1 ? "rgba(255,218,120,0.92)" : "#3B7DE8",
                        borderRadius: "4px",
                      }}>
                        {userRank === 1 ? "Référent" : `#${userRank}`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {leaderboard.map((player, idx) => {
                      const isCurrentUser = player.user_email === userEmail;
                      const isChampion = idx === 0;
                      const isPersonalMastery = isChampion && isCurrentUser;
                      return (
                        <div
                          key={player.user_email}
                          className="flex items-center justify-between py-2 px-3"
                          style={{
                            background: isCurrentUser ? "rgba(45,122,31,0.12)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${isCurrentUser ? "rgba(45,122,31,0.3)" : "rgba(255,255,255,0.03)"}`,
                            borderRadius: "8px",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex-shrink-0 flex items-center justify-center"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "6px",
                                background: isPersonalMastery ? "rgba(255,218,120,0.14)" : "rgba(255,255,255,0.05)",
                                fontSize: "11px",
                                fontWeight: "black",
                                color: isPersonalMastery ? "rgba(255,218,120,0.92)" : "var(--v1v-fg-muted)",
                              }}
                            >
                              {isChampion ? "R" : `#${idx + 1}`}
                            </div>
                            <p className="text-[11px] font-black" style={{ color: isCurrentUser ? "var(--v1v-green)" : "var(--v1v-fg)" }}>
                              {isCurrentUser ? "Toi" : player.display_name}
                            </p>
                          </div>
                          <p className="text-[11px] font-black tabular-nums" style={{ color: isPersonalMastery ? "rgba(255,218,120,0.92)" : "var(--v1v-fg-muted)" }}>
                            {player.species_count} {player.species_count > 1 ? "espèces" : "espèce"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Message si pas dans le top 5 */}
                  {userRank && userRank > 5 && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--v1v-fg-muted)" }}>
                        <span>Ta présence</span>
                        <span className="font-black" style={{ color: "var(--v1v-green)" }}>
                          #{userRank} · {userScore} espèce{userScore > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Explore button */}
              <button
                onClick={handleExplore}
                className="w-full flex items-center justify-center gap-2 py-4 font-black uppercase tracking-[0.12em] text-sm transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, var(--v1v-blue), #2563EB)',
                  color: "#fff",
                  boxShadow: '0 4px 16px rgba(59,125,232,0.3)',
                }}
              >
                <Compass className="w-4 h-4" />
                Voir les espèces à découvrir ici
              </button>
            </div>
          </motion.div>
        </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Zone Explorer Modal - OUTSIDE createPortal to avoid z-index stacking */}
      {showExplorer && (
        <BlockErrorBoundary label="Exploration de zone indisponible">
          <ZoneExplorer
            zone={zone}
            userEmail={userEmail}
            onClose={() => setShowExplorer(false)}
          />
        </BlockErrorBoundary>
      )}
    </>
  );
}
