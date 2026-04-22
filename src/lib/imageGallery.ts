// Cross-page image gallery: composer & proposal generators push their generated
// images here, and the Templates editor reads from here to populate its
// "Use generated photo" dropdown. Stored in localStorage so it survives navigation.

const KEY = "apsoMH:gallery:v1";
const MAX = 6; // data: URLs are heavy (Gemini ~500KB-1.5MB each)

export type GalleryImage = {
  url: string;
  brief: string;
  source: "composer" | "proposal" | "template";
  createdAt: number;
};

export function readGallery(): GalleryImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GalleryImage[]) : [];
  } catch {
    return [];
  }
}

export function pushToGallery(img: Omit<GalleryImage, "createdAt">): void {
  if (typeof window === "undefined" || !img.url) return;
  const cur = readGallery();
  const next: GalleryImage[] = [
    { ...img, createdAt: Date.now() },
    ...cur.filter((x) => x.url !== img.url),
  ].slice(0, MAX);
  trySave(next);
  window.dispatchEvent(new CustomEvent("apsoMH:gallery:update"));
}

export function clearGallery(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent("apsoMH:gallery:update"));
}

function trySave(list: GalleryImage[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // QuotaExceeded — keep only the newest 2 entries and retry once.
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 2)));
    } catch {
      // give up
    }
  }
}