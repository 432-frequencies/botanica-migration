/**
 * W1LD Subscription Tiers & Pricing
 * Freemium model optimized for 50% conversion
 */

export const SUBSCRIPTION_TIERS = {
  FREE: {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    currency: 'EUR',
    interval: null,
    scansPerDay: 2,
    model: 'gemini', // Gemini Flash (lower cost)
    features: [
      '2 scans par jour',
      'Identification basique',
      'Accès collection',
      'Cartes interactives'
    ],
    limits: {
      daily_scans: 2,
      monthly_scans: 60,
      premium_features: false,
      ghost_species: false,
      audio_identification: false
    }
  },

  PAY_PER_USE: {
    id: 'pay_per_use',
    name: 'À la carte',
    price: 0.50,
    currency: 'EUR',
    interval: 'per_scan',
    model: 'claude', // Claude Sonnet 4 (premium quality)
    features: [
      'Scan premium unique',
      'Identification Claude AI',
      'Descriptions complètes',
      'Pas d\'engagement'
    ],
    limits: {
      daily_scans: null, // Unlimited if paid
      monthly_scans: null,
      premium_features: true,
      ghost_species: true,
      audio_identification: true
    }
  },

  MONTHLY_BASIC: {
    id: 'monthly_basic',
    name: 'Explorateur',
    price: 2.00,
    currency: 'EUR',
    interval: 'month',
    scansPerDay: 10,
    model: 'claude',
    stripePrice: 'price_monthly_basic_2eur', // À créer dans Stripe
    features: [
      '10 scans par jour',
      'Identification Claude AI',
      'Espèces fantômes',
      'Reconnaissance audio',
      'Sans publicité'
    ],
    limits: {
      daily_scans: 10,
      monthly_scans: 300,
      premium_features: true,
      ghost_species: true,
      audio_identification: true
    },
    badge: 'Populaire'
  },

  MONTHLY_PRO: {
    id: 'monthly_pro',
    name: 'Naturaliste',
    price: 5.00,
    currency: 'EUR',
    interval: 'month',
    scansPerDay: 50,
    model: 'claude',
    stripePrice: 'price_monthly_pro_5eur',
    features: [
      '50 scans par jour',
      'Identification Claude AI',
      'Export données (CSV)',
      'Statistiques avancées',
      'Support prioritaire'
    ],
    limits: {
      daily_scans: 50,
      monthly_scans: 1500,
      premium_features: true,
      ghost_species: true,
      audio_identification: true,
      csv_export: true,
      priority_support: true
    },
    badge: 'Pro'
  },

  ANNUAL_BASIC: {
    id: 'annual_basic',
    name: 'Explorateur Annuel',
    price: 19.00,
    currency: 'EUR',
    interval: 'year',
    scansPerDay: 10,
    model: 'claude',
    stripePrice: 'price_annual_basic_19eur',
    monthlyEquivalent: 1.58,
    savings: '21% d\'économie',
    features: [
      '10 scans par jour',
      'Identification Claude AI',
      'Espèces fantômes',
      'Reconnaissance audio',
      '2 mois offerts'
    ],
    limits: {
      daily_scans: 10,
      monthly_scans: 300,
      premium_features: true,
      ghost_species: true,
      audio_identification: true
    },
    badge: 'Meilleur rapport'
  },

  ANNUAL_PRO: {
    id: 'annual_pro',
    name: 'Naturaliste Annuel',
    price: 50.00,
    currency: 'EUR',
    interval: 'year',
    scansPerDay: 50,
    model: 'claude',
    stripePrice: 'price_annual_pro_50eur',
    monthlyEquivalent: 4.17,
    savings: '17% d\'économie',
    features: [
      '50 scans par jour',
      'Identification Claude AI',
      'Export données illimité',
      'Badge exclusif',
      '1 mois offert'
    ],
    limits: {
      daily_scans: 50,
      monthly_scans: 1500,
      premium_features: true,
      ghost_species: true,
      audio_identification: true,
      csv_export: true,
      priority_support: true,
      exclusive_badge: true
    },
    badge: 'Premium'
  }
};

/**
 * Get user's current tier based on profile
 */
export function getUserTier(profile) {
  if (!profile) return SUBSCRIPTION_TIERS.FREE;

  const { subscription_tier, subscription_status } = profile;

  // Check if subscription is active
  if (subscription_status !== 'active' && subscription_status !== 'trialing') {
    return SUBSCRIPTION_TIERS.FREE;
  }

  // Map subscription tier to tier object
  const tier = SUBSCRIPTION_TIERS[subscription_tier?.toUpperCase()];
  return tier || SUBSCRIPTION_TIERS.FREE;
}

/**
 * Check if user can scan (daily limit)
 */
export function canScan(profile, dailyScansCount = 0) {
  const tier = getUserTier(profile);

  if (tier.limits.daily_scans === null) {
    return { allowed: true, remaining: null }; // Unlimited
  }

  const remaining = tier.limits.daily_scans - dailyScansCount;
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    limit: tier.limits.daily_scans
  };
}

/**
 * Get model to use for identification
 */
export function getIdentificationModel(profile) {
  const tier = getUserTier(profile);
  return tier.model || 'gemini';
}

/**
 * Calculate next reset time (midnight local)
 */
export function getNextResetTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Format time remaining until reset
 */
export function formatTimeUntilReset() {
  const now = new Date();
  const reset = getNextResetTime();
  const diff = reset - now;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get upgrade recommendations based on usage
 */
export function getUpgradeRecommendation(profile, avgDailyScans) {
  const currentTier = getUserTier(profile);

  // If free user scanning near limit, recommend monthly basic
  if (currentTier.id === 'free' && avgDailyScans >= 1.5) {
    return {
      tier: SUBSCRIPTION_TIERS.MONTHLY_BASIC,
      reason: 'Tu approches ta limite quotidienne'
    };
  }

  // If monthly basic user scanning > 8/day, recommend monthly pro
  if (currentTier.id === 'monthly_basic' && avgDailyScans >= 8) {
    return {
      tier: SUBSCRIPTION_TIERS.MONTHLY_PRO,
      reason: 'Tu utilises beaucoup W1LD, passe Pro !'
    };
  }

  // If monthly user, recommend annual (savings)
  if (currentTier.interval === 'month') {
    const annualEquivalent = currentTier.id === 'monthly_basic'
      ? SUBSCRIPTION_TIERS.ANNUAL_BASIC
      : SUBSCRIPTION_TIERS.ANNUAL_PRO;

    return {
      tier: annualEquivalent,
      reason: `Économise ${annualEquivalent.savings} avec l'annuel`
    };
  }

  return null;
}

/**
 * Format price display
 */
export function formatPrice(tier) {
  if (tier.price === 0) return 'Gratuit';

  const price = tier.price.toFixed(2).replace('.', ',');

  if (tier.interval === 'per_scan') {
    return `${price}€/scan`;
  }

  if (tier.interval === 'month') {
    return `${price}€/mois`;
  }

  if (tier.interval === 'year') {
    return `${price}€/an`;
  }

  return `${price}€`;
}
