import { useState } from "react";
import { X, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import confetti from "canvas-confetti";

const CATEGORIES = {
  constellation: { icon: "⭐", color: "#9B7FFF" },
  solar_cycle: { icon: "☀️", color: "#FFD700" },
  lunar_cycle: { icon: "🌙", color: "#B0C4DE" },
  agriculture: { icon: "🌾", color: "#00C851" },
  navigation: { icon: "🧭", color: "#00D9FF" },
  ethnobotany: { icon: "🌿", color: "#39FF14" },
};

export default function KnowledgeDetailModal({ knowledge: k, isDiscovered, userEmail, onClose, onDiscover }) {
  const [loading, setLoading] = useState(false);

  const cat = CATEGORIES[k.category] || { icon: "📜", color: "#E8E0D0" };

  const handleDiscover = async () => {
    setLoading(true);
    try {
      await base44.entities.UserKnowledgeProgress.create({
        user_email: userEmail,
        knowledge_id: k.id,
        discovered_at: new Date().toISOString(),
        discovery_context: "knowledge_map",
      });
      // Legendary: gold confetti + heavy vibration
      if (k.rarity === "legendary") {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
        confetti({ particleCount: 120, spread: 80, colors: ["#FFD700", "#FF4500", "#FFA500", "#FF6B35"], origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 60, spread: 120, colors: ["#FFD700", "#FF4500"], origin: { y: 0.7 } }), 300);
      } else if (k.rarity === "rare") {
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
        confetti({ particleCount: 60, spread: 60, colors: ["#9B7FFF", "#00D9FF", "#FFD700"], origin: { y: 0.6 } });
      } else {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
      onDiscover?.();
    } catch (e) {}
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(180deg, #050A05 0%, #0A0520 100%)" }}>
      {/* Image Header */}
      <div className="relative flex-shrink-0" style={{ height: "200px" }}>
        {k.image_url ? (
          <img src={k.image_url} className="w-full h-full object-cover" alt={k.title} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl" style={{ background: "rgba(30,20,60,0.8)" }}>
            {cat.icon}
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, #050A05 100%)" }} />

        {/* Civilization badge */}
        {k.ancient_civilization && (
          <div className="absolute top-4 left-5 px-2 py-1" style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)" }}>
            <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: "#FFD700" }}>{k.ancient_civilization}</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="absolute bottom-4 left-5">
          <h2 className="text-xl font-black uppercase" style={{ color: "#E8E0D0" }}>{k.title}</h2>
          {k.subtitle && <p className="text-xs" style={{ color: "rgba(232,224,208,0.5)" }}>{k.subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Description */}
        {k.description && (
          <p className="text-sm leading-relaxed" style={{ color: "rgba(232,224,208,0.7)" }}>{k.description}</p>
        )}

        {/* Historical Context */}
        {k.historical_context && (
          <div className="p-3" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.1)" }}>
            <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(57,255,20,0.4)" }}>Historical Context</p>
            <p className="text-sm" style={{ color: "rgba(232,224,208,0.6)" }}>{k.historical_context}</p>
          </div>
        )}

        {/* Practical Applications */}
        {k.practical_applications && (
          <div className="p-3" style={{ background: "rgba(0,217,255,0.04)", border: "1px solid rgba(0,217,255,0.2)" }}>
            <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(0,217,255,0.6)" }}>Practical Applications</p>
            <p className="text-sm" style={{ color: "rgba(232,224,208,0.6)" }}>{k.practical_applications}</p>
          </div>
        )}

        {/* Fun Facts */}
        {k.fun_facts?.length > 0 && (
          <div>
            <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(255,215,0,0.6)" }}>Fun Facts</p>
            <div className="space-y-2">
              {k.fun_facts.map((fact, i) => (
                <div key={i} className="flex gap-2">
                  <span style={{ color: "#FFD700" }}>✦</span>
                  <p className="text-sm" style={{ color: "rgba(232,224,208,0.6)" }}>{fact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Knowledge */}
        {k.related_knowledge_ids?.length > 0 && (
          <div>
            <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(57,255,20,0.4)" }}>Related Knowledge</p>
            <div className="flex flex-wrap gap-2">
              {k.related_knowledge_ids.map((id, i) => (
                <span key={i} className="px-2 py-1 text-[8px] font-black uppercase" style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", color: "rgba(57,255,20,0.6)" }}>
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-4" style={{ background: "rgba(5,10,5,0.97)", borderTop: "1px solid rgba(57,255,20,0.1)" }}>
        {isDiscovered ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <CheckCircle className="w-4 h-4" style={{ color: "#39FF14" }} />
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>Already Discovered</p>
          </div>
        ) : (
          <button
            onClick={handleDiscover}
            disabled={loading}
            className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #FFD700, #FF4500)", color: "#050A05", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}
          >
            {loading ? "Saving..." : `Discover This Knowledge (+${k.points_awarded || 20} pts)`}
          </button>
        )}
      </div>
    </div>
  );
}