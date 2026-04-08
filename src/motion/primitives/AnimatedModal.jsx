/**
 * AnimatedModal - Modal bottom sheet avec slide-up premium
 *
 * Features:
 * - Slide up from bottom avec spring physics
 * - Backdrop fade avec blur
 * - Exit animations
 * - Portal rendering
 * - Click outside to close
 *
 * Usage:
 * <AnimatedModal isOpen={isOpen} onClose={() => setIsOpen(false)}>
 *   <ModalContent />
 * </AnimatedModal>
 */

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { modalSlideUp, backdropFade } from "@/motion/variants";
import { getTransition } from "@/motion/constants";
import { feedback } from "@/utils/feedback";
import { cn } from "@/lib/utils";

export default function AnimatedModal({
  isOpen,
  onClose,
  children,
  className,
  closeOnBackdrop = true,
  ...props
}) {
  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      feedback('tap', { haptic: true, sound: false });
      onClose();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
            variants={backdropFade}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={handleBackdropClick}
            transition={getTransition(backdropFade.animate.transition)}
          />

          {/* Modal */}
          <motion.div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto will-animate",
              className
            )}
            variants={modalSlideUp}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            transition={getTransition(modalSlideUp.animate.transition)}
            {...props}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
