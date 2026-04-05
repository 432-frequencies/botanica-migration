import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Map, User, Trophy, Globe, ChevronLeft, Grid } from "lucide-react";
import { useRef, useEffect, Suspense, lazy } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GlobalErrorToast from "@/components/shared/GlobalErrorToast";
import { ActivePageContext } from "@/lib/ActivePageContext";
import { useNavHistory } from "@/lib/NavHistory";

// Pages with NO bottom nav AND NO header
const STANDALONE_PAGES = ["Onboarding", "Pricing", "AdminImport"];
// Pages that show nav but NOT the global header (they have their own)
const NO_HEADER_PAGES = ["Collection"];
const ROOT_PAGES = ["Home", "Collection", "TerritorialMap", "Leaderboard", "Profile"];

const navItems = [
  { label: "Feed",      page: "Home",            icon: Home },
  { label: "Journal",  page: "Collection",      icon: Map },
  { label: "Zones",    page: "TerritorialMap",   icon: Grid },
  { label: "Ranks",    page: "Leaderboard",      icon: Trophy },
  { label: "Agent",    page: "Profile",          icon: User },
];

// Lazy-load keep-alive pages
const KeepAlivePages = {
  Home:            lazy(() => import("./pages/Home")),
  Collection:      lazy(() => import("./pages/Collection")),
  TerritorialMap:  lazy(() => import("./pages/TerritorialMap")),
  Leaderboard:     lazy(() => import("./pages/Leaderboard")),
  Profile:         lazy(() => import("./pages/Profile")),
};

const mountedPages = new Set();
const TAB_ORDER = ["Home", "Collection", "TerritorialMap", "Leaderboard", "Profile"];

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--v1v-bg)" }}>
    <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }} />
  </div>
);

// Framer Motion variants for push/pop transitions
const pushVariants = {
  initial:  { x: "100%", opacity: 0 },
  animate:  { x: 0,      opacity: 1 },
  exit:     { x: "100%", opacity: 0 },
};

const popVariants = {
  initial:  { x: "-30%", opacity: 0 },
  animate:  { x: 0,      opacity: 1 },
  exit:     { x: "100%", opacity: 0 },
};

const tabTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] };

export default function Layout({ children, currentPageName }) {
  const isStandalone = STANDALONE_PAGES.includes(currentPageName);
  const isRootPage   = ROOT_PAGES.includes(currentPageName);
  const showNav      = !isStandalone;
  const showHeader   = !isStandalone && !NO_HEADER_PAGES.includes(currentPageName);

  const containerRef  = useRef(null);
  const scrollPositions = useRef({});
  const prevPageRef   = useRef(currentPageName);
  const location      = useLocation();
  const { push, goBack } = useNavHistory();

  // Track navigation direction for root tab transitions
  const prevIdx = TAB_ORDER.indexOf(prevPageRef.current);
  const currIdx = TAB_ORDER.indexOf(currentPageName);
  // direction: 1 = moving right in tabs, -1 = left, 0 = non-tab
  const tabDirection = prevIdx >= 0 && currIdx >= 0 ? Math.sign(currIdx - prevIdx) : 0;

  // Push to history stack whenever we navigate to a non-root page
  useEffect(() => {
    if (!isRootPage) {
      push(location.pathname);
    }
    prevPageRef.current = currentPageName;
  }, [currentPageName]);

  // Restore scroll position when switching tabs
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = scrollPositions.current[currentPageName] ?? 0;
  }, [currentPageName]);

  // Save scroll position continuously
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => { scrollPositions.current[currentPageName] = el.scrollTop; };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [currentPageName]);

  const handleNavClick = (pageName) => {
    if (currentPageName === pageName && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      scrollPositions.current[pageName] = 0;
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen max-w-md mx-auto relative overflow-x-clip overflow-y-auto"
      style={{
        background: "var(--v1v-bg)",
        color: "var(--v1v-fg)",
        paddingTop: "env(safe-area-inset-top)",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
      }}
    >
      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/feTurbulence%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <ActivePageContext.Provider value={currentPageName}>
        {isRootPage ? (
          /* ── Keep-Alive root pages: CSS transitions (avoid remount) ── */
          Object.entries(KeepAlivePages).map(([pageName, PageComponent]) => {
            if (currentPageName === pageName) mountedPages.add(pageName);
            if (!mountedPages.has(pageName)) return null;

            const isActive = currentPageName === pageName;
            const pageIdx  = TAB_ORDER.indexOf(pageName);
            const activeIdx = TAB_ORDER.indexOf(currentPageName);
            const offsetDir = pageIdx - activeIdx;

            return (
              <div
                key={pageName}
                className="relative z-10"
                style={{
                  position:    isActive ? "relative" : "absolute",
                  top: 0, left: 0, right: 0,
                  opacity:     isActive ? 1 : 0,
                  transform:   isActive ? "translateX(0)" : `translateX(${offsetDir > 0 ? "40%" : "-40%"})`,
                  transition:  "opacity 220ms cubic-bezier(0.4,0,0.2,1), transform 220ms cubic-bezier(0.4,0,0.2,1)",
                  pointerEvents: isActive ? "auto" : "none",
                  visibility:  isActive ? "visible" : "hidden",
                  willChange:  "opacity, transform",
                }}
              >
                <Suspense fallback={<PageFallback />}>
                  <PageComponent />
                </Suspense>
              </div>
            );
          })
        ) : (
          /* ── Non-root pages: Framer Motion push/pop transition ── */
          <AnimatePresence mode="wait" initial={true}>
            <motion.div
              key={currentPageName}
              className="relative z-10"
              variants={pushVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={tabTransition}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </ActivePageContext.Provider>

      {/* Top Header */}
      {showHeader && (
        <header
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 flex items-center justify-between px-5"
          style={{
            background: "var(--v1v-bg-overlay)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(24px)",
            paddingTop: "max(calc(0.75rem + env(safe-area-inset-top)), 16px)",
            paddingBottom: "0.75rem",
            height: "calc(52px + env(safe-area-inset-top))",
          }}
        >
          {isRootPage ? (
            <>
              <span className="font-black tracking-[0.15em] text-sm uppercase" style={{ color: "var(--v1v-green)" }}>
                W1LD
              </span>
              <span className="text-[8px] font-black tracking-[0.35em] uppercase" style={{ color: "var(--v1v-fg-faint)" }}>
                Field OS
              </span>
              <div className="w-8" />
            </>
          ) : (
            <>
              <button
                onClick={goBack}
                aria-label="Go back"
                className="flex items-center gap-1.5 min-h-[44px] min-w-[44px] pr-4 transition-opacity active:opacity-40"
                style={{ color: "var(--v1v-fg-muted)" }}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-[0.1em]">Retour</span>
              </button>
              <span
                className="font-black tracking-[0.15em] text-sm uppercase absolute left-1/2 -translate-x-1/2"
                style={{ color: "var(--v1v-green)" }}
              >
                W1LD
              </span>
              <div className="w-16" />
            </>
          )}
        </header>
      )}

      {/* Spacer for header */}
      {showHeader && <div style={{ height: "calc(52px + env(safe-area-inset-top))" }} />}

      <GlobalErrorToast />

      {/* Bottom Nav */}
      {showNav && (
        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40"
          style={{
            background: "var(--v1v-bg-overlay)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(24px)",
            paddingBottom: "max(calc(0.5rem + env(safe-area-inset-bottom)), 12px)",
            paddingTop: "0.5rem",
          }}
        >
          <div className="flex items-center justify-around px-2">
            {navItems.map(({ label, page, icon: Icon }) => {
              const isActive = currentPageName === page;
              return (
                <Link
                  key={page}
                  to={createPageUrl(page)}
                  onClick={() => handleNavClick(page)}
                  aria-label={label}
                  className="flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[52px] transition-all duration-150 relative"
                >
                  {isActive && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5"
                      style={{ background: "var(--v1v-green)", borderRadius: 1 }}
                    />
                  )}
                  <Icon
                    className="w-[18px] h-[18px]"
                    style={{
                      color: isActive ? "var(--v1v-green)" : "rgba(255,255,255,0.28)",
                      strokeWidth: isActive ? 2 : 1.5,
                    }}
                  />
                  <span
                    className="text-[8px] font-black uppercase tracking-[0.08em]"
                    style={{ color: isActive ? "var(--v1v-green)" : "rgba(255,255,255,0.28)" }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}