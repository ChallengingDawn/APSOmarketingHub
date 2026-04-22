// IndexedDB-backed image archive for the /photos Image Studio.
// localStorage caps at ~5–10MB per origin which fits ~3–5 Gemini PNG data URLs;
// IndexedDB comfortably holds tens of MB so we can keep a real archive of 20.
// The smaller localStorage `imageGallery` is kept for cross-page hot quick-access
// (Composer + Templates editor) — /photos pushes to BOTH so dropdowns stay fresh.

const DB_NAME = "apsoMH";
const DB_VERSION = 1;
const STORE = "photos";
const CAP = 20;
const UPDATE_EVENT = "apsoMH:photoArchive:update";

export type ArchivedPhoto = {
  id: string;
  url: string;
  brief: string;
  audience?: string;
  category?: string;
  aspect?: string;
  source: "studio" | "composer" | "proposal" | "template";
  feedback?: "like" | "dislike";
  parentId?: string; // set when this image is a retouch of another
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result: T;
        fn(store).then((r) => {
          result = r;
        });
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function emitUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

export async function listArchive(): Promise<ArchivedPhoto[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    return await tx<ArchivedPhoto[]>("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const req = store.index("createdAt").openCursor(null, "prev");
        const out: ArchivedPhoto[] = [];
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            out.push(cursor.value as ArchivedPhoto);
            cursor.continue();
          } else {
            resolve(out);
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  } catch {
    return [];
  }
}

export async function archivePhoto(p: Omit<ArchivedPhoto, "id" | "createdAt">): Promise<ArchivedPhoto> {
  const entry: ArchivedPhoto = {
    ...p,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await tx<void>("readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.add(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  // Trim oldest beyond CAP.
  const all = await listArchive();
  if (all.length > CAP) {
    const toDrop = all.slice(CAP).map((x) => x.id);
    await tx<void>("readwrite", async (store) => {
      return new Promise<void>((resolve, reject) => {
        let remaining = toDrop.length;
        if (remaining === 0) {
          resolve();
          return;
        }
        for (const id of toDrop) {
          const r = store.delete(id);
          r.onsuccess = () => {
            if (--remaining === 0) resolve();
          };
          r.onerror = () => reject(r.error);
        }
      });
    });
  }
  emitUpdate();
  return entry;
}

export async function updateArchive(id: string, patch: Partial<ArchivedPhoto>): Promise<void> {
  await tx<void>("readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const get = store.get(id);
      get.onsuccess = () => {
        const cur = get.result as ArchivedPhoto | undefined;
        if (!cur) {
          resolve();
          return;
        }
        const merged: ArchivedPhoto = { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt };
        const put = store.put(merged);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
  });
  emitUpdate();
}

export async function deleteArchive(id: string): Promise<void> {
  await tx<void>("readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });
  emitUpdate();
}

export async function clearArchive(): Promise<void> {
  await tx<void>("readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });
  emitUpdate();
}

export const PHOTO_ARCHIVE_EVENT = UPDATE_EVENT;
export const PHOTO_ARCHIVE_CAP = CAP;