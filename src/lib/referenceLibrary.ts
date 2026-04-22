// Permanent reference-photo library for the Image Studio. Survives page reload
// and tab close. Uploaded references are saved here so the user can reuse them
// across sessions instead of re-uploading every time.

import { idbTx, STORE_REFERENCES } from "./idb";

const CAP = 30;
const UPDATE_EVENT = "apsoMH:referenceLibrary:update";

export type LibraryReference = {
  id: string;
  dataUrl: string;
  label: string;
  note: string;
  createdAt: number;
};

function emitUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
}

export async function listReferences(): Promise<LibraryReference[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    return await idbTx<LibraryReference[]>(STORE_REFERENCES, "readonly", (store) => {
      return new Promise((resolve, reject) => {
        const req = store.index("createdAt").openCursor(null, "prev");
        const out: LibraryReference[] = [];
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            out.push(cursor.value as LibraryReference);
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

export async function addReference(
  ref: Omit<LibraryReference, "id" | "createdAt">
): Promise<LibraryReference> {
  const entry: LibraryReference = {
    ...ref,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await idbTx<void>(STORE_REFERENCES, "readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const req = store.add(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  // Trim oldest beyond CAP.
  const all = await listReferences();
  if (all.length > CAP) {
    const toDrop = all.slice(CAP).map((x) => x.id);
    await idbTx<void>(STORE_REFERENCES, "readwrite", async (store) => {
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

export async function updateReference(
  id: string,
  patch: Partial<LibraryReference>
): Promise<void> {
  await idbTx<void>(STORE_REFERENCES, "readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const get = store.get(id);
      get.onsuccess = () => {
        const cur = get.result as LibraryReference | undefined;
        if (!cur) {
          resolve();
          return;
        }
        const merged = { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt };
        const put = store.put(merged);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
  });
  emitUpdate();
}

export async function deleteReference(id: string): Promise<void> {
  await idbTx<void>(STORE_REFERENCES, "readwrite", async (store) => {
    return new Promise<void>((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });
  emitUpdate();
}

export const REFERENCE_LIBRARY_EVENT = UPDATE_EVENT;
export const REFERENCE_LIBRARY_CAP = CAP;