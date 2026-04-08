/**
 * Tesla-Inspired Motion System Constants
 *
 * Unified easing curves, durations, and spring physics for consistent,
 * premium animations across the entire application.
 *
 * Design Principles:
 * - Predictable: Physics-based motion (spring)
 * - Purposeful: Every animation communicates state
 * - Performance: 60fps non-negotiable, GPU-accelerated only
 * - Accessible: Support for reduced motion preferences
 */

// ═══════════════════════════════════════════════════════════
// EASING CURVES (Only 4 - Tesla-like consistency)
// ═══════════════════════════════════════════════════════════

export const EASING = {
  /**
   * Smooth: Primary easing for most UI elements
   * Usage: 80% of animations (cards, pages, modals)
   * cubic-bezier(0.4, 0, 0.2, 1)
   */
  smooth: [0.4, 0, 0.2, 1],

  /**
   * Snappy: Elastic overshoot for interactive elements
   * Usage: 15% (buttons, taps, bouncy feedback)
   * cubic-bezier(0.34, 1.56, 0.64, 1)
   */
  snappy: [0.34, 1.56, 0.64, 1],

  /**
   * Gentle: Extreme ease-out for floaty elements
   * Usage: 4% (modals sliding up, sheets)
   * cubic-bezier(0.16, 1, 0.3, 1)
   */
  gentle: [0.16, 1, 0.3, 1],

  /**
   * Sharp: Near-linear for instant responses
   * Usage: 1% (tab switches, snappy UI)
   * cubic-bezier(0.25, 0.1, 0.25, 1)
   */
  sharp: [0.25, 0.1, 0.25, 1],
};

// ═══════════════════════════════════════════════════════════
// DURATIONS (60fps aligned - 16.67ms increments preferred)
// ═══════════════════════════════════════════════════════════

export const DURATION = {
  /**
   * Instant: Micro-interactions
   * 100ms ≈ 6 frames @ 60fps
   */
  instant: 0.1,

  /**
   * Fast: Button press, icon scale
   * 150ms ≈ 9 frames @ 60fps
   */
  fast: 0.15,

  /**
   * Normal: Standard for cards, list items
   * 220ms ≈ 13 frames @ 60fps (matches Layout.jsx)
   */
  normal: 0.22,

  /**
   * Medium: Modals, sheets
   * 350ms ≈ 21 frames @ 60fps
   */
  medium: 0.35,

  /**
   * Slow: Page transitions
   * 500ms ≈ 30 frames @ 60fps
   */
  slow: 0.5,

  /**
   * Glacial: Celebration reveals (keep existing)
   * 700ms ≈ 42 frames @ 60fps
   */
  glacial: 0.7,
};

// ═══════════════════════════════════════════════════════════
// SPRING PHYSICS (Tesla-like smooth acceleration)
// ═══════════════════════════════════════════════════════════

export const SPRING = {
  /**
   * Gentle: Smooth, floaty springs for modals/sheets
   * Feels premium, not bouncy
   */
  gentle: {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.8
  },

  /**
   * Bouncy: Satisfying feedback for buttons/icons
   * Slight overshoot creates delight
   */
  bouncy: {
    type: "spring",
    stiffness: 400,
    damping: 25,
    mass: 0.5
  },

  /**
   * Stiff: Responsive page transitions
   * Feels instant but smooth
   */
  stiff: {
    type: "spring",
    stiffness: 500,
    damping: 35,
    mass: 1
  },

  /**
   * Smooth: Scroll-triggered animations
   * Slow, luxurious reveal
   */
  smooth: {
    type: "spring",
    stiffness: 200,
    damping: 28,
    mass: 1.2
  },
};

// ═══════════════════════════════════════════════════════════
// STAGGER TIMINGS (For list reveals)
// ═══════════════════════════════════════════════════════════

export const STAGGER = {
  /**
   * Tight: Dense lists (feed items, compact grids)
   * 30ms between items
   */
  tight: 0.03,

  /**
   * Normal: Standard spacing (collection cards)
   * 50ms between items
   */
  normal: 0.05,

  /**
   * Relaxed: Hero sections, emphasized content
   * 80ms between items
   */
  relaxed: 0.08,
};

// ═══════════════════════════════════════════════════════════
// ACCESSIBILITY (Respect user preferences)
// ═══════════════════════════════════════════════════════════

/**
 * Check if user prefers reduced motion
 * Returns true if animations should be disabled/instant
 */
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get transition config with reduced motion support
 * Returns instant transition if user prefers reduced motion
 */
export const getTransition = (transition) => {
  return shouldReduceMotion() ? { duration: 0 } : transition;
};

// ═══════════════════════════════════════════════════════════
// PERFORMANCE CONSTANTS
// ═══════════════════════════════════════════════════════════

/**
 * Maximum items to stagger (prevents layout thrashing)
 */
export const MAX_STAGGER_ITEMS = 20;

/**
 * IntersectionObserver threshold for scroll reveals
 */
export const SCROLL_THRESHOLD = 0.1;

/**
 * GPU-accelerated properties (safe to animate)
 * Only use these for 60fps guarantee
 */
export const GPU_PROPS = ['transform', 'opacity'];
