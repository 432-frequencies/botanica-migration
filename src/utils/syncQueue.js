import { identifyPlant } from "@/api/identifyPlant";
import { saveDiscovery } from "@/api/saveDiscovery";
import { getPendingQueue, updateQueueItem, removeFromQueue } from "./offlineQueue";

let activeSyncPromise = null;
const MAX_SYNC_ATTEMPTS = 3;

async function markQueueFailure(item, message) {
  const nextAttempts = (item.attempts || 0) + 1;
  await updateQueueItem(item.id, {
    status: nextAttempts >= MAX_SYNC_ATTEMPTS ? "error" : "pending",
    attempts: nextAttempts,
    last_error: message || "Erreur inconnue",
    last_attempt_at: new Date().toISOString(),
  });
}

/**
 * Traite la file hors ligne silencieusement (sans état UI).
 * Peut être appelé depuis n'importe quel composant/montage.
 */
export async function syncOfflineQueue() {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    if (!navigator.onLine) return;
    const queue = (await getPendingQueue()).filter((item) =>
      item.status === "pending" || (item.status === "error" && (item.attempts || 0) < MAX_SYNC_ATTEMPTS)
    );
    if (!queue.length) return;

    for (const item of queue) {
      try {
        await updateQueueItem(item.id, {
          status: "processing",
          last_attempt_at: new Date().toISOString(),
        });
        const res = await identifyPlant({ imageBase64: item.imageBase64 });
        if (res?.error || !res?.top_result) {
          await markQueueFailure(item, res?.error || "Identification impossible");
          continue;
        }
        const saveRes = await saveDiscovery({
          ...res.top_result,
          category: res.category || "plant",
          photo_url: item.imageBase64,
          latitude: item.latitude,
          longitude: item.longitude,
        });
        if (saveRes?.error) {
          await markQueueFailure(item, saveRes.error);
          continue;
        }
        await removeFromQueue(item.id);
      } catch (error) {
        await markQueueFailure(item, error?.message || "Erreur de synchronisation");
      }
    }
  })();

  try {
    await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}
