import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Lightweight virtual list hook.
 * Renders only items in/near the viewport for large lists.
 *
 * @param {object} opts
 * @param {any[]}  opts.items        - Full array of items to virtualize
 * @param {number} opts.itemHeight   - Estimated height per item in px
 * @param {number} [opts.overscan=4] - Extra rows to render above/below viewport
 * @param {Element|null} [opts.scrollEl] - Scroll container (defaults to window)
 */
export function useVirtualList({ items, itemHeight, overscan = 4, scrollEl = null }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  const handleScroll = useCallback(() => {
    const el = scrollEl || window;
    const top = scrollEl ? scrollEl.scrollTop : window.scrollY;
    setScrollTop(top);
  }, [scrollEl]);

  useEffect(() => {
    const el = scrollEl || window;
    el.addEventListener("scroll", handleScroll, { passive: true });

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    else setViewportHeight(window.innerHeight);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      ro.disconnect();
    };
  }, [scrollEl, handleScroll]);

  // Compute which items are visible
  const totalHeight = items.length * itemHeight;

  // Offset from container top to viewport top
  const containerTop = containerRef.current?.getBoundingClientRect().top + (scrollEl ? scrollEl.scrollTop : scrollTop) || 0;
  const relativeScrollTop = Math.max(0, scrollTop - (containerRef.current?.offsetTop || 0));

  const startIndex = Math.max(0, Math.floor(relativeScrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((relativeScrollTop + viewportHeight) / itemHeight) + overscan
  );

  const virtualItems = items.slice(startIndex, endIndex + 1).map((item, i) => ({
    item,
    index: startIndex + i,
    offsetTop: (startIndex + i) * itemHeight,
  }));

  return {
    containerRef,
    totalHeight,
    virtualItems,
    startIndex,
    endIndex,
  };
}