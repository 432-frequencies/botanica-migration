import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { getUserDiscoveries, getUserProfile } from "@/api/getUserProfile";
import { getGhostSpecies } from "@/api/inaturalist";
import { Search, Database, Leaf, RefreshCw, WifiOff, Ghost } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import PlantCard from "@/components/collection/PlantCard";
import GhostSpeciesCard from "@/components/collection/GhostSpeciesCard";
import GhostSpeciesModal from "@/components/collection/GhostSpeciesModal";
import PullToRefresh from "@/components/shared/PullToRefresh";
import PageIntro from "@/components/shared/PageIntro";
import NoticePanel from "@/components/shared/NoticePanel";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { hasLaunchAccess } from "@/lib/app-config";
import { usePremium } from "@/lib/PremiumContext";
import { useTranslation } from "@/lib/i18n";

const PlantDetailModal = lazy(() => import("@/components/collection/PlantDetailModal"));

const FILTERS = [
  { key: "all", labelKey: "journal.filterAll" },
  { key: "plant", labelKey: "journal.filterPlant" },
  { key: "bird", labelKey: "journal.filterBird" },
  { key: "fungus", labelKey: "journal.filterFungus" },
  { key: "tree", labelKey: "journal.filterTree" },
  { key: "rock", labelKey: "journal.filterRock" },
  { key: "insect", labelKey: "journal.filterInsect" },
  { key: "arachnid", labelKey: "journal.filterArachnid" },
  { key: "edible", labelKey: "journal.filterEdible" },
  { key: "toxic", labelKey: "journal.filterToxic" },
];

function applyFilter(plants, search, filter) {
  let f = plants;
  if (search) f = f.filter(p =>
    p.common_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.scientific_name?.toLowerCase().includes(search.toLowerCase())
  );
  if (filter === "edible") f = f.filter(p => p.is_edible);
  else if (filter === "toxic") f = f.filter(p => p.is_toxic);
  else if (["plant","bird","rock","fungus","tree","insect","arachnid"].includes(filter)) f = f.filter(p => (p.category || "plant") === filter);
  else if (filter !== "all") f = f.filter(p => p.rarity === filter);
  return f;
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)" }}>
      <div style={{ height: 170, background: "var(--v1v-green-bg)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2">
        <div style={{ height: 6, width: "40%", borderRadius: 4, background: "var(--v1v-green-bg)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
        <div style={{ height: 10, width: "85%", borderRadius: 4, background: "var(--v1v-green-bg)", animation: "skeletonPulse 1.4s ease-in-out infinite", animationDelay: "80ms" }} />
        <div style={{ height: 8, width: "60%", borderRadius: 4, background: "var(--v1v-green-bg)", animation: "skeletonPulse 1.4s ease-in-out infinite", animationDelay: "160ms" }} />
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 80}ms` }}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

function ModalFallback({ t }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="px-6 py-5 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)" }}>
        <div className="w-7 h-7 rounded-full border-2 mx-auto mb-3 animate-spin" style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }} />
        <p className="text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: "var(--v1v-green-faint)" }}>{t("journal.openingSheet")}</p>
      </div>
    </div>
  );
}

export default function Collection() {
  const { t } = useTranslation();
  const [allPlants, setAllPlants]   = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError]   = useState(null);
  const [loadNotice, setLoadNotice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible]       = useState(false);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("all");
  const [selected, setSelected]     = useState(null);
  const [profileIsPro, setProfileIsPro] = useState(false);
  const { isPremium } = usePremium();

  // Ghost species state
  const [viewMode, setViewMode] = useState("mine"); // "mine" | "ghosts" | "all"
  const [ghostSpecies, setGhostSpecies] = useState([]);
  const [ghostsLoading, setGhostsLoading] = useState(false);
  const [selectedGhost, setSelectedGhost] = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = async (background = false) => {
    if (!background) setLoadError(null);
    if (background) setRefreshing(true);
    setLoadNotice(null);

    try {
      const [discoveryData, profileResult] = await Promise.allSettled([
        getUserDiscoveries(null, { forceFresh: background }),
        getUserProfile({ includeDiscoveries: false, forceFresh: background }),
      ]);

      const all = discoveryData.status === "fulfilled"
        ? (discoveryData.value || [])
        : [];
      if (discoveryData.status === "fulfilled") {
        setAllPlants(all);
      } else if (!allPlants.length) {
        setLoadError(t("journal.loadError"));
        setDataLoaded(true);
        setRefreshing(false);
        return;
      } else {
        setLoadNotice(t("journal.syncFailed"));
      }

      if (profileResult.status === "fulfilled") {
        setProfileIsPro(Boolean(profileResult.value?.profile?.is_pro));
      } else {
        setLoadNotice((prev) => prev || t("journal.profilePartial"));
      }
    } catch {
      if (!allPlants.length) {
        setLoadError(t("journal.loadError"));
        setDataLoaded(true);
        setRefreshing(false);
        return;
      }
      setLoadNotice(t("journal.interrupted"));
    }

    if (!dataLoaded || !background) {
      setDataLoaded(true);
      setTimeout(() => setVisible(true), 20);
    }
    setRefreshing(false);
  };

  const isActive = useIsActivePage("Collection");
  const hasLoadedRef = useRef(null);
  useEffect(() => {
    if (!isActive) return;
    // First load: full load with cache check
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadData(false);
    } else {
      // Subsequent activations: background refresh to get new discoveries
      loadData(true);
    }
  }, [isActive]);

  // Load ghost species when switching to ghost/all mode
  const loadGhostSpecies = async () => {
    if (ghostSpecies.length > 0) return; // Already loaded

    // Try to get position
    if (!navigator.geolocation) return;

    setGhostsLoading(true);
    try {
      // Check cache first (15 min TTL)
      const cached = localStorage.getItem('w1ld_ghost_species');
      if (cached) {
        const { data, timestamp, lat, lng } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 15 * 60 * 1000) { // 15 min
          setGhostSpecies(data);
          setGhostsLoading(false);
          return;
        }
      }

      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const result = await getGhostSpecies(latitude, longitude, allPlants);
          const ghosts = result.ghosts || [];

          setGhostSpecies(ghosts);

          // Cache for 15 min
          localStorage.setItem('w1ld_ghost_species', JSON.stringify({
            data: ghosts,
            timestamp: Date.now(),
            lat: latitude,
            lng: longitude
          }));
        } catch (err) {
          console.error('Failed to load ghost species:', err);
        } finally {
          setGhostsLoading(false);
        }
      }, () => {
        setGhostsLoading(false);
      });
    } catch (err) {
      console.error('Ghost species error:', err);
      setGhostsLoading(false);
    }
  };

  useEffect(() => {
    if ((viewMode === 'ghosts' || viewMode === 'all') && dataLoaded) {
      loadGhostSpecies();
    }
  }, [viewMode, dataLoaded]);

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = applyFilter(allPlants, search, filter);
  const isPro = hasLaunchAccess({ is_pro: profileIsPro }, isPremium);

  const handleSearch = (val) => { setSearch(val); };
  const handleFilter = (key) => {
    setFilter(key);
    try {
      document.querySelector(".overflow-y-auto")?.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)", overscrollBehavior: "contain" }}>

        {selected && (
          <Suspense fallback={<ModalFallback t={t} />}>
            <PlantDetailModal
              plant={selected}
              isPro={isPro}
              onClose={() => setSelected(null)}
            />
          </Suspense>
        )}

        {selectedGhost && (
          <GhostSpeciesModal
            species={selectedGhost}
            onClose={() => setSelectedGhost(null)}
          />
        )}

        <PullToRefresh onRefresh={() => loadData(true)}>

          {/* Ambient */}
          <div className="pointer-events-none fixed inset-0 z-0" style={{
            background: "radial-gradient(ellipse 60% 40% at 90% 0%, rgba(43,107,232,0.04) 0%, transparent 65%)"
          }} />

          {/* ── Sticky header ── */}
          <div
            className="sticky top-0 z-10"
            style={{ background: "var(--v1v-bg-overlay)", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(24px)" }}
          >
            <PageIntro
              className="pb-3"
              kicker={t("journal.kicker")}
              title={t("journal.title")}
              subtitle={t("journal.subtitle")}
              rightSlot={(
                <>
                  {refreshing && (
                    <span className="v1v-pill">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Sync
                    </span>
                  )}
                  {allPlants.length > 0 && (
                    <span className="text-xs font-black number-display" style={{ color: "var(--v1v-fg-faint)" }}>{allPlants.length}</span>
                  )}
                </>
              )}
            />

            {/* Search */}
            <div className="relative px-4 mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--v1v-fg-faint)" }} />
              <input
                placeholder={t("journal.search")}
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 text-sm outline-none"
                style={{
                  height: 40,
                  background: "var(--v1v-surface-1)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  color: "var(--v1v-fg)",
                  fontSize: 13,
                }}
              />
            </div>

            {/* View mode toggle */}
            <div className="flex gap-2 px-4 mb-3">
              <button
                onClick={() => setViewMode("mine")}
                className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all active:scale-95"
                style={{
                  borderRadius: 8,
                  ...(viewMode === "mine"
                    ? { background: "var(--v1v-green)", color: "var(--v1v-bg)" }
                    : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "var(--v1v-fg-muted)" }
                  ),
                }}
              >
                Mes Découvertes
              </button>
              <button
                onClick={() => setViewMode("ghosts")}
                className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  borderRadius: 8,
                  ...(viewMode === "ghosts"
                    ? { background: "var(--v1v-green)", color: "var(--v1v-bg)" }
                    : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "var(--v1v-fg-muted)" }
                  ),
                }}
              >
                <Ghost className="w-3 h-3" />
                Zone Locale
              </button>
              <button
                onClick={() => setViewMode("all")}
                className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] transition-all active:scale-95"
                style={{
                  borderRadius: 8,
                  ...(viewMode === "all"
                    ? { background: "var(--v1v-green)", color: "var(--v1v-bg)" }
                    : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "var(--v1v-fg-muted)" }
                  ),
                }}
              >
                Tout
              </button>
            </div>

            {/* Filter chips */}
            <div role="tablist" aria-label="Filter collection" className="flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none", paddingBottom: 4 }}>
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => handleFilter(f.key)}
                  className="flex-shrink-0 text-[10px] font-black uppercase tracking-[0.08em] transition-all active:scale-95"
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 999,
                    ...(filter === f.key
                      ? { background: "var(--v1v-green)", color: "var(--v1v-bg)" }
                      : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "var(--v1v-fg-muted)" }
                    ),
                  }}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="relative z-10 px-4 py-5">

            {/* Error state */}
            {loadError && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <WifiOff className="w-8 h-8" style={{ color: "rgba(45,122,31,0.3)" }} />
                <p className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: "rgba(45,122,31,0.5)" }}>{t("journal.unavailable")}</p>
                <p className="text-[11px] max-w-[280px]" style={{ color: "var(--v1v-fg-muted)" }}>{loadError}</p>
                <button onClick={() => loadData(false)} className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>{t("common.retry")}</button>
              </div>
            )}

            {loadNotice && !loadError && (
              <NoticePanel
                className="mb-5"
                icon={Database}
                tone="info"
                label={t("journal.partialView")}
                message={loadNotice}
                dismiss={(
                  <button
                    onClick={() => setLoadNotice(null)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                    style={{ color: "var(--v1v-blue)" }}
                    aria-label={t("journal.partialClose")}
                  >
                    ×
                  </button>
                )}
              />
            )}

            {/* Loading skeleton */}
            {!dataLoaded && !loadError && <SkeletonGrid />}

            {/* Real content — fades in once data is ready */}
            {dataLoaded && (
              <div style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}>
                {filtered.length === 0 ? (
                  allPlants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div
                        className="v1v-surface-card-soft w-20 h-20 flex items-center justify-center mb-6"
                        style={{ animation: "leafPulse 2s ease-in-out infinite" }}
                      >
                        <Leaf className="w-9 h-9" style={{ color: "var(--v1v-green)" }} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: "var(--v1v-fg)" }}>
                        {t("journal.emptyTitle")}
                      </h2>
                      <p className="text-sm mb-8" style={{ color: "var(--v1v-fg-muted)" }}>
                        {t("journal.emptyBody")}
                      </p>
                      <Link to={`${createPageUrl("Home")}?openCamera=true`}>
                        <button
                          className="px-8 py-4 text-sm font-black uppercase tracking-[0.3em] transition-all active:scale-[0.97]"
                          style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)", boxShadow: "0 0 20px rgba(45,122,31,0.3)" }}
                        >
                          {t("journal.scanCta")}
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <Database className="w-8 h-8 mb-4" style={{ color: "rgba(45,122,31,0.3)" }} />
                      <p className="text-xs font-black uppercase tracking-[0.3em] mb-2" style={{ color: "rgba(45,122,31,0.5)" }}>
                        {t("journal.emptyFilter")}
                      </p>
                      <p className="text-[11px] max-w-[260px] mb-4" style={{ color: "rgba(45,122,31,0.45)" }}>
                        {search
                          ? t("journal.searchHint")
                          : t("journal.filterHint")}
                      </p>
                      <button
                        onClick={() => { setSearch(""); setFilter("all"); }}
                        className="px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.28em]"
                        style={{ border: "1px solid rgba(45,122,31,0.28)", color: "var(--v1v-green)" }}
                      >
                        {t("journal.reset")}
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    {/* Stats header */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-px flex-1" style={{ background: "var(--v1v-green-ghost)" }} />
                      <p className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: "var(--v1v-green-faint)" }}>
                        {viewMode === "mine" && `${filtered.length} découvertes`}
                        {viewMode === "ghosts" && `${ghostSpecies.length} espèces à trouver`}
                        {viewMode === "all" && `${filtered.length} découvertes · ${ghostSpecies.length} à trouver`}
                      </p>
                      <div className="h-px flex-1" style={{ background: "var(--v1v-green-ghost)" }} />
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Show user's discoveries */}
                      {(viewMode === "mine" || viewMode === "all") && filtered.map((plant, idx) => (
                        <motion.div
                          key={plant.id || `plant-${idx}`}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: Math.min(idx, 10) * 0.025 }}
                        >
                          <PlantCard plant={plant} onClick={setSelected} />
                        </motion.div>
                      ))}

                      {/* Show ghost species */}
                      {(viewMode === "ghosts" || viewMode === "all") && !ghostsLoading && ghostSpecies.map((ghost, idx) => (
                        <GhostSpeciesCard
                          key={`ghost-${ghost.taxon_id || idx}`}
                          species={ghost}
                          index={viewMode === "all" ? filtered.length + idx : idx}
                          onClick={() => setSelectedGhost(ghost)}
                        />
                      ))}

                      {/* Loading ghosts */}
                      {(viewMode === "ghosts" || viewMode === "all") && ghostsLoading && [...Array(6)].map((_, i) => (
                        <div key={`skeleton-${i}`} style={{ animationDelay: `${i * 80}ms` }}>
                          <SkeletonCard />
                        </div>
                      ))}
                    </div>

                    {/* No ghosts available */}
                    {viewMode === "ghosts" && !ghostsLoading && ghostSpecies.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Ghost className="w-10 h-10 mb-4" style={{ color: "var(--v1v-green-ghost)" }} />
                        <p className="text-sm font-black uppercase tracking-wide mb-2" style={{ color: "var(--v1v-fg-muted)" }}>
                          Zone vierge
                        </p>
                        <p className="text-xs max-w-[260px]" style={{ color: "var(--v1v-fg-faint)" }}>
                          Aucune observation iNaturalist dans cette zone. Sois le premier explorateur !
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ height: "6rem" }} aria-hidden="true" />
        </PullToRefresh>

        <style>{`
          @keyframes skeletonPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.2; } }
          @keyframes leafPulse { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.06); opacity: 1; } }
        `}</style>
      </div>
  );
}
