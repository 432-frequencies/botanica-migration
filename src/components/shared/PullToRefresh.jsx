import { useState, useRef } from "react";

const THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const startX = useRef(null);
  const gestureAxis = useRef(null);
  const containerRef = useRef(null);

  const lockHorizontalScroll = () => {
    const el = containerRef.current;
    if (el && el.scrollLeft !== 0) el.scrollLeft = 0;
    if (document.documentElement?.scrollLeft) document.documentElement.scrollLeft = 0;
    if (document.body?.scrollLeft) document.body.scrollLeft = 0;
  };

  const handleTouchStart = (e) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      gestureAxis.current = null;
    }
  };

  const handleTouchMove = (e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    const deltaX = e.touches[0].clientX - (startX.current ?? e.touches[0].clientX);

    if (!gestureAxis.current && (Math.abs(delta) > 6 || Math.abs(deltaX) > 6)) {
      gestureAxis.current = Math.abs(deltaX) > Math.abs(delta) ? "x" : "y";
    }

    if (gestureAxis.current === "x") return;

    // Verrouiller horizontal seulement si geste vertical confirmé
    if (gestureAxis.current === "y") {
      lockHorizontalScroll();
    }

    if (delta > 0) {
      setPulling(true);
      setPullY(Math.min(delta * 0.4, THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    startY.current = null;
    startX.current = null;
    gestureAxis.current = null;
    setPulling(false);
    setPullY(0);
    lockHorizontalScroll();
  };

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-full overflow-y-auto overflow-x-hidden"
      style={{
        minHeight: "100dvh",
        width: "100%",
        maxWidth: "100%",
        overscrollBehaviorX: "none",
        overscrollBehaviorInline: "none",
        WebkitOverflowScrolling: "touch",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-all"
        style={{ height: `${pullY}px`, overflow: "hidden" }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 transition-all"
          style={{
            borderColor: "#2D7A1F",
            borderTopColor: refreshing || progress >= 1 ? "#2D7A1F" : "transparent",
            transform: `rotate(${progress * 360}deg)`,
            animation: refreshing ? "spin 0.6s linear infinite" : "none",
            opacity: progress,
          }}
        />
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
          transform: `translate3d(0, ${pullY}px, 0)`,
          transition: pulling ? "none" : "transform 0.3s ease",
        }}
      >
        {children}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
