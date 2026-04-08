/**
 * AnimatedCard - Card avec effet lift premium
 *
 * Features:
 * - Hover: scale + lift + shadow change
 * - Tap: scale down + haptic
 * - Smooth transitions
 * - Accessibility support
 *
 * Usage:
 * <AnimatedCard onClick={handleClick} className="p-4">
 *   <CardContent />
 * </AnimatedCard>
 */

import { motion } from "framer-motion";
import { cardHover } from "@/motion/variants";
import { getTransition } from "@/motion/constants";
import { feedback } from "@/utils/feedback";
import { cn } from "@/lib/utils";

export default function AnimatedCard({
  children,
  onClick,
  className,
  enableHover = true,
  enableTap = true,
  hapticType = "tap",
  ...props
}) {
  const handleClick = (e) => {
    if (onClick) {
      feedback(hapticType, { haptic: true, sound: false });
      onClick(e);
    }
  };

  return (
    <motion.div
      className={cn("relative will-animate", className)}
      variants={cardHover}
      initial="rest"
      whileHover={enableHover ? "hover" : undefined}
      whileTap={enableTap ? "tap" : undefined}
      onClick={handleClick}
      transition={getTransition(cardHover.hover.transition)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
