import { createPortal } from "react-dom";
import { X, Crown, MapPin, Compass, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { modalSlideUp } from "@/motion/variants";
import { supabase } from "@/api/supabaseClient";
import { resolveDisplayName } from "@/lib/displayName";
import { useZoneLabel } from "@/lib/locationMeta";
import ZoneExplorer from "./ZoneExplorer";

const ZONE_DEG = 0.0045;

export default function ZoneDetailPanel({ zone, onClose, userEmail, onConquest }) {
  const [showExplorer, setShowExplorer] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previousRank, setPreviousRank] = useState(null);

  const zoneId = zone?.zone_id ?? null;
  const { label: zoneName } = useZoneLabel(zoneId);
  const isOwned = zone?.leader?.user_email === userEmail;
  const userScore = zone?.userScore || 0;
  const leaderScore = zone?.leader?.species_count || 0;
  const noLeader = !zone?.leader;
  const nearestRival = leaderboard.find((player) => player.user_email !== userEmail) || null;
  const leadMargin = isOwned ? Math.max(0, leaderScore - (nearestRival?.species_count || 0)) : 0;
  const conquestGap = noLeader ? 1 : Math.max(1, leaderScore + 1 - userScore);
  const championTone = isOwned
    ? leadMargin <= 1
      ? "Zone a consolider"
      : leadMargin <= 3
      ? "Reference observee"
      : "Zone bien documentee"
    : null;
  const championCopy = isOwned
    ? leadMargin <= 1
      ? "Une observation supplementaire consoliderait immediatement ta place de reference ici."
      : leadMargin <= 3
      ? `Tu documentes ${leadMargin} espece${leadMargin > 1 ? "s" : ""} d'avance. Encore quelques observations et la zone gagnera en profondeur.`
      : `Tu apportes actuellement la contribution la plus riche ici avec ${leadMargin} especes d'avance. Continue a enrichir cette zone.`
    : noLeader
    ? "Zone en attente de premiere contribution marquante. La prochaine observation peut lancer sa documentation."
    : conquestGap === 1
    ? "Tu es a une espece de devenir la reference locale."
    : `${conquestGap} nouvelles especes ici et la reference locale evolue.`;
  const rivalName = nearestRival?.display_name || "les challengers";

  // Charger le classement de la zone
  useEffect(() => {
    setShowExplorer(false);

    if (!zoneId) {
      setLeaderboard([]);
      setUserRank(null);
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
        .select('user_email, common_name')
        .gte('latitude', centerLat - latDelta)
        .lte('latitude', centerLat + latDelta)
        .gte('longitude', centerLng - lngDelta)
        .lte('longitude', centerLng + lngDelta)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      // Compter les espèces uniques par utilisateur
      const userSpecies = {};
      (discoveries || []).forEach(d => {
        if (!userSpecies[d.user_email]) {
          userSpecies[d.user_email] = new Set();
        }
        userSpecies[d.user_email].add(d.common_name);
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
                    ? "linear-gradient(145deg, rgba(196,154,10,0.16) 0%, rgba(255,215,0,0.08) 45%, rgba(20,20,12,0.85) 100%)"
                    : noLeader
                    ? "rgba(59,125,232,0.06)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isOwned ? "rgba(255,215,0,0.36)" : noLeader ? "rgba(59,125,232,0.18)" : "rgba(255,255,255,0.06)"
                  }`,
                  boxShadow: isOwned ? "0 0 22px rgba(255,215,0,0.12), inset 0 0 30px rgba(255,215,0,0.05)" : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-3 h-3" style={{ color: isOwned ? "var(--v1v-amber)" : "var(--v1v-blue)" }} />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: isOwned ? "rgba(196,154,10,0.6)" : "rgba(59,125,232,0.55)" }}>
                    {isOwned ? "Reference locale" : noLeader ? "Zone a initier" : "Reference a atteindre"}
                  </span>
                  {isOwned && (
                    <span
                      className="ml-auto px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em]"
                      style={{
                        background: "rgba(255,215,0,0.12)",
                        color: "rgba(255,235,150,0.95)",
                        border: "1px solid rgba(255,215,0,0.2)",
                      }}
                    >
                      {championTone}
                    </span>
                  )}
                </div>
                {noLeader ? (
                  <>
                    <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-blue)" }}>
                      Premiere contribution de cette zone
                    </p>
                    <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                      {championCopy}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.06em]" style={{ color: isOwned ? "var(--v1v-amber)" : "var(--v1v-fg)" }}>
                          {isOwned ? "Vous etes la reference de cette zone" : zone.leader.display_name}
                        </p>
                        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: isOwned ? "rgba(255,235,150,0.7)" : "var(--v1v-fg-muted)" }}>
                          {championCopy}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black number-display" style={{ color: isOwned ? "var(--v1v-amber)" : "var(--v1v-fg)" }}>
                          {leaderScore}
                        </p>
                        <p className="text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--v1v-fg-faint)" }}>espèces</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div
                        className="px-3 py-2"
                        style={{
                          background: isOwned ? "rgba(255,215,0,0.08)" : "rgba(59,125,232,0.08)",
                          border: `1px solid ${isOwned ? "rgba(255,215,0,0.16)" : "rgba(59,125,232,0.14)"}`,
                        }}
                      >
                        <p className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--v1v-fg-faint)" }}>
                          {isOwned ? "Avance" : "Objectif"}
                        </p>
                        <p className="text-sm font-black mt-1" style={{ color: isOwned ? "var(--v1v-amber)" : "#3B7DE8" }}>
                          {isOwned
                            ? `+${leadMargin} sur ${rivalName}`
                            : `${conquestGap} espece${conquestGap > 1 ? "s" : ""} pour devenir referent`}
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
                          Prochaine etape
                        </p>
                        <p className="text-sm font-black mt-1" style={{ color: "var(--v1v-fg)" }}>
                          {isOwned ? "Renforcer la zone" : "Documenter ici"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Classement de la zone */}
              {!loading && leaderboard.length > 0 && (
                <div
                  className="p-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-3.5 h-3.5" style={{ color: "var(--v1v-amber)" }} />
                    <p className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-muted)" }}>
                      Contributeurs de la zone
                    </p>
                    {userRank && (
                      <span className="ml-auto text-[8px] font-black uppercase tracking-wider px-2 py-0.5" style={{
                        background: userRank === 1 ? "rgba(196,154,10,0.2)" : "rgba(59,125,232,0.15)",
                        color: userRank === 1 ? "var(--v1v-amber)" : "#3B7DE8",
                        borderRadius: "4px",
                      }}>
                        {userRank === 1 ? "Reference" : `#${userRank}`}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {leaderboard.map((player, idx) => {
                      const isCurrentUser = player.user_email === userEmail;
                      const isChampion = idx === 0;
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
                                background: isChampion ? "rgba(196,154,10,0.2)" : "rgba(255,255,255,0.05)",
                                fontSize: "11px",
                                fontWeight: "black",
                                color: isChampion ? "var(--v1v-amber)" : "var(--v1v-fg-muted)",
                              }}
                            >
                              {isChampion ? "👑" : `#${idx + 1}`}
                            </div>
                            <p className="text-[11px] font-black" style={{ color: isCurrentUser ? "var(--v1v-green)" : "var(--v1v-fg)" }}>
                              {isCurrentUser ? "Vous" : player.display_name}
                            </p>
                          </div>
                          <p className="text-[11px] font-black tabular-nums" style={{ color: isChampion ? "var(--v1v-amber)" : "var(--v1v-fg-muted)" }}>
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
                        <span>Votre classement</span>
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
                Explorer cette zone
              </button>
            </div>
          </motion.div>
        </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Zone Explorer Modal - OUTSIDE createPortal to avoid z-index stacking */}
      {showExplorer && (
        <ZoneExplorer
          zone={zone}
          userEmail={userEmail}
          onClose={() => setShowExplorer(false)}
        />
      )}
    </>
  );
}
