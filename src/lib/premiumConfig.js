import { Capacitor } from "@capacitor/core";

export const PREMIUM_PLAN_NAME = "W1LD Plus";
export const PREMIUM_ENTITLEMENT_ID = import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || "premium";
export const PREMIUM_APPLE_API_KEY = import.meta.env.VITE_REVENUECAT_APPLE_API_KEY || "";
export const PREMIUM_APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

const PACKAGE_PRIORITY = {
  ANNUAL: 0,
  MONTHLY: 1,
  SIX_MONTH: 2,
  THREE_MONTH: 3,
  TWO_MONTH: 4,
  WEEKLY: 5,
  LIFETIME: 6,
  CUSTOM: 7,
  UNKNOWN: 8,
};

export function isNativeIOSApp() {
  return Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
}

export function sortPremiumPackages(packages = []) {
  return [...packages].sort((left, right) => {
    const leftPriority = PACKAGE_PRIORITY[String(left?.packageType || "UNKNOWN").toUpperCase()] ?? 99;
    const rightPriority = PACKAGE_PRIORITY[String(right?.packageType || "UNKNOWN").toUpperCase()] ?? 99;
    return leftPriority - rightPriority;
  });
}

export function getPremiumPackageLabel(aPackage) {
  const packageType = String(aPackage?.packageType || "").toUpperCase();

  switch (packageType) {
    case "ANNUAL":
      return "Annuel";
    case "MONTHLY":
      return "Mensuel";
    case "SIX_MONTH":
      return "6 mois";
    case "THREE_MONTH":
      return "3 mois";
    case "TWO_MONTH":
      return "2 mois";
    case "WEEKLY":
      return "Hebdomadaire";
    case "LIFETIME":
      return "Accès permanent";
    default:
      return aPackage?.product?.title || aPackage?.identifier || "Offre App Store";
  }
}

export function getPremiumPackageCaption(aPackage) {
  const packageType = String(aPackage?.packageType || "").toUpperCase();

  switch (packageType) {
    case "ANNUAL":
      return "Le meilleur rythme pour documenter toute l'année.";
    case "MONTHLY":
      return "Pour lancer un cycle de terrain plus intense.";
    case "SIX_MONTH":
    case "THREE_MONTH":
    case "TWO_MONTH":
      return "Une formule intermédiaire gérée par l'App Store.";
    case "WEEKLY":
      return "Une formule courte, utile pour un test terrain.";
    case "LIFETIME":
      return "Déverrouillage unique si cette option est active.";
    default:
      return "Abonnement géré par Apple, annulation à tout moment.";
  }
}

export function getPremiumPriceLabel(aPackage) {
  return (
    aPackage?.product?.priceString ||
    aPackage?.storeProduct?.priceString ||
    aPackage?.product?.formattedPrice ||
    ""
  );
}

export function getPremiumProductIdentifier(aPackage) {
  return (
    aPackage?.product?.identifier ||
    aPackage?.product?.productIdentifier ||
    aPackage?.storeProduct?.identifier ||
    aPackage?.storeProduct?.productIdentifier ||
    ""
  );
}

export function getPremiumHeroFeatures() {
  return [
    "Scans illimités dans l'app iPhone",
    "Alternatives d'identification pour comparer calmement",
    "Fiches détaillées: usages, comestibilité et notes de terrain",
    "File hors ligne étendue pour garder le terrain fluide",
  ];
}

export function formatPremiumDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
