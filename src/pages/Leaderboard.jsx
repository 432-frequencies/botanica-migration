import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { createApiUrl } from "@/lib/app-config";
import { resolveDisplayName } from "@/lib/displayName";
import { Award, Globe, MapPin, Map, Users, WifiOff } from "lucide-react";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { resolveLocationMeta } from "@/lib/locationMeta";
import { useLocation } from "react-router-dom";
import { translateLevelLabel, useTranslation } from "@/lib/i18n";

const G = "var(--v1v-blue)";
const GDB = "var(--v1v-blue-bg)";
const G_BORDER = "var(--v1v-blue-border)";
const G_MUTED = "var(--v1v-fg-muted)";
const G_FAINT = "var(--v1v-fg-faint)";
const SUN = "var(--v1v-amber)";

const SCOPE_TABS = [
  { key: "global", labelKey: "leaderboard.world", icon: Globe },
  { key: "country", labelKey: "leaderboard.country", icon: Map },
  { key: "region", labelKey: "leaderboard.region", icon: MapPin },
  { key: "friends", labelKey: "leaderboard.friends", icon: Users },
];

const METRIC_TABS = [
  { key: "total_plants", labelKey: "leaderboard.species" },
  { key: "weekly_plants", labelKey: "leaderboard.sevenDays" },
  { key: "monthly_plants", labelKey: "leaderboard.thirtyDays" },
  { key: "total_points", labelKey: "leaderboard.contribution" },
];

const METRIC_LABEL = {
  total_plants: "leaderboard.metricSpecies",
  weekly_plants: "leaderboard.metricWeek",
  monthly_plants: "leaderboard.metricMonth",
  total_points: "leaderboard.metricContribution",
};

function normalizeScopeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function hydrateEntryLocation(entry, runtimeLocation) {
  if (!entry) return null;
  return {
    ...entry,
    country: entry.country || runtimeLocation?.country || "",
    country_code: entry.country_code || runtimeLocation?.country_code || "",
    region: entry.region || runtimeLocation?.region || "",
    city: entry.city || runtimeLocation?.city || "",
  };
}

function buildFallbackEntry(user, profile, runtimeLocation) {
  if (!user) return null;
  return hydrateEntryLocation({
    user_id: user.id,
    identity_key: `uid:${user.id}`,
    display_name: resolveDisplayName({
      displayName: profile?.display_name,
      fullName: user.user_metadata?.full_name,
      email: user.email,
    }),
    rank: profile?.rank || "Explorateur",
    total_plants: profile?.total_plants || 0,
    weekly_plants: 0,
    monthly_plants: 0,
    total_points: profile?.total_points || profile?.xp || 0,
    plant_count: profile?.total_plants || 0,
  }, runtimeLocation);
}

async function resolveCurrentUserLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  const coords = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { maximumAge: 300000, timeout: 6000, enableHighAccuracy: true },
    );
  });

  return resolveLocationMeta(coords);
}

function Podium({ users, field, myIdentityKey, t }) {
  const [first, second, third] = users;

  const renderSlot = (entry, pos) => {
    if (!entry) return <div style={{ flex: 1 }} />;
    const isMe = entry.identity_key === myIdentityKey;
    const heights = { 1: "h-20", 2: "h-12", 3: "h-8" };
    const labels = { 1: "01", 2: "02", 3: "03" };

    return (
      <div className="flex flex-col items-center" style={{ flex: 1 }}>
        <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1 truncate w-full text-center" style={{ color: isMe ? G : G_FAINT }}>
          {isMe ? t("leaderboard.you").toUpperCase() : (entry.display_name?.[0]?.toUpperCase() || "?")}
        </p>
        <p className="text-xs font-black uppercase truncate w-full text-center mb-1" style={{ color: isMe ? G : "var(--v1v-fg)" }}>
          {entry.display_name}
        </p>
        <p className="text-[9px] tracking-widest mb-2" style={{ color: G_MUTED }}>
          {entry[field] || 0}
        </p>
        <div
          className={`w-full flex items-center justify-center ${heights[pos]} text-xs font-black tracking-[0.3em]`}
          style={{
            background: pos === 1 ? SUN : GDB,
            color: pos === 1 ? "var(--v1v-bg)" : G_MUTED,
            border: pos !== 1 ? `1px solid ${G_BORDER}` : "none",
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

function PlayerRow({ rank, entry, field, isMe, scope, t, language }) {
  const location = scope === "global"
    ? entry.country_code || entry.country || ""
    : scope === "country"
    ? entry.region || entry.city || ""
    : entry.city || "";

  return (
    <div
      className="flex items-center gap-4 px-5 py-3"
      style={{
        borderBottom: `1px solid ${G_BORDER}`,
        background: isMe ? GDB : "transparent",
        borderLeft: isMe ? `2px solid ${G}` : "2px solid transparent",
      }}
    >
      <span className="text-xs font-black w-6 text-right flex-shrink-0" style={{ color: rank <= 3 ? G : G_FAINT }}>
        {String(rank).padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase truncate" style={{ color: isMe ? G : "var(--v1v-fg)" }}>
          {entry.display_name} {isMe && <span style={{ color: G_MUTED }}>({t("leaderboard.you")})</span>}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[8px] tracking-widest uppercase" style={{ color: G_MUTED }}>{translateLevelLabel(entry.rank, language)}</p>
          {location && (
            <>
              <span style={{ color: G_FAINT }}>·</span>
              <p className="text-[8px] tracking-wider uppercase" style={{ color: G_FAINT }}>{location}</p>
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
  const { t, language } = useTranslation();
  const location = useLocation();
  const [scope, setScope] = useState("global");
  const [metric, setMetric] = useState("total_plants");
  const [allEntries, setAllEntries] = useState([]);
  const [myIdentityKey, setMyIdentityKey] = useState(null);
  const [myEntry, setMyEntry] = useState(null);
  const [derivedLocation, setDerivedLocation] = useState(null);
  const [friendIdentityKeys, setFriendIdentityKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const isActive = useIsActivePage("Leaderboard");
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedScope = params.get("scope");
    const requestedMetric = params.get("metric");

    if (requestedScope && SCOPE_TABS.some((tab) => tab.key === requestedScope)) {
      setScope(requestedScope);
    }

    if (requestedMetric && METRIC_TABS.some((tab) => tab.key === requestedMetric)) {
      setMetric(requestedMetric);
    }
  }, [location.search]);

  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [isActive]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    const [
      { data: { session } },
      { data: { user } },
    ] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    if (!user || !session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(createApiUrl("/api/leaderboard"), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || t("leaderboard.loadError");
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
        console.warn("[Leaderboard] Chargement partiel:", data.warnings);
      }

      const leaderboardEntries = Array.isArray(data?.entries) ? data.entries : [];
      const apiMyEntry = data?.me?.entry || null;
      const apiMyIdentityKey = data?.me?.identity_key || `uid:${user.id}`;
      let runtimeLocation = null;

      const needsRuntimeLocation = !apiMyEntry || !apiMyEntry.country_code || !apiMyEntry.region || !apiMyEntry.city;

      if (needsRuntimeLocation) {
        try {
          runtimeLocation = await resolveCurrentUserLocation();
        } catch {
          runtimeLocation = null;
        }
      }

      const mergedMyEntry = hydrateEntryLocation(
        apiMyEntry || buildFallbackEntry(user, null, runtimeLocation),
        runtimeLocation,
      );
      const nextEntries = leaderboardEntries.some((entry) => entry.identity_key === apiMyIdentityKey)
        ? leaderboardEntries.map((entry) => (
          entry.identity_key === apiMyIdentityKey && mergedMyEntry
            ? { ...entry, ...mergedMyEntry }
            : entry
        ))
        : (mergedMyEntry ? [mergedMyEntry, ...leaderboardEntries] : leaderboardEntries);

      setDerivedLocation(runtimeLocation);
      setAllEntries(nextEntries);
      setMyEntry(mergedMyEntry);
      setMyIdentityKey(apiMyIdentityKey);
      setFriendIdentityKeys(Array.isArray(data?.me?.friend_identity_keys) ? data.me.friend_identity_keys : []);
    } catch (error) {
      console.error("[Leaderboard] load failed:", error);
      const status = error?.status || 0;
      const isNetworkError = /failed to fetch|network|load failed/i.test(error?.message || "");
      setLoadError({
        title: status === 401 ? t("home.sessionExpired") : isNetworkError ? t("home.serverUnavailable") : t("leaderboard.loadError"),
        message: status === 401
          ? t("home.sessionExpiredBody")
          : isNetworkError
            ? t("home.offlineBody")
            : error?.message || t("home.serverError"),
      });
    }
    setLoading(false);
  };

  const hydratedEntries = allEntries.map((entry) =>
    entry.identity_key === myIdentityKey ? hydrateEntryLocation(entry, derivedLocation) : entry,
  );
  const activeMyEntry = hydrateEntryLocation(myEntry, derivedLocation);

  const getScopedEntries = () => {
    if (!activeMyEntry) return hydratedEntries;

    if (scope === "country") {
      const myCountryCode = normalizeScopeValue(activeMyEntry.country_code);
      const myCountry = normalizeScopeValue(activeMyEntry.country);
      const scoped = hydratedEntries.filter((entry) => {
        const entryCountryCode = normalizeScopeValue(entry.country_code);
        const entryCountry = normalizeScopeValue(entry.country);
        return (myCountryCode && entryCountryCode === myCountryCode) || (!myCountryCode && myCountry && entryCountry === myCountry);
      });
      return scoped.length > 0 ? scoped : [activeMyEntry];
    }

    if (scope === "region") {
      const myRegion = normalizeScopeValue(activeMyEntry.region || activeMyEntry.city);
      const scoped = hydratedEntries.filter((entry) => {
        const entryRegion = normalizeScopeValue(entry.region || entry.city);
        return myRegion && entryRegion === myRegion;
      });
      return scoped.length > 0 ? scoped : [activeMyEntry];
    }

    if (scope === "friends") {
      const friendSet = new Set([...friendIdentityKeys, myIdentityKey].filter(Boolean));
      return hydratedEntries.filter((entry) => friendSet.has(entry.identity_key));
    }
    return hydratedEntries;
  };

  const scopedEntries = getScopedEntries();
  const sorted = [...scopedEntries]
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .filter((entry) => (entry[metric] || 0) > 0);

  const myPos = sorted.findIndex((entry) => entry.identity_key === myIdentityKey) + 1;
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const scopeLabel = scope === "global"
    ? t("leaderboard.world")
    : scope === "country"
      ? (activeMyEntry?.country || t("leaderboard.country"))
      : scope === "friends"
        ? t("leaderboard.friends")
        : (activeMyEntry?.region || activeMyEntry?.city || t("leaderboard.region"));

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 80% 100%, rgba(21,101,192,0.08) 0%, transparent 65%), radial-gradient(ellipse 40% 35% at 0% 0%, rgba(63,163,77,0.06) 0%, transparent 70%)"
      }} />

      {/* Sticky header */}
      <div
        className="px-5 pt-12 pb-3 sticky top-0 z-10"
        style={{ background: "var(--v1v-bg-overlay)", borderBottom: `1px solid ${G_BORDER}` }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />
          <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: G_MUTED }}>{t("leaderboard.contribution")}</p>
        </div>
        <h1 className="text-3xl font-black uppercase leading-none mb-4" style={{ color: G }}>
          {t("leaderboard.title")}
        </h1>

        {activeMyEntry && (
          <div className="flex items-center justify-between mb-3 px-4 py-2.5" style={{ border: `1px solid ${G_BORDER}`, background: GDB }}>
            <div>
              <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: G_MUTED }}>
                {scopeLabel} — {t("leaderboard.currentPosition")}
              </p>
              <p className="text-2xl font-black" style={{ color: G }}>
                #{myPos > 0 ? String(myPos).padStart(2, "0") : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: G_MUTED }}>
                {sorted.length} {t("leaderboard.observers")}
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
          {SCOPE_TABS.map(({ key, labelKey, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-black uppercase tracking-[0.25em] transition-all"
              style={
                scope === key
                  ? { background: G, color: "var(--v1v-bg)" }
                  : { background: "transparent", border: `1px solid ${G_BORDER}`, color: G_MUTED }
                  }
                  >
                  <Icon className="w-3 h-3" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Metric tabs */}
        <div role="tablist" aria-label="Leaderboard metric" className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {METRIC_TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={metric === tab.key}
              onClick={() => setMetric(tab.key)}
              className="flex-shrink-0 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.25em] transition-all"
              style={
                metric === tab.key
                  ? { background: GDB, color: G, border: `1px solid ${G_BORDER}` }
                  : { background: "transparent", border: `1px solid ${G_BORDER}`, color: G_MUTED }
              }
            >
              {t(tab.labelKey)}
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
          <WifiOff className="w-8 h-8" style={{ color: G_FAINT }} />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: G_MUTED }}>
              {loadError.title}
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: G_FAINT }}>
              {loadError.message}
            </p>
          </div>
          <button onClick={loadData} className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]" style={{ background: G, color: "var(--v1v-bg)" }}>{t("common.retry")}</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <Award className="w-8 h-8 mb-4" style={{ color: G_FAINT }} />
          <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: G_MUTED }}>
            {scope === "friends"
              ? t("leaderboard.noFriends")
              : t("leaderboard.noData")
            }
          </p>
        </div>
      ) : (
        <>
          <div className="relative z-10 px-5">
            <div className="flex items-center gap-3 mt-4 mb-1">
              <div className="h-px flex-1" style={{ background: G_BORDER }} />
              <p className="text-[8px] font-black tracking-[0.5em] uppercase" style={{ color: G_MUTED }}>
                {t(METRIC_LABEL[metric])} · {scopeLabel}
              </p>
              <div className="h-px flex-1" style={{ background: G_BORDER }} />
            </div>
            <Podium users={top3} field={metric} myIdentityKey={myIdentityKey} t={t} />
          </div>

          <div className="relative z-10">
            {rest.map((entry, i) => (
              <PlayerRow
                key={entry.id || entry.identity_key}
                rank={i + 4}
                entry={entry}
                field={metric}
                isMe={entry.identity_key === myIdentityKey}
                scope={scope}
                t={t}
                language={language}
              />
            ))}
          </div>

          {activeMyEntry && myPos > 6 && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pointer-events-none z-30">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: "var(--v1v-bg)", border: `1px solid ${G}`, boxShadow: `0 4px 20px rgba(21,101,192,0.18)` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black" style={{ color: G }}>#{String(myPos).padStart(2, "0")}</span>
                  <span className="text-xs font-black uppercase" style={{ color: G_MUTED }}>{activeMyEntry.display_name} ({t("leaderboard.you")})</span>
                </div>
                <span className="text-xs font-black" style={{ color: G }}>{activeMyEntry[metric] || 0}</span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="h-32" />
    </div>
  );
}
