import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { Globe, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import PlantDetailModal from "@/components/collection/PlantDetailModal";
import { getRarityStyle, RARITY_TIER, RARITY_LABEL, XP_BY_RARITY, ScopeIcon } from "@/lib/rarityStyles.jsx";

const G = "var(--v1v-green)";

const FILTERS = [
  { key: "community", label: "Community", icon: Globe },
  { key: "mine",      label: "Mine",      icon: User },
];

function formatAuthor(email) {
  if (!email) return "W1LD";
  const lower = email.toLowerCase();
  if (lower === "system" || lower.includes("system") || lower.includes("admin") || lower.includes("import") || lower.includes("w1ld")) return "W1LD";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function CommunityFeed({ userEmail }) {
  const [filter, setFilter] = useState("community");
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const cache = useRef({ community: null, mine: null });
  const navigate = useNavigate();

  useEffect(() => { loadFilter(filter); }, [filter, userEmail]);

  const SESSION_TTL = 60000;

  const getSessionCache = (f) => {
    try {
      const raw = sessionStorage.getItem(`feed_cache_${f}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < SESSION_TTL) return data;
    } catch (e) {}
    return null;
  };

  const setSessionCache = (f, data) => {
    try { sessionStorage.setItem(`feed_cache_${f}`, JSON.stringify({ data, ts: Date.now() })); } catch (e) {}
  };

  const loadFilter = async (f) => {
    const sessionData = getSessionCache(f);
    if (sessionData !== null) {
      setDiscoveries(sessionData);
      setLoading(false);
      fetchData(f).then(items => {
        setSessionCache(f, items);
        cache.current[f] = items;
        if (filter === f) setDiscoveries(items);
      });
      return;
    }
    if (cache.current[f] !== null) {
      setDiscoveries(cache.current[f]);
      setLoading(false);
      fetchData(f).then(items => {
        setSessionCache(f, items);
        cache.current[f] = items;
        if (filter === f) setDiscoveries(items);
      });
      return;
    }
    setLoading(true);
    const items = await fetchData(f);
    cache.current[f] = items;
    setSessionCache(f, items);
    setDiscoveries(items);
    setLoading(false);
  };

  const fetchData = async (f) => {
    if (f === "community") {
      const { data } = await supabase.from('plant_discoveries').select('*').order('created_at', { ascending: false }).limit(40);
      return (data || []).filter(d => d.user_email && d.user_email !== "system");
    } else {
      if (!userEmail) return [];
      const { data } = await supabase.from('plant_discoveries').select('*').eq('user_email', userEmail).order('created_at', { ascending: false }).limit(20);
      return data || [];
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="px-5 pb-4 relative z-10">
      {selected && (
        <PlantDetailModal
          plant={selected}
          isPro={false}
          onClose={() => setSelected(null)}
          onLearnMore={() => setSelected(null)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-black uppercase tracking-[0.3em] transition-all"
            style={{
              background: filter === key ? "var(--v1v-green)" : "rgba(57,184,20,0.06)",
              color: filter === key ? "var(--v1v-bg)" : "var(--v1v-green)",
              border: `1px solid ${filter === key ? "var(--v1v-green)" : "rgba(57,184,20,0.25)"}`,
            }}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        /* Skeleton list */
        <div className="flex flex-col gap-0.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-3"
              style={{ border: "1px solid rgba(57,184,20,0.08)", background: "rgba(57,184,20,0.04)", animation: "skeletonPulse 1.4s ease-in-out infinite" }}>
              <div className="w-11 h-11 flex-shrink-0" style={{ background: "rgba(57,184,20,0.08)" }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5" style={{ background: "rgba(57,184,20,0.1)", width: "55%" }} />
                <div className="h-2" style={{ background: "rgba(57,184,20,0.06)", width: "35%" }} />
                <div className="h-1.5" style={{ background: "rgba(57,184,20,0.04)", width: "45%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : discoveries.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(57,184,20,0.4)" }}>
            Aucune découverte
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          {discoveries.map((d, idx) => {
            const rs = getRarityStyle(d.rarity);
            const xp = d.points_earned || XP_BY_RARITY[d.rarity] || 10;
            const tier = RARITY_TIER[d.rarity] || "C";
            const label = RARITY_LABEL[d.rarity] || "Commune";

            return (
              <motion.div
                key={d.id}
                className="relative flex items-center gap-3 cursor-pointer active:opacity-80"
                style={{
                  borderBottom: rs.border,
                  borderLeft: rs.border,
                  borderRight: "none",
                  borderTop: "none",
                  background: rs.bg,
                  boxShadow: rs.glow,
                  padding: "10px 12px",
                  marginBottom: 1,
                  borderLeft: `3px solid ${rs.dot}`,
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                onClick={() => setSelected(d)}
              >
                {/* Scope / thumbnail */}
                <div className="flex-shrink-0 relative flex items-center justify-center"
                  style={{ width: 52, height: 52, background: "rgba(0,0,0,0.2)" }}>
                  {d.thumbnail_url || d.photo_url ? (
                    <img
                      src={d.thumbnail_url || d.photo_url}
                      alt={d.common_name}
                      className="w-full h-full object-cover absolute inset-0"
                      loading="lazy"
                      decoding="async"
                      onError={e => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : null}
                  <ScopeIcon color={rs.scopeColor} size={34} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase truncate leading-tight mb-0.5"
                    style={{ color: rs.nameColor }}>
                    {d.common_name}
                  </p>
                  <p className="text-[9px] italic truncate mb-1" style={{ color: "var(--v1v-fg-faint)" }}>
                    {d.scientific_name || formatAuthor(d.user_email)}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-wider" style={{ color: "var(--v1v-fg-muted)" }}>
                    {label}
                    <span className="mx-1.5 opacity-40">·</span>
                    <span style={{ color: rs.dot }}>+{xp} XP</span>
                  </p>
                </div>

                {/* Badge + time */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <div className="text-[7px] font-black tracking-wider px-1.5 py-0.5"
                    style={{ background: rs.badgeBg, color: rs.badgeColor }}>
                    {tier}
                  </div>
                  <p className="text-[8px] font-black" style={{ color: "var(--v1v-fg-faint)" }}>
                    {timeAgo(d.created_date)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes skeletonPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
      `}</style>
    </div>
  );
}