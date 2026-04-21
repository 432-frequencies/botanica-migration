import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { supabase } from "@/api/supabaseClient";
import { Globe, LocateFixed, User } from "lucide-react";
import { getRarityStyle, RARITY_TIER, RARITY_LABEL, XP_BY_RARITY, ScopeIcon } from "@/lib/rarityStyles.jsx";
import { getZoneId } from "@/lib/zones";
import { useZoneLabels } from "@/lib/locationMeta";

const PlantDetailModal = lazy(() => import("@/components/collection/PlantDetailModal"));

const BASE_FILTERS = [
  { key: "community", label: "Terrain mondial", icon: Globe },
  { key: "mine",      label: "Mes traces",      icon: User },
];

const EMPTY_FEED_COPY = {
  community: {
    icon: Globe,
    title: "Le terrain est calme",
    body: "Pose la prochaine trace forte et deviens le nom que tout le monde verra passer.",
  },
  mine: {
    icon: User,
    title: "Aucune trace personnelle",
    body: "Lance un scan et grave ta première empreinte dans le feed.",
  },
  nearby: {
    icon: LocateFixed,
    title: "Rien autour de toi pour l'instant",
    body: "Sors le scanner, ouvre la zone et donne le premier signal local.",
  },
};

const FEED_DISCOVERY_FIELDS = "id,common_name,scientific_name,rarity,points_earned,user_email,latitude,longitude,created_at,created_date,discovered_date,category,thumbnail_url,photo_url";

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(Number(value)))) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 1000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return null;
  return distanceMeters < 1000
    ? `${distanceMeters}m`
    : `${(distanceMeters / 1000).toFixed(1)}km`;
}

function formatAuthor(email) {
  if (!email) return "W1LD";
  const lower = email.toLowerCase();
  if (lower === "system" || lower.includes("system") || lower.includes("admin") || lower.includes("import") || lower.includes("w1ld")) return "W1LD";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function getActivityLabel(discovery) {
  if (discovery?.rarity === "legendaire") return "Signal légendaire";
  if (discovery?.rarity === "rare") return "Trace rare";
  if (discovery?.category === "tree") return "Contrôle végétal";
  if (discovery?.category === "arachnid") return "Contact arachnide";
  if (discovery?.category === "fungus") return "Piste mycologique";
  return "Nouvelle trace";
}

function getFeedTimestamp(discovery) {
  return discovery?.created_at || discovery?.created_date || discovery?.discovered_date || null;
}

export default function CommunityFeed({ userEmail, geoCoords = null, isActive = true }) {
  const [filter, setFilter] = useState("community");
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const cache = useRef({ community: null, mine: null, nearby: null });
  const requestIdRef = useRef(0);
  const currentFilterRef = useRef("community");
  const filters = geoCoords
    ? [...BASE_FILTERS, { key: "nearby", label: "Autour de moi", icon: LocateFixed }]
    : BASE_FILTERS;
  const zoneLabels = useZoneLabels(
    discoveries.map((discovery) => getZoneId(discovery.latitude, discovery.longitude)).filter(Boolean),
  );

  useEffect(() => {
    currentFilterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    if (!isActive) {
      requestIdRef.current += 1;
      return;
    }
    if (filter === "nearby" && !geoCoords) {
      setFilter("community");
      return;
    }
    loadFilter(filter);
  }, [filter, userEmail, geoCoords?.lat, geoCoords?.lng, isActive]);

  const SESSION_TTL = 60000;
  const nearbyKey = geoCoords
    ? `${Number(geoCoords.lat).toFixed(2)}:${Number(geoCoords.lng).toFixed(2)}`
    : "no-geo";

  const getCacheScope = (f) => (f === "nearby" ? `${f}:${nearbyKey}` : f);

  const getSessionCache = (f) => {
    try {
      const raw = sessionStorage.getItem(`feed_cache_${getCacheScope(f)}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < SESSION_TTL) return data;
    } catch {}
    return null;
  };

  const setSessionCache = (f, data) => {
    try { sessionStorage.setItem(`feed_cache_${getCacheScope(f)}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
  };

  const loadFilter = async (f) => {
    const requestId = ++requestIdRef.current;
    const sessionData = getSessionCache(f);
    if (sessionData !== null) {
      if (requestId === requestIdRef.current) {
        setDiscoveries(sessionData);
        setLoading(false);
      }
      fetchData(f).then(items => {
        setSessionCache(f, items);
        cache.current[f] = items;
        if (requestId === requestIdRef.current && currentFilterRef.current === f) {
          setDiscoveries(items);
        }
      }).catch(() => {});
      return;
    }
    if (f !== "nearby" && cache.current[f] !== null) {
      if (requestId === requestIdRef.current) {
        setDiscoveries(cache.current[f]);
        setLoading(false);
      }
      fetchData(f).then(items => {
        setSessionCache(f, items);
        cache.current[f] = items;
        if (requestId === requestIdRef.current && currentFilterRef.current === f) {
          setDiscoveries(items);
        }
      }).catch(() => {});
      return;
    }
    if (requestId === requestIdRef.current) {
      setLoading(true);
    }
    const items = await fetchData(f);
    cache.current[f] = items;
    setSessionCache(f, items);
    if (requestId === requestIdRef.current) {
      setDiscoveries(items);
      setLoading(false);
    }
  };

  const fetchData = async (f) => {
    if (f === "community") {
      const { data } = await supabase
        .from('plant_discoveries')
        .select(FEED_DISCOVERY_FIELDS)
        .order('created_at', { ascending: false })
        .limit(40);
      return (data || []).filter(d => d.user_email && d.user_email !== "system");
    }

    if (f === "nearby") {
      if (!geoCoords) return [];

      const radiusKm = 3;
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((geoCoords.lat * Math.PI) / 180));

      const { data } = await supabase
        .from('plant_discoveries')
        .select(FEED_DISCOVERY_FIELDS)
        .gte('latitude', geoCoords.lat - latDelta)
        .lte('latitude', geoCoords.lat + latDelta)
        .gte('longitude', geoCoords.lng - lngDelta)
        .lte('longitude', geoCoords.lng + lngDelta)
        .order('created_at', { ascending: false })
        .limit(40);

      return (data || [])
        .filter((discovery) => discovery.user_email && discovery.user_email !== "system")
        .map((discovery) => ({
          ...discovery,
          _distanceMeters: calculateDistanceMeters(
            geoCoords.lat,
            geoCoords.lng,
            discovery.latitude,
            discovery.longitude,
          ),
        }))
        .filter((discovery) => Number.isFinite(discovery._distanceMeters) && discovery._distanceMeters <= radiusKm * 1000)
        .sort((a, b) => a._distanceMeters - b._distanceMeters || new Date(getFeedTimestamp(b)).getTime() - new Date(getFeedTimestamp(a)).getTime());
    }

    if (!userEmail) return [];
    const { data } = await supabase
      .from('plant_discoveries')
      .select(FEED_DISCOVERY_FIELDS)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "maint.";
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "maint.";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="px-5 pb-4 relative z-10">
      {selected && (
        <Suspense fallback={null}>
          <PlantDetailModal
            plant={selected}
            isPro={false}
            onClose={() => setSelected(null)}
          />
        </Suspense>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {filters.map(({ key, label, icon: Icon }) => (
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
        <div className="text-center py-10 px-5">
          {(() => {
            const emptyState = EMPTY_FEED_COPY[filter] || EMPTY_FEED_COPY.community;
            const EmptyIcon = emptyState.icon;
            return (
              <>
                <div
                  className="w-14 h-14 mx-auto mb-4 flex items-center justify-center"
                  style={{ background: "rgba(57,184,20,0.07)", border: "1px solid rgba(57,184,20,0.16)" }}
                >
                  <EmptyIcon className="w-5 h-5" style={{ color: "rgba(57,184,20,0.55)" }} />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.3em] mb-2" style={{ color: "rgba(57,184,20,0.5)" }}>
                  {emptyState.title}
                </p>
                <p className="text-[11px] leading-relaxed max-w-[280px] mx-auto" style={{ color: "rgba(57,184,20,0.4)" }}>
                  {emptyState.body}
                </p>
              </>
            );
          })()}
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          {discoveries.map((d, idx) => {
            const rs = getRarityStyle(d.rarity);
            const xp = d.points_earned || XP_BY_RARITY[d.rarity] || 10;
            const tier = RARITY_TIER[d.rarity] || "C";
            const label = RARITY_LABEL[d.rarity] || "Commune";
            const author = d.user_email === userEmail ? "Vous" : formatAuthor(d.user_email);
            const zoneId = getZoneId(d.latitude, d.longitude);
            const zoneLabel = zoneId ? (zoneLabels[zoneId] || `Zone ${zoneId.replace("_", "-")}`) : null;
            const activityLabel = getActivityLabel(d);
            const timestamp = getFeedTimestamp(d);
            const nearbyDistance = filter === "nearby" ? formatDistance(d._distanceMeters) : null;

            return (
              <div
                key={d.id}
                className="relative flex items-center gap-3 cursor-pointer active:opacity-80"
                style={{
                  borderBottom: rs.border,
                  borderTop: "none",
                  borderRight: "none",
                  background: rs.bg,
                  boxShadow: rs.glow,
                  padding: "10px 12px",
                  marginBottom: 1,
                  borderLeft: `3px solid ${rs.dot}`,
                  opacity: 0,
                  animation: "feedRowFadeIn 220ms ease-out forwards",
                  animationDelay: `${Math.min(idx, 10) * 22}ms`,
                }}
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
                    {d.scientific_name || activityLabel}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] truncate" style={{ color: "rgba(226,234,224,0.58)" }}>
                    {author}
                    {zoneLabel ? ` · ${zoneLabel}` : ""}
                    {nearbyDistance ? ` · ${nearbyDistance}` : ""}
                  </p>
                  <p className="text-[8px] font-black uppercase tracking-wider" style={{ color: "var(--v1v-fg-muted)" }}>
                    {activityLabel}
                    <span className="mx-1.5 opacity-40">·</span>
                    <span>{label}</span>
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
                    {timeAgo(timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes skeletonPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
        @keyframes feedRowFadeIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
