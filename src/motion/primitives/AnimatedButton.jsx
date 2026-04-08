/**
 * AnimatedButton - Button avec feedback tactile premium
 *
 * Features:
 * - Press feedback (scale down)
 * - Hover state (scale up slightly)
 * - Haptic feedback automatique
 * - Accessibility (reduced motion support)
 *
 * Usage:
 * <AnimatedButton onClick={handleClick} hapticType="success">
 *   Click Me
 * </AnimatedButton>
 */

import { motion } from "framer-motion";
import { buttonPress } from "@/motion/variants";
import { getTransition } from "@/motion/constants";
import { feedback } from "@/utils/feedback";
import { cn } from "@/lib/utils";

export default function AnimatedButton({
  children,
  onClick,
  className,
  hapticType = "tap",
  soundEnabled = false,
  disabled = false,
  ...props
}) {
  const handlePress = (e) => {
    if (disabled) return;

    // Haptic feedback sync with animation
    feedback(hapticType, { haptic: true, sound: soundEnabled });

    onClick?.(e);
  };

  return (
    <motion.button
      className={cn(
        "relative overflow-hidden touch-manipulation",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      variants={buttonPress}
      initial="initial"
      whileTap={disabled ? undefined : "tap"}
      whileHover={disabled ? undefined : "hover"}
      onClick={handlePress}
      disabled={disabled}
      transition={getTransition(buttonPress.tap.transition)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
