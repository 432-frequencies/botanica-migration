import { identifyPlant } from "@/api/identifyPlant";
import { saveDiscovery } from "@/api/saveDiscovery";
import { getPendingQueue, updateQueueItem, removeFromQueue } from "./offlineQueue";

/**
 * Traite la file hors ligne silencieusement (sans état UI).
 * Peut être appelé depuis n'importe quel composant/montage.
 */
export async function syncOfflineQueue() {
  if (!navigator.onLine) return;
  const queue = (await getPendingQueue()).filter(i => i.status === "pending" || (i.status === "error" && (i.attempts || 0) < 3));
  if (!queue.length) return;

  for (const item of queue) {
    try {
      await updateQueueItem(item.id, { status: "processing", attempts: (item.attempts || 0) + 1 });
      const res = await identifyPlant({ imageBase64: item.imageBase64 });
      if (res?.error || !res?.top_result) {
        await updateQueueItem(item.id, { status: "pending", attempts: (item.attempts || 0) + 1 });
        continue;
      }
      await saveDiscovery({
        ...res.top_result,
        category: res.category || "plant",
        photo_url: item.imageBase64,
        latitude: item.latitude,
        longitude: item.longitude,
      });
      await removeFromQueue(item.id);
    } catch {
      await updateQueueItem(item.id, { status: "pending", attempts: (item.attempts || 0) + 1 });
    }
  }
}