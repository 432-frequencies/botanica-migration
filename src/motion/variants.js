/**
 * Tesla-Inspired Framer Motion Variants Library
 *
 * Reusable animation patterns for consistent motion across components.
 * All variants use constants from ./constants.js for unified motion language.
 */

import { EASING, DURATION, SPRING, STAGGER } from './constants';

// ═══════════════════════════════════════════════════════════
// BUTTON INTERACTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Button Press: Satisfying scale feedback with slight overshoot
 * Usage: All interactive buttons
 */
export const buttonPress = {
  initial: { scale: 1 },
  tap: {
    scale: 0.96,
    transition: { duration: DURATION.fast, ease: EASING.snappy }
  },
  hover: {
    scale: 1.02,
    transition: { duration: DURATION.fast, ease: EASING.smooth }
  }
};

/**
 * Icon Bounce: Playful scale + rotate animation
 * Usage: Active tab icons, notification badges
 */
export const iconBounce = {
  initial: { scale: 1, rotate: 0 },
  animate: {
    scale: [1, 1.15, 1],
    rotate: [0, -5, 5, 0],
    transition: {
      duration: DURATION.medium,
      ease: EASING.snappy
    }
  }
};

// ═══════════════════════════════════════════════════════════
// CARD INTERACTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Card Hover: Lift effect with shadow change
 * Usage: PlantCard, ZoneCard, all collection items
 */
export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
  },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
    transition: { duration: DURATION.normal, ease: EASING.smooth }
  },
  tap: {
    scale: 0.98,
    y: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    transition: { duration: DURATION.fast, ease: EASING.snappy }
  }
};

// ═══════════════════════════════════════════════════════════
// MODAL & SHEET ANIMATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Modal Slide Up: Smooth slide from bottom with spring physics
 * Usage: PlantDetailModal, ZoneDetailPanel, all bottom sheets
 */
export const modalSlideUp = {
  initial: {
    y: "100%",
    opacity: 0
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: SPRING.gentle
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: { duration: DURATION.medium, ease: EASING.smooth }
  }
};

/**
 * Backdrop Fade: Simple fade for modal backgrounds
 * Usage: Modal backdrop, overlay layers
 */
export const backdropFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.normal } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } }
};

// ═══════════════════════════════════════════════════════════
// PAGE TRANSITIONS (Directional)
// ═══════════════════════════════════════════════════════════

/**
 * Page Slide Right: Push navigation (forward)
 * Usage: Navigating to child pages (Home → Collection → Detail)
 */
export const pageSlideRight = {
  initial: { x: "100%", opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: DURATION.slow, ease: EASING.smooth }
  },
  exit: {
    x: "-30%",
    opacity: 0,
    transition: { duration: DURATION.normal, ease: EASING.smooth }
  }
};

/**
 * Page Slide Left: Pop navigation (backward)
 * Usage: Navigating back (Detail → Collection → Home)
 */
export const pageSlideLeft = {
  initial: { x: "-100%", opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: DURATION.slow, ease: EASING.smooth }
  },
  exit: {
    x: "30%",
    opacity: 0,
    transition: { duration: DURATION.normal, ease: EASING.smooth }
  }
};

/**
 * Page Fade: Simple fade for non-directional transitions
 * Usage: Tab switches, non-hierarchical navigation
 */
export const pageFade = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: DURATION.normal, ease: EASING.smooth }
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast, ease: EASING.smooth }
  }
};

// ═══════════════════════════════════════════════════════════
// SCROLL ANIMATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Fade In Up: Elegant reveal from below
 * Usage: Home sections, scroll-triggered content
 */
export const fadeInUp = {
  hidden: {
    opacity: 0,
    y: 24
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.medium, ease: EASING.gentle }
  }
};

/**
 * Fade In Scale: Scale + fade reveal
 * Usage: Emphasized content, hero elements
 */
export const fadeInScale = {
  hidden: {
    opacity: 0,
    scale: 0.9
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.medium, ease: EASING.smooth }
  }
};

// ═══════════════════════════════════════════════════════════
// STAGGERED ANIMATIONS (List Reveals)
// ═══════════════════════════════════════════════════════════

/**
 * Stagger Container: Orchestrates child animations
 * Usage: Collection grids, feed lists, any repeated items
 *
 * @param {number} stagger - Delay between children (STAGGER.tight|normal|relaxed)
 * @returns {object} Framer Motion variant
 */
export const staggerContainer = (stagger = STAGGER.normal) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: 0.1
    }
  }
});

/**
 * Stagger Item: Individual item in staggered list
 * Usage: Child elements inside staggerContainer
 */
export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASING.gentle }
  }
};

// ═══════════════════════════════════════════════════════════
// LOADING STATES
// ═══════════════════════════════════════════════════════════

/**
 * Skeleton Pulse: Breathing animation for loading placeholders
 * Usage: LoadingSkeleton component, card placeholders
 */
export const skeletonPulse = {
  initial: { opacity: 0.4 },
  animate: {
    opacity: [0.4, 0.8, 0.4],
    transition: {
      duration: 1.4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

/**
 * Spinner Rotate: Smooth continuous rotation
 * Usage: Loading spinners, refresh indicators
 */
export const spinnerRotate = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// ═══════════════════════════════════════════════════════════
// SPECIAL EFFECTS
// ═══════════════════════════════════════════════════════════

/**
 * Glow Pulse: Breathing glow effect
 * Usage: Active elements, selected items, pro badges
 */
export const glowPulse = {
  initial: {
    boxShadow: "0 0 20px rgba(57,255,20,0.2)"
  },
  animate: {
    boxShadow: [
      "0 0 20px rgba(57,255,20,0.2)",
      "0 0 40px rgba(57,255,20,0.4)",
      "0 0 20px rgba(57,255,20,0.2)"
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

/**
 * Shimmer: Sweeping shine effect
 * Usage: XP bars, progress indicators, premium elements
 */
export const shimmer = {
  animate: {
    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// ═══════════════════════════════════════════════════════════
// INPUT INTERACTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Input Focus: Border glow on focus
 * Usage: All input fields, search bars
 */
export const inputFocus = {
  rest: {
    scale: 1,
    boxShadow: "0 0 0 0px rgba(57,255,20,0)"
  },
  focus: {
    scale: 1.01,
    boxShadow: "0 0 0 3px rgba(57,255,20,0.2)",
    transition: { duration: DURATION.fast, ease: EASING.smooth }
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Get page transition variant based on navigation direction
 * @param {boolean} isForward - True if navigating forward, false if back
 * @returns {object} Page transition variant
 */
export const getPageTransition = (isForward) => {
  return isForward ? pageSlideRight : pageSlideLeft;
};

/**
 * Create custom stagger with specific timing
 * @param {number} stagger - Delay in seconds
 * @param {number} delay - Initial delay before first child
 * @returns {object} Stagger variant
 */
export const createStagger = (stagger = 0.05, delay = 0.1) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren: delay
    }
  }
});
