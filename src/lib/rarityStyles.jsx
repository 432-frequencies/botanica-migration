import { Target } from "lucide-react";

export const XP_BY_RARITY = {
  commune: 10,
  peu_commune: 25,
  rare: 60,
  legendaire: 140,
};

export const RARITY_TIER = {
  commune: "C",
  peu_commune: "B",
  rare: "A",
  legendaire: "S",
};

export const RARITY_LABEL = {
  commune: "Commune",
  peu_commune: "Peu commune",
  rare: "Rare",
  legendaire: "Legendaire",
};

const RARITY_STYLES = {
  commune: {
    dot: "#3FA34D",
    bg: "rgba(63,163,77,0.08)",
    border: "1px solid rgba(63,163,77,0.18)",
    glow: "none",
    scopeColor: "#3FA34D",
    nameColor: "#D7F0DB",
    badgeBg: "rgba(63,163,77,0.14)",
    badgeColor: "#A9DEB0",
  },
  peu_commune: {
    dot: "#1565C0",
    bg: "rgba(21,101,192,0.1)",
    border: "1px solid rgba(21,101,192,0.24)",
    glow: "0 0 18px rgba(21,101,192,0.08)",
    scopeColor: "#4EA5E7",
    nameColor: "#D9ECFF",
    badgeBg: "rgba(21,101,192,0.16)",
    badgeColor: "#91CAF5",
  },
  rare: {
    dot: "#FF7043",
    bg: "rgba(255,112,67,0.1)",
    border: "1px solid rgba(255,112,67,0.24)",
    glow: "0 0 24px rgba(255,112,67,0.12)",
    scopeColor: "#FF9B79",
    nameColor: "#FFE6DD",
    badgeBg: "rgba(255,112,67,0.18)",
    badgeColor: "#FFC0AA",
  },
  legendaire: {
    dot: "#FDD835",
    bg: "rgba(253,216,53,0.13)",
    border: "1px solid rgba(253,216,53,0.36)",
    glow: "0 0 28px rgba(253,216,53,0.16)",
    scopeColor: "#FFF176",
    nameColor: "#FFF6C2",
    badgeBg: "rgba(253,216,53,0.2)",
    badgeColor: "#FFF176",
  },
};

export function getRarityStyle(rarity) {
  return RARITY_STYLES[rarity] || RARITY_STYLES.commune;
}

export function ScopeIcon({ color = "var(--v1v-green)", size = 34, className }) {
  return <Target className={className} style={{ color, opacity: 0.88 }} size={size} />;
}
