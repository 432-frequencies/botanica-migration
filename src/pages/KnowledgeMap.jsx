import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Navigation } from "lucide-react";
import KnowledgeDetailModal from "@/components/knowledge/KnowledgeDetailModal";

const CATEGORIES = [
  { key: "all", label: "All", icon: "🌍" },
  { key: "constellation", label: "Stars", icon: "⭐" },
  { key: "solar_cycle", label: "Solar", icon: "☀️" },
  { key: "lunar_cycle", label: "Lunar", icon: "🌙" },
  { key: "agriculture", label: "Farming", icon: "🌾" },
  { key: "navigation", label: "Navigate", icon: "🧭" },
  { key: "ethnobotany", label: "Plants", icon: "🌿" },
];

const RARITY_ICON = { common: "", rare: "💎", legendary: "👑" };

function KnowledgePin({ knowledge, isDiscovered, onClick, style }) {
  return (
    <button
      onClick={onClick}
      className="absolute flex flex-col items-center"
      style={{ ...style, transform: "translate(-50%, -100%)" }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
        style={{
          background: isDiscovered ? "rgba(57,255,20,0.3)" : "rgba(180,50,200,0.7)",
          border: isDiscovered ? "2px solid #39FF14" : "2px solid rgba(180,50,200,0.8)",
          boxShadow: isDiscovered ? "0 0 12px rgba(57,255,20,0.5)" : "0 0 12px rgba(180,50,200,0.5)",
          animation: "bounce 1s infinite",
        }}
      >
        {CATEGORIES.find(c => c.key === knowledge.category)?.icon || "❓"}
      </div>
      <div className="w-0.5 h-2" style={{ background: isDiscovered ? "#39FF14" : "rgba(180,50,200,0.7)" }} />
    </button>
  );
}

export default function KnowledgeMap() {
  const [category, setCategory] = useState("all");
  const [knowledge, setKnowledge] = useState([]);
  const [userEmail, setUserEmail] = useState(null);
  const [discoveredIds, setDiscoveredIds] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setUserEmail(user.email);
      const [all, prog] = await Promise.all([
        base44.entities.AncientKnowledge.filter({ is_active: true }),
        base44.entities.UserKnowledgeProgress.filter({ user_email: user.email }),
      ]);
      setKnowledge(all);
      setDiscoveredIds(new Set(prog.map((p) => p.knowledge_id)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = category === "all" ? knowledge : knowledge.filter(k => k.category === category);

  // Deterministic "pin" positions from knowledge IDs for the map placeholder
  const hashPos = (id, i) => {
    let h = 0;
    for (const c of (id || String(i))) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return { x: 10 + (h % 80), y: 10 + ((h >> 4) % 75) };
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,255,20,0.012) 2px, rgba(57,255,20,0.012) 4px)",
      }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="px-5 pt-12 pb-4" style={{ background: "var(--v1v-bg-overlay)", borderBottom: "1px solid var(--v1v-green-ghost)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-3 h-3" style={{ color: "#39FF14" }} />
            <p className="text-xs tracking-[0.6em] uppercase font-black" style={{ color: "var(--v1v-green-muted)" }}>Ancient Wisdom</p>
          </div>
          <h1 className="text-3xl font-black uppercase leading-none mb-1" style={{ color: "var(--v1v-fg)" }}>Knowledge Map</h1>
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--v1v-green-dim)" }}>Ancient wisdom scattered across the land</p>
        </div>

        {/* Category filters */}
        <div className="px-5 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className="flex-shrink-0 px-3 py-2.5 min-h-[44px] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                style={
                  category === cat.key
                    ? { background: "var(--v1v-fg)", color: "var(--v1v-bg)" }
                    : { background: "transparent", border: "1px solid var(--v1v-green-ghost)", color: "var(--v1v-green-muted)" }
                }
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Container */}
        <div className="px-5 mb-4">
          <div
            className="relative w-full overflow-hidden"
            style={{ height: "240px", background: "rgba(5,20,15,0.8)", border: "1px solid rgba(57,255,20,0.15)" }}
          >
            {/* Grid lines */}
            <div className="absolute inset-0" style={{
              backgroundImage: "linear-gradient(rgba(57,255,20,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.05) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }} />
            <p className="absolute inset-0 flex items-center justify-center text-xs tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green-ghost)" }}>
              Map integration placeholder
            </p>

            {/* Pins */}
            {filtered.slice(0, 12).map((k, i) => {
              const pos = hashPos(k.id, i);
              return (
                <KnowledgePin
                  key={k.id}
                  knowledge={k}
                  isDiscovered={discoveredIds.has(k.id)}
                  onClick={() => setSelected(k)}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                />
              );
            })}

            {/* User location */}
            <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: "#3B82F6", boxShadow: "0 0 0 6px rgba(59,130,246,0.2)", animation: "pulse 2s infinite" }} />
            </div>
          </div>
        </div>

        {/* Nearby list */}
        <div className="px-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1" style={{ background: "rgba(57,255,20,0.1)" }} />
            <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>Nearby Knowledge</p>
            <div className="h-px flex-1" style={{ background: "rgba(57,255,20,0.1)" }} />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: "#39FF14", borderTopColor: "transparent" }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs py-8" style={{ color: "rgba(57,255,20,0.3)" }}>No ancient knowledge found. Add entries in the database.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((k) => {
                const isDiscovered = discoveredIds.has(k.id);
                const cat = CATEGORIES.find(c => c.key === k.category);
                return (
                  <button
                    key={k.id}
                    onClick={() => setSelected(k)}
                    className="w-full text-left p-3 min-h-[44px] flex items-center gap-3 transition-all active:scale-[0.98]"
                    style={{
                      background: isDiscovered ? "rgba(57,255,20,0.05)" : "rgba(5,10,5,0.6)",
                      border: isDiscovered ? "1px solid rgba(57,255,20,0.25)" : "1px solid rgba(57,255,20,0.1)",
                    }}
                  >
                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-xl" style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.1)" }}>
                      {cat?.icon || "📜"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase truncate" style={{ color: "var(--v1v-fg)" }}>
                        {k.title} {RARITY_ICON[k.rarity]}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--v1v-fg-muted)" }}>{k.subtitle}</p>
                      <p className="text-xs tracking-widest uppercase" style={{ color: "var(--v1v-green-dim)" }}>{k.ancient_civilization}</p>
                    </div>
                    {isDiscovered && <span className="text-[10px]" style={{ color: "#39FF14" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-24" />
      </div>

      {selected && (
        <KnowledgeDetailModal
          knowledge={selected}
          isDiscovered={discoveredIds.has(selected.id)}
          userEmail={userEmail}
          onClose={() => setSelected(null)}
          onDiscover={() => { setDiscoveredIds(prev => new Set([...prev, selected.id])); loadData(); }}
        />
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translate(-50%, -100%); }
          50% { transform: translate(-50%, -110%); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,130,246,0.2); }
          50% { box-shadow: 0 0 0 10px rgba(59,130,246,0.05); }
        }
      `}</style>
    </div>
  );
}