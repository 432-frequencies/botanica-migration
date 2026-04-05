import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { BADGES, BADGE_CATEGORIES, computeStats } from "@/utils/badges";
import { MapPin, Crown, Trophy, Leaf } from "lucide-react";
import SeasonCard from "@/components/profile/SeasonCard";

const CATEGORY_ORDER = ["diversity", "biome", "category", "behavior", "saison"];

function BadgeCard({ badge, stats }) {
  const current  = badge.progress(stats);
  const pct      = Math.round((current / badge.target) * 100);
  const unlocked = badge.condition(stats);
  const catColor = BADGE_CATEGORIES[badge.category]?.color || "var(--v1v-green)";

  return (
    <div
      style={{
        background:   unlocked ? `${catColor}12` : "var(--v1v-bg-card)",
        border:       unlocked ? `1px solid ${catColor}50` : "1px solid var(--v1v-green-ghost)",
        borderRadius: 14,
        padding:      "14px",
        opacity:      unlocked ? 1 : 0.65,
        transition:   "opacity 0.2s",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: unlocked ? `${catColor}20` : "rgba(255,255,255,0.04)",
            border: `1px solid ${unlocked ? catColor + "40" : "rgba(255,255,255,0.07)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}
        >
          {badge.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-black uppercase leading-tight" style={{ color: unlocked ? "var(--v1v-fg)" : "var(--v1v-fg-muted)" }}>
              {badge.name}
            </p>
            {unlocked && (
              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 flex-shrink-0" style={{ background: `${catColor}20`, color: catColor, borderRadius: 20, border: `1px solid ${catColor}40` }}>
                Débloqué
              </span>
            )}
          </div>
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--v1v-fg-faint)" }}>{badge.description}</p>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: unlocked ? catColor : "rgba(255,255,255,0.12)", transition: "width 0.5s ease" }} />
            </div>
            <span className="text-[9px] font-black tabular-nums" style={{ color: "var(--v1v-fg-faint)", minWidth: 28, textAlign: "right" }}>
              {current}/{badge.target}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoneSection({ userEmail }) {
  const [zones, setZones]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    supabase.from('zone_leaders').select('*').eq('user_email', userEmail)
      .then(({ data }) => { setZones(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userEmail]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-3.5 h-3.5" style={{ color: "var(--v1v-fg-faint)" }} />
        <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-faint)" }}>Zones Conquêses</p>
      </div>

      {loading ? (
        <div style={{ height: 60, background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)" }} className="loading-skeleton" />
      ) : zones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 text-center" style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--v1v-fg-faint)" }}>Aucune zone conquise</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {zones.map(z => (
            <div
              key={z.id}
              style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)", padding: "12px 14px" }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--v1v-amber)" }} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-fg)" }}>Zone #{z.zone_id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black number-display" style={{ color: "var(--v1v-amber)" }}>{z.species_count}</p>
                <p className="text-[8px] uppercase tracking-[0.08em]" style={{ color: "var(--v1v-fg-faint)" }}>espèces</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Badges() {
  const [discoveries, setDiscoveries] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [userEmail,   setUserEmail]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState("diversity");

  const [activeSeason, setActiveSeason] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email);
      Promise.all([
        supabase.from('plant_discoveries').select('*').eq('user_email', user.email),
        supabase.from('user_profiles').select('*').eq('user_email', user.email).single(),
        supabase.from('seasons').select('*').eq('is_active', true).limit(1),
      ]).then(([discRes, profileRes, seasonRes]) => {
        setDiscoveries(discRes.data || []);
        setUserProfile(profileRes.data || null);
        setActiveSeason(seasonRes.data?.[0] || null);
        setLoading(false);
      });
    });
  }, []);

  const stats = computeStats(discoveries, userProfile, activeSeason?.start_date || null);

  const badgesByCategory = {};
  for (const cat of CATEGORY_ORDER) {
    badgesByCategory[cat] = BADGES.filter(b => b.category === cat);
  }

  const totalUnlocked = BADGES.filter(b => b.condition(stats)).length;

  return (
    <div className="min-h-screen pb-32" style={{ background: "var(--v1v-bg)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 pt-4 pb-3"
        style={{ background: "var(--v1v-bg-overlay)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ color: "var(--v1v-fg-faint)" }}>Naturaliste</p>
            <h1 className="text-xl font-black uppercase leading-none" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>Badges</h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Trophy className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
            <span className="text-[11px] font-black number-display" style={{ color: "var(--v1v-fg)" }}>
              {totalUnlocked}/{BADGES.length}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 flex flex-col gap-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Espèces", value: stats.unique },
            { label: "Scans",   value: stats.total },
            { label: "Streak",  value: `${stats.streak}j` },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)", padding: "16px 10px", textAlign: "center" }}>
              <p className="text-xl font-black number-display" style={{ color: "var(--v1v-fg)" }}>{loading ? "–" : s.value}</p>
              <p className="text-[8px] uppercase tracking-[0.1em] mt-1" style={{ color: "var(--v1v-fg-faint)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Season card */}
        {activeSeason && (
          <SeasonCard userEmail={userEmail} discoveries={discoveries} />
        )}

        {/* Zone section */}
        <ZoneSection userEmail={userEmail} />

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

        {/* Tab bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {CATEGORY_ORDER.map(cat => {
            const cfg = BADGE_CATEGORIES[cat];
            const isActive = activeTab === cat;
            const unlocked = BADGES.filter(b => b.category === cat && b.condition(stats)).length;
            const total    = BADGES.filter(b => b.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 transition-all"
                style={{
                  background: isActive ? `${cfg.color}14` : "transparent",
                  border: `1px solid ${isActive ? cfg.color + "40" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 4,
                }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: isActive ? cfg.color : "var(--v1v-fg-faint)" }}>
                  {cfg.label}
                </span>
                <span className="text-[9px] font-black" style={{ color: isActive ? `${cfg.color}99` : "var(--v1v-fg-faint)" }}>
                  {unlocked}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Badge grid */}
        <div className="flex flex-col gap-2.5">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="loading-skeleton" style={{ height: 80, borderRadius: 14, border: "1px solid var(--v1v-green-ghost)" }} />
            ))
          ) : (
            (badgesByCategory[activeTab] || []).map(badge => (
              <BadgeCard key={badge.id} badge={badge} stats={stats} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}