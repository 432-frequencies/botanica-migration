export const APP_NAME = "W1LD";
export const APP_TAGLINE = "Field OS";
export const APP_DESCRIPTION = "Identifie les espèces, documente la biodiversité autour de toi et fais grandir ton parcours du vivant.";
export const SUPPORT_EMAIL = "support@w1ld.app";
export const REVIEW_EMAIL = "review@w1ld.app";
export const APP_SITE_URL = "https://botanica-migration.vercel.app";
export const ADMIN_EMAIL = "energynrj6@gmail.com";

export const FEATURE_FLAGS = Object.freeze({
  launchMode: true,
  premiumPurchases: false,
  premiumUpsells: false,
  nightSky: false,
  ancientCalendar: false,
});

const PUBLIC_PATHS = new Set([
  "/login",
  "/privacy",
  "/privacy.html",
  "/support",
  "/support.html",
]);

export function normalizePathname(pathname = "/") {
  if (!pathname) return "/";
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(normalizePathname(pathname));
}

export function hasLaunchAccess(profile) {
  return FEATURE_FLAGS.launchMode || Boolean(profile?.is_pro);
}

export function isAdminEmail(email) {
  return (email || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function shouldShowPremiumUpsell(profile) {
  return FEATURE_FLAGS.premiumUpsells && !hasLaunchAccess(profile);
}

export function getDailyScanLimit(profile) {
  return hasLaunchAccess(profile) ? null : 5;
}

export function isFeatureEnabled(featureName) {
  if (featureName === "pricing") return FEATURE_FLAGS.premiumPurchases;
  if (featureName === "nightSky") return FEATURE_FLAGS.nightSky;
  if (featureName === "ancientCalendar") return FEATURE_FLAGS.ancientCalendar;
  return false;
}

export function getPageAlias(pageName) {
  return `/${pageName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase()}`;
}
