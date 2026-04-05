import { base44 } from "@/api/base44Client";
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
      const res = await base44.functions.invoke("identifyPlant", { imageBase64: item.imageBase64 });
      if (res.data?.error || !res.data?.top_result) {
        await updateQueueItem(item.id, { status: "pending", attempts: (item.attempts || 0) + 1 });
        continue;
      }
      const top = res.data.top_result;
      await base44.functions.invoke("saveDiscovery", {
        ...top,
        category: res.data.category || "plant",
        photo_url: item.imageBase64,
        thumbnail_url: item.imageBase64,
        latitude: item.latitude,
        longitude: item.longitude,
      });
      await removeFromQueue(item.id);
    } catch {
      await updateQueueItem(item.id, { status: "pending", attempts: (item.attempts || 0) + 1 });
    }
  }
}