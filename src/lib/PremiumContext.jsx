import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { LOG_LEVEL, Purchases } from "@revenuecat/purchases-capacitor";
import { RevenueCatUI } from "@revenuecat/purchases-capacitor-ui";
import { invalidateUserDataCache } from "@/api/getUserProfile";
import { syncPremiumStatus } from "@/api/premiumStatus";
import { useAuth } from "@/lib/AuthContext";
import {
  PREMIUM_APPLE_API_KEY,
  PREMIUM_APPLE_SUBSCRIPTIONS_URL,
  PREMIUM_ENTITLEMENT_ID,
  PREMIUM_PLAN_NAME,
  getPremiumPackageCaption,
  getPremiumPackageLabel,
  getPremiumPriceLabel,
  getPremiumProductIdentifier,
  isNativeIOSApp,
  sortPremiumPackages,
} from "@/lib/premiumConfig";

const PremiumContext = createContext(null);

const STORAGE_KEY = "w1ld-premium-cache-v1";
const IS_DEV = import.meta.env.DEV;

function readCachedPremiumState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedPremiumState(value) {
  try {
    if (!value) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

function entitlementSnapshotFromCustomerInfo(customerInfo) {
  const entitlement = customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID] || null;
  if (!entitlement) {
    return {
      configured: true,
      entitlementId: PREMIUM_ENTITLEMENT_ID,
      isPremium: false,
      expirationDate: null,
      purchaseDate: null,
      productIdentifier: null,
      willRenew: false,
      managementURL: customerInfo?.managementURL || null,
      source: "revenuecat-client",
    };
  }

  return {
    configured: true,
    entitlementId: PREMIUM_ENTITLEMENT_ID,
    isPremium: Boolean(entitlement?.isActive ?? true),
    expirationDate: entitlement?.expirationDate || null,
    purchaseDate: entitlement?.latestPurchaseDate || entitlement?.originalPurchaseDate || null,
    productIdentifier: entitlement?.productIdentifier || null,
    willRenew: entitlement?.willRenew ?? false,
    managementURL: customerInfo?.managementURL || null,
    source: "revenuecat-client",
  };
}

function getReadablePurchaseError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || error?.readableErrorCode || "").toLowerCase();

  if (error?.userCancelled || code.includes("cancel") || message.includes("cancel")) {
    return { status: "cancelled", message: "Aucun achat n'a été effectué." };
  }

  if (code.includes("pending") || message.includes("pending")) {
    return { status: "pending", message: "L'achat est en attente de validation par Apple." };
  }

  if (code.includes("network") || message.includes("network")) {
    return { status: "error", message: "Connexion instable pendant l'achat. Réessaie dans un instant." };
  }

  return {
    status: "error",
    message: error?.message || "Impossible de finaliser l'abonnement pour le moment.",
  };
}

export function PremiumProvider({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const cachedStateRef = useRef(readCachedPremiumState());
  const listenerIdRef = useRef(null);
  const configuredUserIdRef = useRef(null);
  const userEmailRef = useRef(user?.email || null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [serverStatus, setServerStatus] = useState(cachedStateRef.current);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [supportsPurchases, setSupportsPurchases] = useState(false);

  const nativeIOS = isNativeIOSApp();
  const providerAvailable = nativeIOS && Boolean(PREMIUM_APPLE_API_KEY);

  useEffect(() => {
    userEmailRef.current = user?.email || null;
  }, [user?.email]);

  const applyCustomerInfo = useCallback(async (nextCustomerInfo, { syncServer = false } = {}) => {
    if (!nextCustomerInfo) return null;

    setCustomerInfo(nextCustomerInfo);
    const snapshot = entitlementSnapshotFromCustomerInfo(nextCustomerInfo);
    cachedStateRef.current = snapshot;
    setServerStatus((prev) => (prev ? { ...prev, ...snapshot } : snapshot));
    writeCachedPremiumState(snapshot);

    if (syncServer && userEmailRef.current) {
      try {
        const synced = await syncPremiumStatus();
        setServerStatus((prev) => (prev ? { ...prev, ...synced } : synced));
        writeCachedPremiumState({ ...snapshot, ...synced });
        invalidateUserDataCache(userEmailRef.current);
      } catch (error) {
        if (IS_DEV) {
          console.warn("[Premium] server sync failed:", error?.message || error);
        }
      }
    }

    return snapshot;
  }, []);

  const refreshSubscription = useCallback(async ({ quiet = false } = {}) => {
    if (!providerAvailable || !user?.id) {
      return serverStatus;
    }

    if (!quiet) setIsRefreshing(true);
    setLastError(null);

    try {
      const [{ customerInfo: nextCustomerInfo }, nextOfferings, paymentSupport] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings().catch(() => null),
        Purchases.canMakePayments().catch(() => ({ canMakePayments: true })),
      ]);

      if (nextOfferings) {
        setOfferings(nextOfferings);
      }
      setSupportsPurchases(Boolean(paymentSupport?.canMakePayments ?? true));
      return await applyCustomerInfo(nextCustomerInfo, { syncServer: true });
    } catch (error) {
      if (!quiet) {
        setLastError("Impossible de rafraîchir l'abonnement pour le moment.");
      }
      if (IS_DEV) {
        console.warn("[Premium] refresh failed:", error?.message || error);
      }
      return serverStatus;
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, [applyCustomerInfo, providerAvailable, serverStatus, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (isLoadingAuth) return;

      if (!providerAvailable || !user?.id) {
        setSupportsPurchases(false);
        setOfferings(null);
        setCustomerInfo(null);
        setIsLoading(false);
        if (!user) {
          configuredUserIdRef.current = null;
          cachedStateRef.current = null;
          setServerStatus(null);
          writeCachedPremiumState(null);
        }
        return;
      }

      setIsLoading(true);
      setLastError(null);

      try {
        const { isConfigured } = await Purchases.isConfigured().catch(() => ({ isConfigured: false }));

        if (!isConfigured) {
          await Purchases.configure({
            apiKey: PREMIUM_APPLE_API_KEY,
            appUserID: user.id,
          });

          if (IS_DEV) {
            await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }).catch(() => {});
          }
        } else {
          const { appUserID } = await Purchases.getAppUserID().catch(() => ({ appUserID: null }));
          if (appUserID !== user.id) {
            const loginResult = await Purchases.logIn({ appUserID: user.id });
            await applyCustomerInfo(loginResult?.customerInfo, { syncServer: true });
          }
        }

        configuredUserIdRef.current = user.id;

        if (!listenerIdRef.current) {
          listenerIdRef.current = await Purchases.addCustomerInfoUpdateListener((updatedInfo) => {
            void applyCustomerInfo(updatedInfo, { syncServer: true });
          });
        }

        if (cancelled) return;
        await refreshSubscription({ quiet: true });
      } catch (error) {
        if (!cancelled) {
          setLastError("Impossible de préparer l'abonnement App Store pour le moment.");
          setSupportsPurchases(false);
          if (IS_DEV) {
            console.warn("[Premium] boot failed:", error?.message || error);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [applyCustomerInfo, isLoadingAuth, providerAvailable, refreshSubscription, user?.id]);

  useEffect(() => {
    if (!providerAvailable || !user?.id) return undefined;

    let listenerHandle = null;
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void refreshSubscription({ quiet: true });
      }
    }).then((handle) => {
      listenerHandle = handle;
    }).catch(() => {});

    return () => {
      listenerHandle?.remove();
    };
  }, [providerAvailable, refreshSubscription, user?.id]);

  useEffect(() => () => {
    if (!listenerIdRef.current) return;
    void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerIdRef.current }).catch(() => {});
    listenerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (user) return;
    if (!providerAvailable) return;

    Purchases.isConfigured()
      .then(({ isConfigured }) => {
        if (!isConfigured) return null;
        return Purchases.logOut();
      })
      .catch(() => null);
  }, [providerAvailable, user]);

  const purchasePackage = useCallback(async (aPackage) => {
    if (!providerAvailable || !aPackage) {
      return { ok: false, status: "unavailable", message: "Aucun abonnement App Store n'est disponible sur cet appareil." };
    }

    setIsPurchasing(true);
    setLastError(null);

    try {
      const purchaseResult = await Purchases.purchasePackage({ aPackage });
      await applyCustomerInfo(purchaseResult?.customerInfo, { syncServer: true });
      invalidateUserDataCache(user?.email);
      return { ok: true, status: "purchased", customerInfo: purchaseResult?.customerInfo };
    } catch (error) {
      const readable = getReadablePurchaseError(error);
      if (readable.status === "error") {
        setLastError(readable.message);
      }
      return { ok: false, ...readable };
    } finally {
      setIsPurchasing(false);
    }
  }, [applyCustomerInfo, providerAvailable, user?.email]);

  const restorePurchases = useCallback(async () => {
    if (!providerAvailable) {
      return { ok: false, status: "unavailable", message: "La restauration des achats n'est disponible que dans l'app iPhone." };
    }

    setIsRestoring(true);
    setLastError(null);

    try {
      const restoreResult = await Purchases.restorePurchases();
      await applyCustomerInfo(restoreResult?.customerInfo, { syncServer: true });
      invalidateUserDataCache(user?.email);
      return {
        ok: true,
        status: entitlementSnapshotFromCustomerInfo(restoreResult?.customerInfo)?.isPremium ? "restored" : "no_purchases",
        customerInfo: restoreResult?.customerInfo,
      };
    } catch (error) {
      const readable = getReadablePurchaseError(error);
      setLastError(readable.message);
      return { ok: false, ...readable };
    } finally {
      setIsRestoring(false);
    }
  }, [applyCustomerInfo, providerAvailable, user?.email]);

  const openManageSubscriptions = useCallback(async () => {
    const managementURL =
      customerInfo?.managementURL ||
      serverStatus?.managementURL ||
      PREMIUM_APPLE_SUBSCRIPTIONS_URL;

    if (!providerAvailable) {
      window.open(managementURL, "_blank", "noopener,noreferrer");
      return { ok: true, mode: "external" };
    }

    try {
      await RevenueCatUI.presentCustomerCenter();
      return { ok: true, mode: "customer-center" };
    } catch {
      window.open(managementURL, "_blank", "noopener,noreferrer");
      return { ok: true, mode: "external" };
    }
  }, [customerInfo?.managementURL, providerAvailable, serverStatus?.managementURL]);

  const packageList = useMemo(
    () => sortPremiumPackages(offerings?.current?.availablePackages || []),
    [offerings]
  );

  const entitlementState = useMemo(() => {
    const clientSnapshot = customerInfo ? entitlementSnapshotFromCustomerInfo(customerInfo) : null;
    return clientSnapshot || serverStatus || cachedStateRef.current || {
      configured: providerAvailable,
      entitlementId: PREMIUM_ENTITLEMENT_ID,
      isPremium: false,
      source: providerAvailable ? "unknown" : "unavailable",
    };
  }, [customerInfo, providerAvailable, serverStatus]);

  const value = useMemo(() => ({
    planName: PREMIUM_PLAN_NAME,
    entitlementId: PREMIUM_ENTITLEMENT_ID,
    isAvailable: providerAvailable,
    isLoading,
    isPurchasing,
    isRestoring,
    isRefreshing,
    supportsPurchases,
    isPremium: Boolean(entitlementState?.isPremium),
    subscriptionStatus: entitlementState,
    offerings,
    packages: packageList.map((aPackage) => ({
      raw: aPackage,
      id: getPremiumProductIdentifier(aPackage) || aPackage?.identifier || getPremiumPackageLabel(aPackage),
      label: getPremiumPackageLabel(aPackage),
      caption: getPremiumPackageCaption(aPackage),
      price: getPremiumPriceLabel(aPackage),
    })),
    purchasePackage,
    restorePurchases,
    refreshSubscription,
    openManageSubscriptions,
    error: lastError,
  }), [
    entitlementState,
    isLoading,
    isPurchasing,
    isRefreshing,
    isRestoring,
    lastError,
    offerings,
    packageList,
    providerAvailable,
    purchasePackage,
    refreshSubscription,
    restorePurchases,
    supportsPurchases,
    openManageSubscriptions,
  ]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error("usePremium must be used within a PremiumProvider");
  }
  return context;
}
