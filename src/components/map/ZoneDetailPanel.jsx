import { createPortal } from "react-dom";
import { X, Crown, Target, MapPin, Compass, Trophy, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { modalSlideUp } from "@/motion/variants";
import { supabase } from "@/api/supabaseClient";
import ZoneExplorer from "./ZoneExplorer";

const ZONE_DEG = 0.0045;

function zoneCenterCoords(zone_id) {
  const [zLat, zLng] = zone_id.split("_").map(Number);
  return {
    lat: (zLat + 0.5) * ZONE_DEG,
    lng: (zLng + 0.5) * ZONE_DEG,
  };
}

export default function ZoneDetailPanel({ zone, onClose, userEmail, onConquest }) {
  const navigate = useNavigate();
  const [showExplorer, setShowExplorer] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  if (!zone) return null;

  const isOwned = zone.leader?.user_email === userEmail;
  const userScore = zone.userScore || 0;
  const leaderScore = zone.leader?.species_count || 0;
  const scoreToBeat = leaderScore + 1;
  const gap = Math.max(0, scoreToBeat - userScore);
  const noLeader = !zone.leader;

  const { lat, lng } = zoneCenterCoords(zone.zone_id);

  // Charger le classement de la zone
  useEffect(() => {
    loadZoneLeaderboard();
  }, [zone.zone_id, userEmail]);

  const loadZoneLeaderboard = async () => {
    setLoading(true);
    try {
      // Récupérer toutes les découvertes dans cette zone
      const ZONE_SIZE_DEG = 0.0045;
      const [zLat, zLng] = zone.zone_id.split('_').map(Number);
      const centerLat = (zLat + 0.5) * ZONE_SIZE_DEG;
      const centerLng = (zLng + 0.5) * ZONE_SIZE_DEG;

      const latDelta = ZONE_SIZE_DEG / 2;
      const lngDelta = ZONE_SIZE_DEG / 2;

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
      const ranking = Object.entries(userSpecies)
        .map(([email, species]) => ({
          user_email: email,
          display_name: email.split('@')[0],
          species_count: species.size,
        }))
        .sort((a, b) => b.species_count - a.species_count);

      setLeaderboard(ranking.slice(0, 5)); // Top 5

      // Trouver le rang de l'utilisateur
      const myRank = ranking.findIndex(r => r.user_email === userEmail);
      setUserRank(myRank >= 0 ? myRank + 1 : null);
    } catch (err) {
      console.error('[ZoneDetailPanel] Erreur chargement classement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExplore = () => {
    setShowExplorer(true);
  };

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
                  Zone {zone.zone_id}
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
                  background: isOwned ? "rgba(196,154,10,0.07)" : noLeader ? "rgba(59,125,232,0.06)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isOwned ? "rgba(196,154,10,0.25)" : noLeader ? "rgba(59,125,232,0.18)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-3 h-3" style={{ color: isOwned ? "var(--v1v-amber)" : "var(--v1v-blue)" }} />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: isOwned ? "rgba(196,154,10,0.6)" : "rgba(59,125,232,0.55)" }}>
                    {isOwned ? "Vous êtes Légende" : noLeader ? "Zone libre" : "Légende actuel"}
                  </span>
                </div>
                {noLeader ? (
                  <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-blue)" }}>
                    Premier à conquérir cette zone
                  </p>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black uppercase tracking-[0.06em]" style={{ color: isOwned ? "var(--v1v-amber)" : "var(--v1v-fg)" }}>
                      {zone.leader.display_name}
                    </p>
                    <div className="text-right">
                      <p className="text-2xl font-black number-display" style={{ color: isOwned ? "var(--v1v-amber)" : "var(--v1v-fg)" }}>
                        {leaderScore}
                      </p>
                      <p className="text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--v1v-fg-faint)" }}>espèces</p>
                    </div>
                  </div>
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
                      Top Explorateurs
                    </p>
                    {userRank && (
                      <span className="ml-auto text-[8px] font-black uppercase tracking-wider px-2 py-0.5" style={{
                        background: userRank === 1 ? "rgba(196,154,10,0.2)" : "rgba(59,125,232,0.15)",
                        color: userRank === 1 ? "var(--v1v-amber)" : "#3B7DE8",
                        borderRadius: "4px",
                      }}>
                        {userRank === 1 ? "🏆 Champion" : `#${userRank}`}
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