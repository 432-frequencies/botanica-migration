/**
 * useScrollReveal - Hook pour animations scroll-triggered
 *
 * Utilise IntersectionObserver pour détecter quand un élément entre dans le viewport
 * Performance optimisée (pas de getBoundingClientRect sur chaque scroll)
 *
 * Usage:
 * const [ref, isVisible] = useScrollReveal({ once: true, threshold: 0.1 });
 *
 * <motion.div
 *   ref={ref}
 *   initial="hidden"
 *   animate={isVisible ? "visible" : "hidden"}
 *   variants={fadeInUp}
 * >
 *   Content
 * </motion.div>
 */

import { useEffect, useRef, useState } from "react";
import { SCROLL_THRESHOLD } from "@/motion/constants";

export function useScrollReveal(options = {}) {
  const {
    threshold = SCROLL_THRESHOLD,
    once = true,
    rootMargin = "0px",
  } = options;

  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.disconnect();
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.disconnect();
      }
    };
  }, [threshold, once, rootMargin]);

  return [ref, isVisible];
}
