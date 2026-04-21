// ─── Badge Definitions — Naturaliste System ────────────────────────────────
// Each badge has: id, name, description, icon, category, condition(stats)
import { normalizeSpeciesCategory } from "@/lib/species";

export const BADGE_CATEGORIES = {
  biome:      { label: "Biomes",       color: "#39B814" },
  category:   { label: "Spécialités",  color: "#507ACC" },
  diversity:  { label: "Biodiversité", color: "#C8960A" },
  behavior:   { label: "Comportement", color: "#8B44B4" },
  saison:     { label: "Saison",       color: "#E07040" },
};

// stats object passed to condition():
// { total, unique, byBiome, byCategory, streak }
export const BADGES = [
  // ── Diversité ──────────────────────────────────────────────────────────
  {
    id: "bio_5",      category: "diversity", icon: "🌱",
    name: "Curieux",  description: "5 espèces différentes découvertes",
    condition: s => s.unique >= 5,   target: 5,   progress: s => Math.min(s.unique, 5),
  },
  {
    id: "bio_10",     category: "diversity", icon: "🔭",
    name: "Naturaliste", description: "10 espèces différentes découvertes",
    condition: s => s.unique >= 10,  target: 10,  progress: s => Math.min(s.unique, 10),
  },
  {
    id: "bio_20",     category: "diversity", icon: "🌍",
    name: "Explorateur Biodiversité", description: "20 espèces différentes découvertes",
    condition: s => s.unique >= 20,  target: 20,  progress: s => Math.min(s.unique, 20),
  },
  {
    id: "bio_50",     category: "diversity", icon: "🌿",
    name: "Maître des Biomes", description: "50 espèces différentes découvertes",
    condition: s => s.unique >= 50,  target: 50,  progress: s => Math.min(s.unique, 50),
  },
  {
    id: "bio_100",    category: "diversity", icon: "🏆",
    name: "Légende Naturelle", description: "100 espèces différentes — rang ultime",
    condition: s => s.unique >= 100, target: 100, progress: s => Math.min(s.unique, 100),
  },

  // ── Biomes ─────────────────────────────────────────────────────────────
  {
    id: "biome_foret_5",     category: "biome", icon: "🌲",
    name: "Forestier",       description: "5 espèces découvertes en forêt",
    condition: s => (s.byBiome.foret || 0) >= 5,   target: 5,   progress: s => Math.min(s.byBiome.foret || 0, 5),
  },
  {
    id: "biome_foret_20",    category: "biome", icon: "🌳",
    name: "Naturaliste Forestier", description: "20 espèces en forêt",
    condition: s => (s.byBiome.foret || 0) >= 20,  target: 20,  progress: s => Math.min(s.byBiome.foret || 0, 20),
  },
  {
    id: "biome_prairie_5",   category: "biome", icon: "🌾",
    name: "Botaniste des Prairies", description: "5 espèces en prairie",
    condition: s => (s.byBiome.prairie || 0) >= 5, target: 5,   progress: s => Math.min(s.byBiome.prairie || 0, 5),
  },
  {
    id: "biome_bord_eau_5",  category: "biome", icon: "💧",
    name: "Explorateur des Zones Humides", description: "5 espèces en bord de l'eau",
    condition: s => (s.byBiome.bord_eau || 0) >= 5, target: 5,  progress: s => Math.min(s.byBiome.bord_eau || 0, 5),
  },
  {
    id: "biome_montagne_5",  category: "biome", icon: "⛰️",
    name: "Alpiniste Naturaliste", description: "5 espèces en montagne",
    condition: s => (s.byBiome.montagne || 0) >= 5, target: 5,  progress: s => Math.min(s.byBiome.montagne || 0, 5),
  },
  {
    id: "biome_cote_5",      category: "biome", icon: "🌊",
    name: "Botaniste Côtier", description: "5 espèces en zone côtière",
    condition: s => (s.byBiome.cote || 0) >= 5,    target: 5,   progress: s => Math.min(s.byBiome.cote || 0, 5),
  },
  {
    id: "biome_urban_5",     category: "biome", icon: "🏙️",
    name: "Botaniste Urbain", description: "5 espèces en milieu urbain",
    condition: s => (s.byBiome.urban || 0) >= 5,   target: 5,   progress: s => Math.min(s.byBiome.urban || 0, 5),
  },

  // ── Spécialités ────────────────────────────────────────────────────────
  {
    id: "plant_10",       category: "category", icon: "🌿",
    name: "Botaniste",    description: "10 plantes identifiées",
    condition: s => ((s.byCategory.plant || 0) + (s.byCategory.tree || 0)) >= 10,
    target: 10,
    progress: s => Math.min((s.byCategory.plant || 0) + (s.byCategory.tree || 0), 10),
  },
  {
    id: "plant_25",       category: "category", icon: "🌺",
    name: "Phytologue",   description: "25 plantes identifiées",
    condition: s => ((s.byCategory.plant || 0) + (s.byCategory.tree || 0)) >= 25,
    target: 25,
    progress: s => Math.min((s.byCategory.plant || 0) + (s.byCategory.tree || 0), 25),
  },
  {
    id: "fungus_5",       category: "category", icon: "🍄",
    name: "Mycologue",    description: "5 champignons identifiés",
    condition: s => (s.byCategory.fungus || 0) >= 5, target: 5,  progress: s => Math.min(s.byCategory.fungus || 0, 5),
  },
  {
    id: "fungus_15",      category: "category", icon: "🔬",
    name: "Expert Mycologue", description: "15 champignons identifiés",
    condition: s => (s.byCategory.fungus || 0) >= 15, target: 15, progress: s => Math.min(s.byCategory.fungus || 0, 15),
  },
  {
    id: "bird_5",         category: "category", icon: "🦅",
    name: "Ornithologue", description: "5 oiseaux observés",
    condition: s => (s.byCategory.bird || 0) >= 5,  target: 5,   progress: s => Math.min(s.byCategory.bird || 0, 5),
  },
  {
    id: "bird_15",        category: "category", icon: "🦜",
    name: "Expert Ornithologue", description: "15 oiseaux observés",
    condition: s => (s.byCategory.bird || 0) >= 15, target: 15,  progress: s => Math.min(s.byCategory.bird || 0, 15),
  },
  {
    id: "rock_5",         category: "category", icon: "🪨",
    name: "Géologue",     description: "5 roches identifiées",
    condition: s => (s.byCategory.rock || 0) >= 5,  target: 5,   progress: s => Math.min(s.byCategory.rock || 0, 5),
  },

  // ── Comportement ───────────────────────────────────────────────────────
  {
    id: "streak_7",       category: "behavior", icon: "🔥",
    name: "Habitude de Terrain", description: "7 jours de scan consécutifs",
    condition: s => s.streak >= 7,  target: 7,   progress: s => Math.min(s.streak, 7),
  },
  {
    id: "edible_10",      category: "behavior", icon: "🍽️",
    name: "Cueilleur Expert", description: "10 espèces comestibles identifiées",
    condition: s => s.edible >= 10, target: 10,  progress: s => Math.min(s.edible, 10),
  },
  {
    id: "total_50",       category: "behavior", icon: "📔",
    name: "Journaliste de Terrain", description: "50 spécimens au total",
    condition: s => s.total >= 50,  target: 50,  progress: s => Math.min(s.total, 50),
  },

  // ── Saison ─────────────────────────────────────────────────────────────
  {
    id: "season_first",   category: "saison", icon: "🌱",
    name: "Explorateur Saisonnier", description: "5 espèces uniques en une saison",
    condition: s => (s.seasonUnique || 0) >= 5,  target: 5,   progress: s => Math.min(s.seasonUnique || 0, 5),
  },
  {
    id: "season_active",  category: "saison", icon: "🔭",
    name: "Naturaliste Actif", description: "15 espèces uniques en une saison",
    condition: s => (s.seasonUnique || 0) >= 15, target: 15,  progress: s => Math.min(s.seasonUnique || 0, 15),
  },
  {
    id: "season_expert",  category: "saison", icon: "🌿",
    name: "Expert des Saisons", description: "30 espèces uniques en une saison",
    condition: s => (s.seasonUnique || 0) >= 30, target: 30,  progress: s => Math.min(s.seasonUnique || 0, 30),
  },
  {
    id: "season_legend",  category: "saison", icon: "🏆",
    name: "Gardien du Vivant Saisonnier", description: "50 espèces uniques en une saison",
    condition: s => (s.seasonUnique || 0) >= 50, target: 50,  progress: s => Math.min(s.seasonUnique || 0, 50),
  },
];

/**
 * Compute stats object from an array of PlantDiscovery records + userProfile
 */
export function computeStats(discoveries, userProfile, seasonStart = null) {
  const uniqueSet   = new Set(discoveries.map(d => (d.common_name || "").toLowerCase().trim()));
  const byBiome     = {};
  const byCategory  = {};

  for (const d of discoveries) {
    const category = normalizeSpeciesCategory(d.category, d);
    if (d.biome) byBiome[d.biome] = (byBiome[d.biome] || 0) + 1;
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  // Seasonal unique species
  const seasonUnique = seasonStart
    ? new Set(
        discoveries
          .filter(d => d.discovered_date && d.discovered_date >= seasonStart)
          .map(d => (d.common_name || "").toLowerCase())
      ).size
    : 0;

  return {
    total:      discoveries.length,
    unique:     uniqueSet.size,
    byBiome,
    byCategory,
    edible:     discoveries.filter(d => d.is_edible).length,
    streak:     userProfile?.streak_days || 0,
    seasonUnique,
  };
}
