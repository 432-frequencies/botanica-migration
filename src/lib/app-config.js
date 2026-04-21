export const APP_NAME = "W1LD";
export const APP_TAGLINE = "Field OS";
export const APP_DESCRIPTION = "Identifie les espèces, documente la biodiversité autour de toi et fais grandir ton parcours du vivant.";
export const SUPPORT_EMAIL = "support@w1ld.app";
export const APP_SITE_URL = "https://botanica-migration.vercel.app";

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const nodeEnv = typeof process !== "undefined" && process.env ? process.env : {};

export const APP_API_BASE_URL = (viteEnv.VITE_APP_API_BASE_URL || nodeEnv.VITE_APP_API_BASE_URL || APP_SITE_URL).replace(/\/$/, "");

export const FEATURE_FLAGS = Object.freeze({
  launchMode: false,
  premiumPurchases: true,
  premiumUpsells: true,
  nightSky: false,
  ancientCalendar: false,
  adminImport: false,
  knowledgeMap: false,
  learnMore: false,
  contactsImport: false,
  galleryImport: true,
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

export function hasLaunchAccess(profile, premiumOverride = null) {
  if (FEATURE_FLAGS.launchMode) return true;
  if (typeof premiumOverride === "boolean") {
    return premiumOverride;
  }
  return Boolean(profile?.is_pro);
}

export function shouldShowPremiumUpsell(profile, premiumOverride = null) {
  return FEATURE_FLAGS.premiumUpsells && !hasLaunchAccess(profile, premiumOverride);
}

export function getDailyScanLimit(profile, premiumOverride = null) {
  return hasLaunchAccess(profile, premiumOverride) ? null : 5;
}

export function isFeatureEnabled(featureName) {
  if (featureName === "pricing") return FEATURE_FLAGS.premiumPurchases;
  if (featureName === "nightSky") return FEATURE_FLAGS.nightSky;
  if (featureName === "ancientCalendar") return FEATURE_FLAGS.ancientCalendar;
  if (featureName === "adminImport") return FEATURE_FLAGS.adminImport;
  if (featureName === "knowledgeMap") return FEATURE_FLAGS.knowledgeMap;
  if (featureName === "learnMore") return FEATURE_FLAGS.learnMore;
  if (featureName === "contactsImport") return FEATURE_FLAGS.contactsImport;
  if (featureName === "galleryImport") return FEATURE_FLAGS.galleryImport;
  return false;
}

export function isNativeWebView() {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "capacitor:" || window.location.protocol === "ionic:";
}

export function createApiUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return isNativeWebView() ? `${APP_API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function getPageAlias(pageName) {
  return `/${pageName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase()}`;
}
