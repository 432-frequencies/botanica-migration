import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Database, Leaf, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PlantCard from "@/components/collection/PlantCard";
import PlantDetailModal from "@/components/collection/PlantDetailModal";
import LearnMoreModal from "@/components/collection/LearnMoreModal";
import PullToRefresh from "@/components/shared/PullToRefresh";
import { useIsActivePage } from "@/lib/ActivePageContext";


const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg-subtle)";
// 2-column premium grid — image 160px + info ~72px + gap = ~240px
const ROW_HEIGHT = 240;
const COLS = 2;
const OVERSCAN = 3;

// Module-level cache: user_email → all discoveries
const collectionsCache = new Map();

const FILTERS = [
  { key: "all",     label: "Tout" },
  { key: "plant",   label: "Plantes" },
  { key: "bird",    label: "Oiseaux" },
  { key: "fungus",  label: "Champignons" },
  { key: "tree",    label: "Arbres" },
  { key: "rock",    label: "Roches" },
  { key: "insect",  label: "Insectes" },
  { key: "edible",  label: "Comestibles" },
  { key: "toxic",   label: "Toxiques" },
];

function applyFilter(plants, search, filter) {
  let f = plants;
  if (search) f = f.filter(p =>
    p.common_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.scientific_name?.toLowerCase().includes(search.toLowerCase())
  );
  if (filter === "edible") f = f.filter(p => p.is_edible);
  else if (filter === "toxic") f = f.filter(p => p.is_toxic);
  else if (["plant","bird","rock","fungus","tree","insect"].includes(filter)) f = f.filter(p => (p.category || "plant") === filter);
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

export default function Collection() {
  const [allPlants, setAllPlants]   = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError]   = useState(false);
  const [visible, setVisible]       = useState(false);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("all");
  const [selected, setSelected]     = useState(null);
  const [learnMore, setLearnMore]   = useState(null);
  const [isPro, setIsPro]           = useState(false);
  const [scrollTop, setScrollTop]   = useState(0);
  const scrollContainerRef          = useRef(null);
  const userEmailRef                = useRef(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = async (background = false) => {
    if (!background) setLoadError(false);
    const user = await base44.auth.me();
    userEmailRef.current = user.email;

    // Serve cache instantly on first mount
    if (!background && collectionsCache.has(user.email)) {
      setAllPlants(collectionsCache.get(user.email));
      setDataLoaded(true);
      setTimeout(() => setVisible(true), 20);
    }

    try {
      const [discoveryData, profileResult] = await Promise.allSettled([
        base44.entities.PlantDiscovery.filter({ user_email: user.email }, "-created_date"),
        base44.functions.invoke("getUserProfile", {}),
      ]);

      const all = discoveryData.status === "fulfilled" ? discoveryData.value : [];
      if (discoveryData.status === "rejected" && !collectionsCache.has(user.email)) {
        setLoadError(true); setDataLoaded(true); return;
      }
      collectionsCache.set(user.email, all);
      setAllPlants(all);
      setIsPro(profileResult.status === "fulfilled" ? (profileResult.value.data?.profile?.is_pro || false) : false);
    } catch (e) {
      if (!collectionsCache.has(user.email)) { setLoadError(true); setDataLoaded(true); return; }
    }

    if (!dataLoaded || !background) {
      setDataLoaded(true);
      setTimeout(() => setVisible(true), 20);
    }
  };

  const isActive = useIsActivePage("Collection");
  const hasLoadedRef = useRef(null);
  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData(false);
  }, [isActive]);

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = applyFilter(allPlants, search, filter);

  // ── Virtualized grid rows ──────────────────────────────────────────────────
  // Group flat items into rows of COLS
  const rows = [];
  for (let i = 0; i < filtered.length; i += COLS) {
    rows.push(filtered.slice(i, i + COLS));
  }
  const totalHeight = rows.length * ROW_HEIGHT;

  const getVirtualRows = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return { start: 0, end: Math.min(rows.length - 1, 20) };
    // scrollTop of the layout container (the max-w-md div in Layout)
    const layoutScroll = container.closest(".overflow-y-auto")?.scrollTop ?? 0;
    const containerTop = container.offsetTop || 0;
    const relTop = Math.max(0, layoutScroll - containerTop);
    const vh = window.innerHeight;
    const start = Math.max(0, Math.floor(relTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(rows.length - 1, Math.ceil((relTop + vh) / ROW_HEIGHT) + OVERSCAN);
    return { start, end };
  }, [rows.length, scrollTop]);

  // Track scroll on the Layout's scroll container
  useEffect(() => {
    const layoutEl = scrollContainerRef.current?.closest(".overflow-y-auto");
    if (!layoutEl) return;
    const onScroll = () => setScrollTop(layoutEl.scrollTop);
    layoutEl.addEventListener("scroll", onScroll, { passive: true });
    return () => layoutEl.removeEventListener("scroll", onScroll);
  }, [dataLoaded]);

  const { start: rowStart, end: rowEnd } = getVirtualRows();
  const visibleRows = rows.slice(rowStart, rowEnd + 1);

  const handleSearch = (val) => { setSearch(val); };
  const handleFilter = (key) => { setFilter(key); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)", overscrollBehavior: "contain" }}>

        {selected && !learnMore && (
          <PlantDetailModal
            plant={selected}
            isPro={isPro}
            onClose={() => setSelected(null)}
            onLearnMore={(p) => { setLearnMore(p); setSelected(null); }}
          />
        )}
        <LearnMoreModal plant={learnMore} onClose={() => setLearnMore(null)} />

        <PullToRefresh onRefresh={() => loadData(true)}>

          {/* Ambient */}
          <div className="pointer-events-none fixed inset-0 z-0" style={{
            background: "radial-gradient(ellipse 60% 40% at 90% 0%, rgba(43,107,232,0.04) 0%, transparent 65%)"
          }} />

          {/* ── Sticky header ── */}
          <div
            className="sticky top-0 z-10 px-4 pt-4 pb-3"
            style={{ background: "var(--v1v-bg-overlay)", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(24px)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ color: "var(--v1v-fg-faint)" }}>Field Journal</p>
                <h1 className="text-xl font-black uppercase leading-none" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>Collection</h1>
              </div>
              {allPlants.length > 0 && (
                <span className="text-xs font-black number-display" style={{ color: "var(--v1v-fg-faint)" }}>{allPlants.length}</span>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--v1v-fg-faint)" }} />
              <input
                placeholder="Rechercher…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 text-sm outline-none"
                style={{
                  height: 40,
                  background: "var(--v1v-surface-1)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6,
                  color: "var(--v1v-fg)",
                  fontSize: 13,
                }}
              />
            </div>

            {/* Filter chips */}
            <div role="tablist" aria-label="Filter collection" className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none", paddingBottom: 2 }}>
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => handleFilter(f.key)}
                  className="flex-shrink-0 text-[10px] font-black uppercase tracking-[0.08em] transition-all active:scale-95"
                  style={{
                    height: 28,
                    padding: "0 10px",
                    borderRadius: 4,
                    ...(filter === f.key
                      ? { background: "var(--v1v-green)", color: "var(--v1v-bg)" }
                      : { background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "var(--v1v-fg-muted)" }
                    ),
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="relative z-10 px-4 py-5" ref={scrollContainerRef}>

            {/* Error state */}
            {loadError && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <WifiOff className="w-8 h-8" style={{ color: "rgba(45,122,31,0.3)" }} />
                <p className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: "rgba(45,122,31,0.5)" }}>Connexion perdue</p>
                <button onClick={() => loadData(false)} className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>Réessayer</button>
              </div>
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
                        className="w-20 h-20 flex items-center justify-center mb-6"
                        style={{ background: "rgba(45,122,31,0.08)", border: "1px solid rgba(45,122,31,0.2)", animation: "leafPulse 2s ease-in-out infinite" }}
                      >
                        <Leaf className="w-9 h-9" style={{ color: "var(--v1v-green)" }} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: "var(--v1v-fg)" }}>
                        Ton journal est vide
                      </h2>
                      <p className="text-sm mb-8" style={{ color: "var(--v1v-fg-muted)" }}>
                        Scanne ta première espèce pour commencer
                      </p>
                      <Link to={`${createPageUrl("Home")}?openCamera=true`}>
                        <button
                          className="px-8 py-4 text-sm font-black uppercase tracking-[0.3em] transition-all active:scale-[0.97]"
                          style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)", boxShadow: "0 0 20px rgba(45,122,31,0.3)" }}
                        >
                          Scanner maintenant →
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <Database className="w-8 h-8 mb-4" style={{ color: "rgba(45,122,31,0.3)" }} />
                      <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.4)" }}>No results found</p>
                    </div>
                  )
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-px flex-1" style={{ background: "var(--v1v-green-ghost)" }} />
                      <p className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: "var(--v1v-green-faint)" }}>
                        {filtered.length} spécimen{filtered.length > 1 ? "s" : ""}
                      </p>
                      <div className="h-px flex-1" style={{ background: "var(--v1v-green-ghost)" }} />
                    </div>

                    {/* Virtualized grid — only renders visible rows */}
                     <div style={{ position: "relative", height: totalHeight }}>
                       {visibleRows.map((row, i) => {
                         const rowIndex = rowStart + i;
                         return (
                           <div
                             key={rowIndex}
                             className="grid grid-cols-2 gap-3"
                            style={{
                              position: "absolute",
                              top: rowIndex * ROW_HEIGHT,
                              left: 0,
                              right: 0,
                              height: ROW_HEIGHT,
                            }}
                          >
                            {row.map(plant => (
                              <PlantCard key={plant.id} plant={plant} onClick={setSelected} onLearnMore={setLearnMore} />
                            ))}
                          </div>
                        );
                      })}
                    </div>
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