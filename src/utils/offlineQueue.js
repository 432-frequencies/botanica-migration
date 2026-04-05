const DB_NAME = 'w1ld_offline';
const STORE = 'pending_photos';
export const QUEUE_LIMIT_PRO = 50;
export const QUEUE_LIMIT_FREE = 5;

// Fallback en mémoire si IndexedDB est indisponible (navigation privée iOS, etc.)
let memoryQueue = [];
let useMemoryFallback = false;

function testIndexedDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('__test__', 1);
      req.onsuccess = () => { req.result.close(); resolve(true); };
      req.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 500);
    } catch {
      resolve(false);
    }
  });
}

async function ensureFallbackMode() {
  if (useMemoryFallback) return;
  const ok = await testIndexedDB();
  if (!ok) useMemoryFallback = true;
}

export async function openDB() {
  await ensureFallbackMode();
  if (useMemoryFallback) return null;
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => {
        useMemoryFallback = true;
        resolve(null);
      };
    } catch {
      useMemoryFallback = true;
      resolve(null);
    }
  });
}

export async function addToQueue(imageBase64, coords, isPro = false) {
  const db = await openDB();
  const existing = await getPendingQueue();
  const maxQueue = isPro ? QUEUE_LIMIT_PRO : QUEUE_LIMIT_FREE;
  if (existing.length >= maxQueue) {
    throw new Error('QUEUE_FULL');
  }

  const item = {
    id: crypto.randomUUID(),
    imageBase64,
    latitude: coords?.lat || null,
    longitude: coords?.lng || null,
    timestamp: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  };

  if (!db) {
    memoryQueue.push(item);
    return;
  }

  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).add(item);
  return new Promise((res) => {
    tx.oncomplete = res;
    tx.onerror = () => {
      memoryQueue.push(item);
      res();
    };
  });
}

export async function getPendingQueue() {
  const db = await openDB();
  if (!db) return [...memoryQueue];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([...memoryQueue]);
    } catch {
      resolve([...memoryQueue]);
    }
  });
}

export async function updateQueueItem(id, updates) {
  const db = await openDB();
  if (!db) {
    memoryQueue = memoryQueue.map(i => i.id === id ? { ...i, ...updates } : i);
    return;
  }
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const req = store.get(id);
  req.onsuccess = () => {
    if (req.result) store.put({ ...req.result, ...updates });
  };
  return new Promise((res) => {
    tx.oncomplete = res;
    tx.onerror = () => {
      memoryQueue = memoryQueue.map(i => i.id === id ? { ...i, ...updates } : i);
      res();
    };
  });
}

export async function removeFromQueue(id) {
  const db = await openDB();
  if (!db) {
    memoryQueue = memoryQueue.filter(i => i.id !== id);
    return;
  }
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  return new Promise((res) => {
    tx.oncomplete = res;
    tx.onerror = () => {
      memoryQueue = memoryQueue.filter(i => i.id !== id);
      res();
    };
  });
}

export async function getQueueCount() {
  const items = await getPendingQueue();
  return items.length;
}

// 'indexeddb' = stockage persistant, 'memory' = fallback volatile (Safari privé, etc.)
export function getStorageMode() {
  return useMemoryFallback ? 'memory' : 'indexeddb';
}