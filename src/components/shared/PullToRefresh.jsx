import { useState, useRef, useEffect } from "react";

const THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
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
    setPulling(false);
    setPullY(0);
  };

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto"
      style={{ minHeight: "100vh" }}
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
      <div style={{ transform: `translateY(${pullY}px)`, transition: pulling ? "none" : "transform 0.3s ease" }}>
        {children}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}