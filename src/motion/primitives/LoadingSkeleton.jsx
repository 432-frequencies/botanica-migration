/**
 * LoadingSkeleton - Skeleton pulse premium pour loading states
 *
 * Features:
 * - Smooth breathing animation
 * - Variants (card, text, avatar, button)
 * - Performance optimized (GPU-accelerated)
 * - Accessibility support
 *
 * Usage:
 * <LoadingSkeleton variant="card" className="h-40" />
 * <LoadingSkeleton variant="text" className="w-32 h-4" />
 */

import { motion } from "framer-motion";
import { skeletonPulse } from "@/motion/variants";
import { getTransition } from "@/motion/constants";
import { cn } from "@/lib/utils";

const variants = {
  card: "h-40 w-full rounded-lg",
  text: "h-4 w-32 rounded",
  avatar: "h-10 w-10 rounded-full",
  button: "h-10 w-24 rounded-md",
  title: "h-6 w-48 rounded",
};

export default function LoadingSkeleton({
  variant = "card",
  className,
  ...props
}) {
  return (
    <motion.div
      className={cn(
        "bg-gray-200/10 skeleton-pulse will-animate",
        variant && variants[variant],
        className
      )}
      variants={skeletonPulse}
      initial="initial"
      animate="animate"
      transition={getTransition(skeletonPulse.animate.transition)}
      aria-label="Loading..."
      role="status"
      {...props}
    />
  );
}
