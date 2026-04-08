/**
 * useStaggerChildren - Hook pour staggered list animations
 *
 * Facilite l'animation séquentielle d'éléments de liste
 * Limite automatiquement le nombre d'items pour éviter layout thrashing
 *
 * Usage:
 * const { containerProps, itemProps } = useStaggerChildren(items, STAGGER.normal);
 *
 * <motion.div {...containerProps}>
 *   {items.map((item, i) => (
 *     <motion.div key={i} {...itemProps(i)}>
 *       {item}
 *     </motion.div>
 *   ))}
 * </motion.div>
 */

import { useMemo } from "react";
import { staggerContainer, staggerItem } from "@/motion/variants";
import { MAX_STAGGER_ITEMS, STAGGER } from "@/motion/constants";

export function useStaggerChildren(items, stagger = STAGGER.normal, options = {}) {
  const {
    maxItems = MAX_STAGGER_ITEMS,
    delayChildren = 0.1,
  } = options;

  const limitedItems = useMemo(() => {
    return items.slice(0, maxItems);
  }, [items, maxItems]);

  const containerProps = useMemo(
    () => ({
      variants: staggerContainer(stagger),
      initial: "hidden",
      animate: "visible",
    }),
    [stagger]
  );

  const itemProps = useMemo(
    () => (index) => ({
      variants: staggerItem,
      custom: index,
    }),
    []
  );

  return {
    containerProps,
    itemProps,
    limitedItems,
  };
}
