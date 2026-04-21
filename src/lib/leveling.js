export const LEVELS = [
  { level: 1, xp: 0, label: "Explorateur", unlock: "Tu entres dans le journal du vivant." },
  { level: 2, xp: 30, label: "Observateur", unlock: "Tes premières observations commencent à dessiner ton terrain proche." },
  { level: 3, xp: 80, label: "Observateur local", unlock: "Tes spécialisations apparaissent et ton profil devient plus lisible." },
  { level: 4, xp: 150, label: "Inventoriste", unlock: "Tes zones proches se structurent comme un atlas local." },
  { level: 5, xp: 250, label: "Naturaliste", unlock: "Tes contributions valident peu à peu une lecture cohérente du vivant." },
  { level: 6, xp: 400, label: "Gardien", unlock: "Tu peux consolider les zones déjà documentées autour de toi." },
  { level: 7, xp: 600, label: "Gardien de terrain", unlock: "Ta régularité renforce la qualité de ton journal de terrain." },
  { level: 8, xp: 900, label: "Référent", unlock: "Ton nom peut émerger comme repère utile dans une zone." },
  { level: 9, xp: 1300, label: "Référent local", unlock: "Tu commences à compter dans la reconnaissance de ta région proche." },
  { level: 10, xp: 1800, label: "Gardien du vivant", unlock: "Ton profil devient un point d'appui crédible pour documenter le terrain." },
  { level: 11, xp: 2500, label: "Référent régional", unlock: "Ta contribution rayonne au-delà de ton quartier immédiat." },
  { level: 12, xp: 3500, label: "Archiviste du vivant", unlock: "Tu bâtis une mémoire durable des espèces et des saisons." },
  { level: 13, xp: 5000, label: "Passeur du vivant", unlock: "Tes observations peuvent inspirer et guider d'autres explorateurs." },
  { level: 14, xp: 7000, label: "Légende", unlock: "Ta trace devient un repère fort dans l'histoire locale du vivant." },
  { level: 15, xp: 10000, label: "Légende du vivant", unlock: "Tu incarnes une mémoire vivante du territoire." },
];

export function getCurrentLevel(totalXP = 0) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (totalXP >= level.xp) current = level;
  }
  return current;
}

export function getNextLevel(totalXP = 0) {
  const current = getCurrentLevel(totalXP);
  return LEVELS.find((level) => level.level === current.level + 1) || null;
}

export function getLevelProgress(totalXP = 0) {
  const current = getCurrentLevel(totalXP);
  const next = getNextLevel(totalXP);
  const progressPct = next
    ? Math.min(100, ((totalXP - current.xp) / (next.xp - current.xp)) * 100)
    : 100;

  return {
    current,
    next,
    progressPct,
    xpToNext: next ? Math.max(0, next.xp - totalXP) : 0,
  };
}
