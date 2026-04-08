/**
 * useHapticPress - Hook pour sync haptic + animation
 *
 * Retourne un handler qui déclenche haptic feedback + callback
 * Utilisé dans les composants interactifs pour feedback tactile cohérent
 *
 * Usage:
 * const handlePress = useHapticPress(onClick, 'tap');
 *
 * <motion.button whileTap={{scale: 0.96}} onTap={handlePress}>
 *   Press Me
 * </motion.button>
 */

import { useCallback } from "react";
import { feedback } from "@/utils/feedback";

export function useHapticPress(callback, hapticType = "tap", options = {}) {
  const {
    haptic = true,
    sound = false,
    ...feedbackOptions
  } = options;

  return useCallback(
    (e) => {
      if (haptic) {
        feedback(hapticType, { haptic, sound, ...feedbackOptions });
      }
      callback?.(e);
    },
    [callback, hapticType, haptic, sound, feedbackOptions]
  );
}
