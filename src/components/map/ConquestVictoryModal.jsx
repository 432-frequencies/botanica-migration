import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Share2, X, MapPin } from "lucide-react";
import html2canvas from "html2canvas";

export default function ConquestVictoryModal({ zone, userDisplayName, onClose }) {
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (zone) {
      document.body.style.overflow = "hidden";
    }
    return () => { document.body.style.overflow = ""; };
  }, [zone]);

  if (!zone) return null;

  const handleShare = async () => {
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0A140A",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      const file = new File([blob], "w1ld-zone-conquise.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Zone conquise sur W1LD",
          text: `🌿 Je suis la nouvelle Légende de la zone ${zone.zone_id} sur W1LD Field OS !`,
          files: [file],
        });
      } else {
        // Fallback: download image
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "w1ld-zone-conquise.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // silently fail
    }
    setSharing(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-xs flex flex-col gap-4"
        >
          {/* Share card (captured) */}
          <div
            ref={cardRef}
            className="relative overflow-hidden px-7 pt-8 pb-7"
            style={{
              background: "#0A120A",
              border: "1px solid rgba(196,154,10,0.35)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
          >
            {/* Ambient */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(196,154,10,0.06) 0%, transparent 70%)" }}
            />

            {/* Crown */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="flex justify-center mb-5"
            >
              <div
                className="w-14 h-14 flex items-center justify-center"
                style={{ background: "rgba(196,154,10,0.08)", border: "1px solid rgba(196,154,10,0.25)" }}
              >
                <Crown className="w-7 h-7" style={{ color: "var(--v1v-amber)" }} />
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-1"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-2" style={{ color: "rgba(196,154,10,0.5)" }}>W1LD Field OS</p>
              <h1 className="text-2xl font-black uppercase leading-none mb-2" style={{ color: "var(--v1v-amber)", letterSpacing: "0.06em" }}>Zone conquise</h1>
              <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--v1v-fg-muted)" }}>Tu es la nouvelle Légende</p>
            </motion.div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1" style={{ background: "rgba(196,154,10,0.18)" }} />
              <MapPin className="w-3 h-3" style={{ color: "rgba(196,154,10,0.4)" }} />
              <div className="h-px flex-1" style={{ background: "rgba(196,154,10,0.18)" }} />
            </div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-center"
            >
              <p className="text-4xl font-black number-display mb-1" style={{ color: "var(--v1v-amber)" }}>{zone.userScore}</p>
              <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(196,154,10,0.45)" }}>espèces dans cette zone</p>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] mt-3" style={{ color: "var(--v1v-fg-muted)" }}>
                {userDisplayName || "Agent W1LD"}
              </p>
            </motion.div>

            {/* Badge */}
            <div
              className="absolute top-3 right-3 px-2 py-1 text-[7px] font-black uppercase tracking-[0.15em]"
              style={{ background: "rgba(196,154,10,0.1)", border: "1px solid rgba(196,154,10,0.22)", color: "rgba(196,154,10,0.6)" }}
            >
              Légende
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-black uppercase tracking-[0.15em]"
              style={{ background: "var(--v1v-amber)", color: "#08100A" }}
            >
              <Share2 className="w-3.5 h-3.5" />
              {sharing ? "Export…" : "Partager"}
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={onClose}
              className="w-12 flex items-center justify-center"
              style={{ border: "1px solid rgba(255,255,255,0.07)", color: "var(--v1v-fg-faint)", background: "rgba(255,255,255,0.03)" }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}