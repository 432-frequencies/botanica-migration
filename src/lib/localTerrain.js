export function countNearbyFreeZones(zoneIds = [], leadersByZone = {}, currentZoneId = null) {
  return zoneIds.filter((zoneId) => zoneId && zoneId !== currentZoneId && !leadersByZone[zoneId]).length;
}

export function buildLocalTerrainSignals({
  currentZoneId = null,
  surroundingZoneIds = [],
  leadersByZone = {},
  zoneScores = {},
  userEmail = null,
} = {}) {
  if (!userEmail || !currentZoneId) {
    return {
      nearbyOpportunities: [],
      readyTargets: [],
      pressureTargets: [],
      fragileOwnedZones: [],
      freeZonesCount: 0,
    };
  }

  const candidateZoneIds = surroundingZoneIds.filter((zoneId) => zoneId && zoneId !== currentZoneId);

  const nearbyOpportunities = candidateZoneIds
    .map((zoneId) => {
      const leader = leadersByZone[zoneId] || null;
      if (leader?.user_email === userEmail) return null;

      const userScore = zoneScores[zoneId] || 0;
      const free = !leader;
      const targetScore = free ? 1 : (leader.species_count || 0) + 1;
      const gap = Math.max(0, targetScore - userScore);
      const ready = userScore >= targetScore;

      if (!ready && !free && gap > 2) return null;

      return {
        zoneId,
        leaderName: leader?.display_name || "Libre",
        leaderScore: leader?.species_count || 0,
        userScore,
        targetScore,
        gap,
        ready,
        free,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.ready) - Number(a.ready) || a.gap - b.gap || b.userScore - a.userScore);

  const readyTargets = nearbyOpportunities.filter((target) => target.ready);
  const pressureTargets = nearbyOpportunities
    .filter((target) => !target.ready && !target.free && target.gap > 0 && target.gap <= 2)
    .sort((a, b) => a.gap - b.gap || b.userScore - a.userScore);

  const fragileOwnedZones = candidateZoneIds
    .map((zoneId) => {
      const leader = leadersByZone[zoneId] || null;
      if (!leader || leader.user_email !== userEmail) return null;

      const score = Math.max(zoneScores[zoneId] || 0, leader.species_count || 0);
      if (score > 3) return null;

      return { zoneId, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  return {
    nearbyOpportunities,
    readyTargets,
    pressureTargets,
    fragileOwnedZones,
    freeZonesCount: countNearbyFreeZones(candidateZoneIds, leadersByZone, currentZoneId),
  };
}
