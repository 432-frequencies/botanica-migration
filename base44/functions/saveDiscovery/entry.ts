import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SPEED_LIMIT_CHEAT = 150;
const SPEED_LIMIT_FLAG = 50;
const SPEED_LIMIT_WARN = 20;
const MIN_SCAN_INTERVAL = 3;
const MIN_SCAN_WARN = 10;
const MIN_SCAN_NORMAL = 30;
const MAX_SCANS_PER_MINUTE = 10;
const MAX_NEW_SPECIES_PER_HOUR = 20;
const DUPLICATE_ZONE_WINDOW = 600000;
const TRUST_PENALTY_SPEED = 15;
const TRUST_PENALTY_SPAM = 10;
const TRUST_PENALTY_FARMING = 20;
const TRUST_PENALTY_SUSPICIOUS = 5;
const SUSPICIOUS_THRESHOLD = 3; // anomalies pour flag

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function updateTrustScore(base44, userEmail, violations = {}) {
  try {
    const trust = await base44.entities.UserTrustScore.filter(
      { user_email: userEmail },
      "-created_date",
      1
    );
    const existing = trust[0] || {
      user_email: userEmail,
      trust_score: 100,
      violations: { speed_anomalies: 0, spam_incidents: 0, farming_attempts: 0, suspicious_patterns: 0 }
    };

    let newScore = existing.trust_score;
    const newViolations = { ...existing.violations };

    if (violations.speed) {
      newScore -= TRUST_PENALTY_SPEED;
      newViolations.speed_anomalies = (newViolations.speed_anomalies || 0) + 1;
    }
    if (violations.spam) {
      newScore -= TRUST_PENALTY_SPAM;
      newViolations.spam_incidents = (newViolations.spam_incidents || 0) + 1;
    }
    if (violations.farming) {
      newScore -= TRUST_PENALTY_FARMING;
      newViolations.farming_attempts = (newViolations.farming_attempts || 0) + 1;
    }
    if (violations.suspicious) {
      newScore -= TRUST_PENALTY_SUSPICIOUS;
      newViolations.suspicious_patterns = (newViolations.suspicious_patterns || 0) + 1;
    }

    newScore = Math.max(0, Math.min(100, newScore));

    if (trust.length > 0) {
      await base44.entities.UserTrustScore.update(existing.id, {
        trust_score: newScore,
        violations: newViolations,
        last_violation: violations.farming || violations.spam || violations.speed ? new Date().toISOString() : existing.last_violation,
        surveillance_active: newScore < 70,
        blocked_until: newScore < 10 ? new Date(Date.now() + 3600000).toISOString() : null,
      });
    } else {
      await base44.entities.UserTrustScore.create({
        user_email: userEmail,
        trust_score: newScore,
        violations: newViolations,
        last_violation: violations.farming || violations.spam || violations.speed ? new Date().toISOString() : null,
        surveillance_active: newScore < 70,
      });
    }

    return newScore;
  } catch (e) {
    console.error("Trust score update error:", e);
    return 100;
  }
}

async function getTrustScore(base44, userEmail) {
  try {
    const trust = await base44.entities.UserTrustScore.filter(
      { user_email: userEmail },
      "-created_date",
      1
    );
    return trust[0]?.trust_score || 100;
  } catch (e) {
    return 100;
  }
}

async function checkGPSValidity(base44, userEmail, lat, lng) {
  if (!lat || !lng) return { valid: true, issue: null };

  try {
    const userKey = `gps_${userEmail}`;
    const lastGPS = await base44.cache.get(userKey);
    const now = Date.now();

    if (lastGPS) {
      const { lat: lastLat, lng: lastLng, time: lastTime } = lastGPS;
      const timeDiff = (now - lastTime) / 1000 / 3600;
      const distance = haversineDistance(lastLat, lastLng, lat, lng);
      const speed = timeDiff > 0 ? distance / timeDiff : 0;

      if (speed > SPEED_LIMIT_CHEAT) {
        console.log(`[CHEAT] User ${userEmail}: speed ${speed.toFixed(1)} km/h`);
        await updateTrustScore(base44, userEmail, { speed: true });
        return { valid: false, issue: "SPEED_CHEAT", speed };
      }

      if (speed > SPEED_LIMIT_FLAG) {
        console.log(`[FLAG] User ${userEmail}: speed ${speed.toFixed(1)} km/h`);
        await updateTrustScore(base44, userEmail, { suspicious: true });
        return { valid: true, issue: "SPEED_SUSPICIOUS", speed };
      }

      if (speed > SPEED_LIMIT_WARN) {
        console.log(`[WARN] User ${userEmail}: speed ${speed.toFixed(1)} km/h`);
        return { valid: true, issue: "SPEED_WARN", speed };
      }
    }

    await base44.cache.set(userKey, { lat, lng, time: now }, 86400);
    return { valid: true, issue: null };
  } catch (e) {
    console.error("GPS check error:", e);
    return { valid: true, issue: null };
  }
}

async function detectSuspiciousBehavior(base44, userEmail) {
  try {
    const anomalies = [];
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    const sixHoursAgo = now - 21600000;

    // Récupérer 50 derniers scans
    const recentScans = await base44.entities.PlantDiscovery.filter(
      { user_email: userEmail, created_date: { $gte: new Date(oneDayAgo).toISOString() } },
      "-created_date",
      50
    );

    if (recentScans.length < 3) return { suspicious: false, anomalies: [] };

    // Vérifier activité 24/7
    const timestamps = recentScans.map(s => new Date(s.created_date).getHours());
    const uniqueHours = new Set(timestamps).size;
    if (uniqueHours >= 20) anomalies.push("ACTIVITY_24_7");

    // Vérifier régularité suspecte (intervalles trop réguliers)
    const intervals = [];
    for (let i = 1; i < recentScans.length; i++) {
      const t1 = new Date(recentScans[i - 1].created_date).getTime();
      const t2 = new Date(recentScans[i].created_date).getTime();
      intervals.push((t1 - t2) / 1000);
    }
    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sq, n) => sq + Math.pow(n - avgInterval, 2), 0) / intervals.length
    );
    if (stdDev < 5 && avgInterval > 30) anomalies.push("SUSPICIOUS_REGULARITY");

    // Vérifier déplacements rapides répétés
    let fastMoveCount = 0;
    for (let i = 1; i < Math.min(10, recentScans.length); i++) {
      const s1 = recentScans[i - 1];
      const s2 = recentScans[i];
      if (s1.latitude && s1.longitude && s2.latitude && s2.longitude) {
        const dist = haversineDistance(s1.latitude, s1.longitude, s2.latitude, s2.longitude);
        const timeDiff = (new Date(s1.created_date).getTime() - new Date(s2.created_date).getTime()) / 1000 / 3600;
        const speed = timeDiff > 0 ? dist / timeDiff : 0;
        if (speed > 30 && speed < 100) fastMoveCount++;
      }
    }
    if (fastMoveCount >= 3) anomalies.push("PATTERN_FAST_MOVES");

    // Vérifier concentration géographique (farming pattern)
    if (recentScans.length >= 5) {
      const lats = recentScans.slice(0, 5).map(s => s.latitude).filter(l => l);
      const lngs = recentScans.slice(0, 5).map(s => s.longitude).filter(l => l);
      if (lats.length > 0) {
        const latRange = Math.max(...lats) - Math.min(...lats);
        const lngRange = Math.max(...lngs) - Math.min(...lngs);
        if (latRange < 0.005 && lngRange < 0.005) anomalies.push("CONCENTRATED_ZONE");
      }
    }

    const suspicious = anomalies.length >= SUSPICIOUS_THRESHOLD;

    if (suspicious) {
      console.log(`[SUSPICIOUS] User ${userEmail}: ${anomalies.join(", ")}`);
      await updateTrustScore(base44, userEmail, { suspicious: true });
    }

    return { suspicious, anomalies };
  } catch (e) {
    console.error("Suspicious behavior check error:", e);
    return { suspicious: false, anomalies: [] };
  }
}

async function checkFarming(base44, userEmail, commonName, latitude, longitude) {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Vérifier duplicate dans la même zone récemment
    if (latitude && longitude && commonName) {
      const recentSame = await base44.entities.PlantDiscovery.filter(
        { user_email: userEmail, common_name: commonName },
        "-created_date",
        1
      );
      if (recentSame.length > 0) {
        const lastScan = recentSame[0];
        const timeSince = now - new Date(lastScan.created_date).getTime();
        if (timeSince < DUPLICATE_ZONE_WINDOW && lastScan.latitude && lastScan.longitude) {
          const dist = haversineDistance(latitude, longitude, lastScan.latitude, lastScan.longitude);
          if (dist < 0.1) {
            await updateTrustScore(base44, userEmail, { farming: true });
            return { valid: false, issue: "DUPLICATE_ZONE" };
          }
        }
      }
    }

    // Vérifier trop de nouvelles espèces par heure
    const recentHour = await base44.entities.PlantDiscovery.filter(
      { user_email: userEmail },
      "-created_date",
      MAX_NEW_SPECIES_PER_HOUR + 5
    );
    const recentNewSpecies = recentHour.filter(s =>
      new Date(s.created_date).getTime() > oneHourAgo
    );
    if (recentNewSpecies.length >= MAX_NEW_SPECIES_PER_HOUR) {
      await updateTrustScore(base44, userEmail, { farming: true });
      return { valid: false, issue: "NEW_SPECIES_RATE" };
    }

    return { valid: true, issue: null };
  } catch (e) {
    console.error("Farming check error:", e);
    return { valid: true, issue: null };
  }
}

async function checkScanRate(base44, userEmail) {
  try {
    const scanKey = `scans_${userEmail}`;
    const scans = await base44.cache.get(scanKey) || [];
    const now = Date.now();

    const recentScans = scans.filter(t => now - t < 60000);

    if (recentScans.length > 0) {
      const lastScan = recentScans[recentScans.length - 1];
      const timeSinceLast = (now - lastScan) / 1000;

      if (timeSinceLast < MIN_SCAN_INTERVAL) {
        console.log(`[SPAM] User ${userEmail}: rejected`);
        await updateTrustScore(base44, userEmail, { spam: true });
        return { valid: false, issue: "SPAM_REJECTED", timeSinceLast };
      }

      if (timeSinceLast < MIN_SCAN_WARN) {
        console.log(`[SPAM-WARN] User ${userEmail}: reduced XP`);
      }
    }

    if (recentScans.length >= MAX_SCANS_PER_MINUTE) {
      console.log(`[RATE-LIMIT] User ${userEmail}`);
      await updateTrustScore(base44, userEmail, { spam: true });
      return { valid: false, issue: "RATE_LIMIT", scansPerMinute: recentScans.length };
    }

    recentScans.push(now);
    await base44.cache.set(scanKey, recentScans, 60);

    const timeSinceLast = recentScans.length > 1 ? (now - recentScans[recentScans.length - 2]) / 1000 : 0;
    const xpMultiplier = timeSinceLast < MIN_SCAN_NORMAL ? 0.5 : 1;

    return {
      valid: true,
      issue: timeSinceLast < MIN_SCAN_WARN ? "SPAM_WARN" : null,
      xpMultiplier,
      timeSinceLast,
    };
  } catch (e) {
    console.error("Scan rate check error:", e);
    return { valid: true, xpMultiplier: 1 };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    console.log('[saveDiscovery] incoming request');
    const user = await base44.auth.me();

    if (!user) {
      console.error('[saveDiscovery] 401 — auth.me() returned null');
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log('[saveDiscovery] user:', user.email);

    const trustScore = await getTrustScore(base44, user.email);
    if (trustScore < 10) {
      console.log(`[BLOCKED] User ${user.email}: trust score ${trustScore}`);
      return Response.json({
        error: "ACCOUNT_BLOCKED",
        message: "Compte suspendu suite à comportement suspect.",
      }, { status: 403 });
    }

    const body = await req.json();
    const {
      category = "plant",
      common_name,
      scientific_name,
      family,
      photo_url,
      thumbnail_url,
      rarity = "commune",
      is_edible = false,
      is_toxic = false,
      is_cannabis = false,
      strain_type = "",
      description,
      edibility_details,
      medicinal_uses,
      anecdote,
      habitat,
      behavior,
      latitude,
      longitude,
      confidence,
      location_name,
    } = body;

    const gpsCheck = await checkGPSValidity(base44, user.email, latitude, longitude);
    if (!gpsCheck.valid) {
      console.log(`[REJECT] Discovery from ${user.email}: GPS cheat detected`);
      return Response.json({
        error: "INVALID_LOCATION",
        message: "Localisation invalide — déplacement trop rapide détecté.",
        details: gpsCheck,
      }, { status: 403 });
    }

    const scanCheck = await checkScanRate(base44, user.email);
    if (!scanCheck.valid) {
      const msg = scanCheck.issue === "SPAM_REJECTED"
        ? "Trop rapide — attends quelques secondes."
        : "Trop de scans — limite d'identifications atteinte.";
      console.log(`[REJECT] Discovery from ${user.email}: ${scanCheck.issue}`);
      return Response.json({
        error: scanCheck.issue,
        message: msg,
        details: scanCheck,
      }, { status: 429 });
    }

    const farmingCheck = await checkFarming(base44, user.email, common_name, latitude, longitude);
    if (!farmingCheck.valid) {
      const msg = farmingCheck.issue === "DUPLICATE_ZONE"
        ? "Même espèce détectée récemment à cet endroit."
        : "Trop d'espèces nouvelles — ralentis.";
      console.log(`[REJECT] Discovery from ${user.email}: ${farmingCheck.issue}`);
      return Response.json({
        error: farmingCheck.issue,
        message: msg,
        details: farmingCheck,
      }, { status: 429 });
    }

    // Détecter comportements suspects
    const suspiciousCheck = await detectSuspiciousBehavior(base44, user.email);

    const existing = await base44.entities.PlantDiscovery.filter(
      { user_email: user.email, common_name },
      "-created_date",
      1
    );
    const isNewSpecies = existing.length === 0;
    const xpBase = isNewSpecies ? 10 : 5;
    const xpFinal = Math.round(xpBase * scanCheck.xpMultiplier);

    const discovery = await base44.entities.PlantDiscovery.create({
      user_email: user.email,
      category,
      common_name,
      scientific_name,
      family,
      photo_url,
      thumbnail_url,
      rarity,
      is_edible,
      is_toxic,
      is_cannabis,
      strain_type,
      description,
      edibility_details,
      medicinal_uses,
      anecdote,
      habitat,
      behavior,
      latitude,
      longitude,
      location_name,
      confidence,
      points_earned: xpFinal,
      discovered_date: new Date().toISOString().split('T')[0],
      flag_suspicious: suspiciousCheck.suspicious,
      anomalies: suspiciousCheck.anomalies,
    });

    const profileRes = await base44.entities.UserProfile.filter(
      { user_email: user.email },
      "-created_date",
      1
    );
    const profile = profileRes[0] || { user_email: user.email, total_points: 0, total_plants: 0 };

    let xpPenaltyMultiplier = 1;
    if (trustScore < 50) xpPenaltyMultiplier = 0.5;
    if (trustScore < 30) xpPenaltyMultiplier = 0;

    const xpFinalAdjusted = Math.round(xpFinal * xpPenaltyMultiplier);
    const newPoints = (profile.total_points || 0) + xpFinalAdjusted;
    const newPlants = (profile.total_plants || 0) + (isNewSpecies ? 1 : 0);

    if (trustScore < 100) {
      await updateTrustScore(base44, user.email, {});
    }

    if (profileRes.length > 0) {
      await base44.entities.UserProfile.update(profile.id, {
        total_points: newPoints,
        total_plants: newPlants,
        daily_identifications_count: (profile.daily_identifications_count || 0) + 1,
        last_scan_date: new Date().toISOString().split('T')[0],
      });
    } else {
      await base44.entities.UserProfile.create({
        user_email: user.email,
        total_points: newPoints,
        total_plants: newPlants,
        daily_identifications_count: 1,
        last_scan_date: new Date().toISOString().split('T')[0],
      });
    }

    const countForZones = trustScore > 50 && !suspiciousCheck.suspicious;
    if (latitude && longitude && countForZones) {
      const gridLat = Math.floor((latitude - 42) / (52 - 42) * 10);
      const gridLng = Math.floor((longitude + 6) / (8 + 6) * 10);
      const zoneId = `${gridLat}_${gridLng}`;

      const zoneLeaders = await base44.entities.ZoneLeader.filter(
        { zone_id: zoneId, user_email: user.email },
        "-updated_date",
        1
      );

      if (zoneLeaders.length > 0) {
        await base44.entities.ZoneLeader.update(zoneLeaders[0].id, {
          species_count: (zoneLeaders[0].species_count || 0) + (isNewSpecies ? 1 : 0),
          last_updated: new Date().toISOString(),
        });
      } else if (isNewSpecies) {
        await base44.entities.ZoneLeader.create({
          zone_id: zoneId,
          user_email: user.email,
          display_name: user.full_name,
          species_count: 1,
          last_updated: new Date().toISOString(),
        });
      }
    }

    const warnings = [];
    if (gpsCheck.issue === "SPEED_SUSPICIOUS") warnings.push("Déplacement rapide détecté");
    if (gpsCheck.issue === "SPEED_WARN") warnings.push("Vérification géolocalisation");
    if (scanCheck.issue === "SPAM_WARN") warnings.push("XP réduit — trop rapide");

    if (xpFinalAdjusted < xpFinal) {
      warnings.push(`XP réduit (trust: ${trustScore})`);
    }
    if (trustScore < 30) {
      warnings.push("Zones désactivées — activité normale restaure l'accès");
    }
    if (suspiciousCheck.suspicious) {
      warnings.push(`Activité suspecte détectée: ${suspiciousCheck.anomalies.join(", ")}`);
    }
    if (trustScore <= 50) {
      warnings.push("Zones non comptabilisées — améliore ton score de confiance");
    }

    return Response.json({
      success: true,
      discovery_id: discovery.id,
      common_name,
      xp_earned: xpFinalAdjusted,
      xp_base: xpFinal,
      is_new_species: isNewSpecies,
      level: Math.floor(newPoints / 100) + 1,
      total_points: newPoints,
      trust_score: trustScore,
      suspicious: suspiciousCheck.suspicious,
      anomalies: suspiciousCheck.anomalies,
      warnings,
    });
  } catch (error) {
    console.error("[saveDiscovery] CRASH:", error.message, error.stack);
    return Response.json({
      error: error.message,
    }, { status: 500 });
  }
});