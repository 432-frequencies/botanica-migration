import { createPortal } from "react-dom";
import { X, Crown, Target, MapPin, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { modalSlideUp } from "@/motion/variants";
import ZoneExplorer from "./ZoneExplorer";

const ZONE_DEG = 0.0045;

function zoneCenterCoords(zone_id) {
  const [zLat, zLng] = zone_id.split("_").map(Number);
  return {
    lat: (zLat + 0.5) * ZONE_DEG,
    lng: (zLng + 0.5) * ZONE_DEG,
  };
}

export default function ZoneDetailPanel({ zone, onClose, userEmail }) {
  const navigate = useNavigate();
  const [showExplorer, setShowExplorer] = useState(false);

  if (!zone) return null;

  const isOwned = zone.leader?.user_email === userEmail;
  const userScore = zone.userScore || 0;
  const leaderScore = zone.leader?.species_count || 0;
  const scoreToBeat = leaderScore + 1;
  const gap = Math.max(0, scoreToBeat - userScore);
  const noLeader = !zone.leader;

  const { lat, lng } = zoneCenterCoords(zone.zone_id);

  const handleExplore = () => {
    setShowExplorer(true);
  };

  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 z-[2000] flex flex-col justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md mx-auto will-animate"
          style={{
            background: "var(--v1v-bg-card)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
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

          {/* User score */}
          {!isOwned && (
            <div
              className="p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: "var(--v1v-fg-faint)" }}>Votre score</p>
                  <p className="text-2xl font-black number-display" style={{ color: "var(--v1v-green)" }}>{userScore}</p>
                </div>
                {!noLeader && (
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: gap > 0 ? "var(--v1v-fg-muted)" : "var(--v1v-green)" }}>
                      {gap > 0 ? `−${gap} espèces` : "Conquérable"}
                    </p>
                  </div>
                )}
              </div>
              {!noLeader && leaderScore > 0 && (
                <div style={{ height: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (userScore / scoreToBeat) * 100)}%`,
                      background: gap === 0 ? "var(--v1v-amber)" : "var(--v1v-green)",
                      transition: "width 0.7s ease",
                    }}
                  />
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

      {/* Zone Explorer Modal */}
      {showExplorer && (
        <ZoneExplorer
          zone={zone}
          userEmail={userEmail}
          onClose={() => setShowExplorer(false)}
        />
      )}
    </motion.div>
    </AnimatePresence>,
    document.body
  );
}