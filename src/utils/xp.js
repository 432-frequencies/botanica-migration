// ─── XP System — Diversity-based ──────────────────────────────────────────
// Rarity is VISUAL only. XP is earned by discovering NEW species.
// Duplicates earn NO XP — focus on diversity.

export const XP_NEW_SPECIES = 10;   // First time a species is discovered
export const XP_DUPLICATE   = 0;    // Already catalogued species

export const DIVERSITY_MILESTONES = [
  { count: 5,   bonus: 25,  label: "+25 XP · Bonus Biodiversité" },
  { count: 10,  bonus: 50,  label: "+50 XP · Bonus Biodiversité" },
  { count: 20,  bonus: 100, label: "+100 XP · Bonus Biodiversité" },
  { count: 50,  bonus: 200, label: "+200 XP · Bonus Biodiversité" },
  { count: 100, bonus: 500, label: "+500 XP · Bonus Biodiversité" },
];

export const LEVELS = [
  { level: 1, xp: 0 },    { level: 2, xp: 100 },  { level: 3, xp: 250 },
  { level: 4, xp: 500 },  { level: 5, xp: 900 },  { level: 6, xp: 1500 },
  { level: 7, xp: 2500 }, { level: 8, xp: 4000 }, { level: 9, xp: 6500 },
  { level: 10, xp: 10000 },
];

export function getLevel(xp) {
  let l = 1;
  for (const e of LEVELS) if (xp >= e.xp) l = e.level;
  return l;
}

export function getNextMilestone(uniqueCount) {
  return DIVERSITY_MILESTONES.find(m => m.count > uniqueCount) || null;
}