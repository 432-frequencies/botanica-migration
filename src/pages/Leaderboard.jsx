import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { Trophy, Globe, MapPin, Map, Users, WifiOff } from "lucide-react";
import { useIsActivePage } from "@/lib/ActivePageContext";

const G = "#2D7A1F";
const GDB = "rgba(45,122,31,0.08)";

const SCOPE_TABS = [
  { key: "global",  label: "Global",  icon: Globe },
  { key: "country", label: "Country", icon: Map },
  { key: "region",  label: "Region",  icon: MapPin },
  { key: "friends", label: "Friends", icon: Users },
];

const METRIC_TABS = [
  { key: "total_plants",   label: "Total" },
  { key: "weekly_plants",  label: "Semaine" },
  { key: "monthly_plants", label: "Mois" },
  { key: "total_points",   label: "XP" },
];

const METRIC_LABEL = {
  total_plants: "Total Spécimens",
  weekly_plants: "Cette Semaine",
  monthly_plants: "Ce Mois",
  total_points: "XP Total",
};

function Podium({ users, field, myEmail }) {
  const [first, second, third] = users;

  const renderSlot = (entry, pos) => {
    if (!entry) return <div style={{ flex: 1 }} />;
    const isMe = entry.user_email === myEmail;
    const heights = { 1: "h-20", 2: "h-12", 3: "h-8" };
    const labels = { 1: "01", 2: "02", 3: "03" };

    return (
      <div className="flex flex-col items-center" style={{ flex: 1 }}>
        <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1 truncate w-full text-center" style={{ color: isMe ? G : "rgba(45,122,31,0.5)" }}>
          {isMe ? "YOU" : (entry.display_name?.[0]?.toUpperCase() || "?")}
        </p>
        <p className="text-xs font-black uppercase truncate w-full text-center mb-1" style={{ color: isMe ? G : "var(--v1v-fg)" }}>
          {entry.display_name}
        </p>
        <p className="text-[9px] tracking-widest mb-2" style={{ color: "rgba(45,122,31,0.5)" }}>
          {entry[field] || 0}
        </p>
        <div
          className={`w-full flex items-center justify-center ${heights[pos]} text-xs font-black tracking-[0.3em]`}
          style={{
            background: pos === 1 ? G : GDB,
            color: pos === 1 ? "var(--v1v-bg)" : "rgba(45,122,31,0.6)",
            border: pos !== 1 ? `1px solid rgba(45,122,31,0.25)` : "none",
          }}
        >
          {labels[pos]}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end gap-3 py-4">
      {renderSlot(second, 2)}
      {renderSlot(first, 1)}
      {renderSlot(third, 3)}
    </div>
  );
}

function PlayerRow({ rank, entry, field, isMe, scope }) {
  const location = scope === "global"
    ? entry.country_code || entry.country || ""
    : scope === "country"
    ? entry.region || entry.city || ""
    : entry.city || "";

  return (
    <div
      className="flex items-center gap-4 px-5 py-3"
      style={{
        borderBottom: `1px solid rgba(45,122,31,0.1)`,
        background: isMe ? GDB : "transparent",
        borderLeft: isMe ? `2px solid ${G}` : "2px solid transparent",
      }}
    >
      <span className="text-xs font-black w-6 text-right flex-shrink-0" style={{ color: rank <= 3 ? G : "rgba(45,122,31,0.3)" }}>
        {String(rank).padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase truncate" style={{ color: isMe ? G : "var(--v1v-fg)" }}>
          {entry.display_name} {isMe && <span style={{ color: "rgba(45,122,31,0.4)" }}>(you)</span>}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[8px] tracking-widest uppercase" style={{ color: "rgba(45,122,31,0.35)" }}>{entry.rank}</p>
          {location && (
            <>
              <span style={{ color: "rgba(45,122,31,0.2)" }}>·</span>
              <p className="text-[8px] tracking-wider uppercase" style={{ color: "rgba(45,122,31,0.3)" }}>{location}</p>
            </>
          )}
        </div>
      </div>
      <p className="text-sm font-black flex-shrink-0" style={{ color: isMe ? G : "var(--v1v-fg-muted)" }}>
        {entry[field] || 0}
      </p>
    </div>
  );
}

export default function Leaderboard() {
  const [scope, setScope] = useState("global");
  const [metric, setMetric] = useState("total_plants");
  const [allEntries, setAllEntries] = useState([]);
  const [myEmail, setMyEmail] = useState(null);
  const [myEntry, setMyEntry] = useState(null);
  const [friendEmails, setFriendEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const isActive = useIsActivePage("Leaderboard");
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [isActive]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyEmail(user.email);
    try {
      const [profilesRes, recvRes, sentRes] = await Promise.all([
        supabase.from('user_profiles').select('*').order('total_plants', { ascending: false }).limit(200),
        supabase.from('friend_requests').select('*').eq('receiver_email', user.email).eq('status', 'accepted'),
        supabase.from('friend_requests').select('*').eq('sender_email', user.email).eq('status', 'accepted'),
      ]);
      const data = profilesRes.data || [];
      setAllEntries(data);
      setMyEntry(data.find(e => e.user_email === user.email) || null);
      const emails = [
        ...(recvRes.data || []).map(r => r.sender_email),
        ...(sentRes.data || []).map(r => r.receiver_email),
      ];
      setFriendEmails(emails);
    } catch (e) {
      setLoadError(true);
    }
    setLoading(false);
  };

  const getScopedEntries = () => {
    if (!myEntry) return allEntries;
    if (scope === "country") return allEntries.filter(e => e.country_code && e.country_code === myEntry.country_code);
    if (scope === "region") return allEntries.filter(e => e.region && e.region === myEntry.region);
    if (scope === "friends") {
      const friendSet = new Set([...friendEmails, myEmail]);
      return allEntries.filter(e => friendSet.has(e.user_email));
    }
    return allEntries;
  };

  const scopedEntries = getScopedEntries();
  const sorted = [...scopedEntries]
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .filter(e => (e[metric] || 0) > 0);

  const myPos = sorted.findIndex(e => e.user_email === myEmail) + 1;
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const scopeLabel = scope === "global" ? "Global" : scope === "country" ? (myEntry?.country || "Country") : (myEntry?.region || "Region");

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 80% 100%, rgba(43,107,232,0.04) 0%, transparent 65%)"
      }} />

      {/* Sticky header */}
      <div
        className="px-5 pt-12 pb-3 sticky top-0 z-10"
        style={{ background: "var(--v1v-bg-overlay)", borderBottom: `1px solid rgba(45,122,31,0.2)` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />
          <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: "rgba(45,122,31,0.6)" }}>Rankings</p>
        </div>
        <h1 className="text-3xl font-black uppercase leading-none mb-4" style={{ color: G }}>
          Leaderboard
        </h1>

        {myEntry && (
          <div className="flex items-center justify-between mb-3 px-4 py-2.5" style={{ border: `1px solid rgba(45,122,31,0.25)`, background: GDB }}>
            <div>
              <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: "rgba(45,122,31,0.5)" }}>
                {scopeLabel} — Your Rank
              </p>
              <p className="text-2xl font-black" style={{ color: G }}>
                #{myPos > 0 ? String(myPos).padStart(2, "0") : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: "rgba(45,122,31,0.5)" }}>
                {sorted.length} agents
              </p>
              {myPos > 0 && sorted.length > 0 && (
                <p className="text-xs font-black uppercase" style={{ color: G }}>
                  Top {Math.ceil((myPos / sorted.length) * 100)}%
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scope tabs */}
        <div role="tablist" aria-label="Leaderboard scope" className="flex gap-2 mb-2">
          {SCOPE_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-black uppercase tracking-[0.25em] transition-all"
              style={
                scope === key
                  ? { background: G, color: "var(--v1v-bg)" }
                  : { background: "transparent", border: `1px solid rgba(45,122,31,0.25)`, color: "rgba(45,122,31,0.5)" }
                  }
                  >
                  <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Metric tabs */}
        <div role="tablist" aria-label="Leaderboard metric" className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {METRIC_TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={metric === t.key}
              onClick={() => setMetric(t.key)}
              className="flex-shrink-0 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.25em] transition-all"
              style={
                metric === t.key
                  ? { background: GDB, color: G, border: `1px solid rgba(45,122,31,0.4)` }
                  : { background: "transparent", border: `1px solid rgba(45,122,31,0.15)`, color: "rgba(45,122,31,0.4)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-8">
          <WifiOff className="w-8 h-8" style={{ color: "rgba(45,122,31,0.3)" }} />
          <p className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: "rgba(45,122,31,0.5)" }}>Connexion perdue</p>
          <button onClick={loadData} className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]" style={{ background: G, color: "var(--v1v-bg)" }}>Réessayer</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <Trophy className="w-8 h-8 mb-4" style={{ color: "rgba(45,122,31,0.25)" }} />
          <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.4)" }}>
            {scope === "friends"
              ? <>Ajoute des amis pour les voir ici.</>
              : <>{scope !== "global" ? `No agents in your ${scope} yet.` : "No agents yet."}<br />Be the first to dominate.</>
            }
          </p>
        </div>
      ) : (
        <>
          <div className="relative z-10 px-5">
            <div className="flex items-center gap-3 mt-4 mb-1">
              <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
              <p className="text-[8px] font-black tracking-[0.5em] uppercase" style={{ color: "rgba(45,122,31,0.4)" }}>
                {METRIC_LABEL[metric]} · {scopeLabel}
              </p>
              <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
            </div>
            <Podium users={top3} field={metric} myEmail={myEmail} />
          </div>

          <div className="relative z-10">
            {rest.map((entry, i) => (
              <PlayerRow
                key={entry.id}
                rank={i + 4}
                entry={entry}
                field={metric}
                isMe={entry.user_email === myEmail}
                scope={scope}
              />
            ))}
          </div>

          {myEntry && myPos > 6 && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pointer-events-none z-30">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: "var(--v1v-bg)", border: `1px solid ${G}`, boxShadow: `0 4px 20px rgba(45,122,31,0.2)` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black" style={{ color: G }}>#{String(myPos).padStart(2, "0")}</span>
                  <span className="text-xs font-black uppercase" style={{ color: "rgba(45,122,31,0.6)" }}>{myEntry.display_name} (you)</span>
                </div>
                <span className="text-xs font-black" style={{ color: G }}>{myEntry[metric] || 0}</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="h-32" />
    </div>
  );
}