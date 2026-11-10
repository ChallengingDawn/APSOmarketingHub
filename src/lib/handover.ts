// FILES HANDED TO THE BROWSER - the parts of the studios' Download that run anywhere (Content v10, 10.11.2026). Pure: no
// "@/" imports, no DOM - the bar's Download (src/app/projects/studio/frame.tsx) and the tests read it.
//
// SARCLA 10.11.2026: "Download neither" - the top bar's Download did nothing for him. A file made after the hub has answered
// is started by the page itself, not by his click, and the browser treats such a download as an AUTOMATIC one: the first
// passes, the next ones of the same click ("Every store view", "Every size", a carousel's pages) make Chrome ask "download
// multiple files?" - and once that is refused, every later download the hub starts is dropped without a word. So:
//   - several files are ONE file, a .zip (stored, the existing writer of ./xlsxParts.ts) - never several downloads
//   - every file made is also offered as a link in the bar ("Save it"): a click on a real link is the person's own
//     download, which the browser lets through whatever it decided before

import { zip, type ZipEntry } from "./xlsxParts";

/** A file as a kind makes it: its name and its bytes (or text). */
export type MadeFile = { name: string; data: Uint8Array | string; type?: string };

/** A name safe for every system: letters, digits, dots, dashes; never empty. */
export function safeName(name: string): string {
  const n = String(name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.]+|-+$/g, "");
  return n.slice(0, 120) || "file";
}

/** The names, each once: a second "a.html" becomes "a-2.html" (inside one zip two files never share a name). */
export function uniqueNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const n = safeName(raw);
    const lower = n.toLowerCase();
    const k = (seen.get(lower) ?? 0) + 1;
    seen.set(lower, k);
    if (k === 1) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)}-${k}${n.slice(dot)}` : `${n}-${k}`;
  });
}

const bytesOf = (d: Uint8Array | string) => (typeof d === "string" ? new TextEncoder().encode(d) : d);

/** Several files as one .zip (stored as they are - pictures and HTML pack little, and every system opens it). */
export function zipOf(files: readonly MadeFile[]): Uint8Array {
  const names = uniqueNames(files.map((f) => f.name));
  const entries: ZipEntry[] = files.map((f, i) => { const data = bytesOf(f.data); return { name: names[i], data, comp: data, method: 0 }; });
  return zip(entries);
}

/** What goes to the browser for a set of files: the file itself when there is one, else one zip named `zipName`. */
export function handOverPlan(files: readonly MadeFile[], zipName: string): { name: string; type: string; files: number } | null {
  if (!files.length) return null;
  if (files.length === 1) return { name: safeName(files[0].name), type: files[0].type ?? "application/octet-stream", files: 1 };
  return { name: safeName(zipName.endsWith(".zip") ? zipName : `${zipName}.zip`), type: "application/zip", files: files.length };
}

/** The bar's line once a file is handed over: what was saved, where it is. */
export function savedLine(names: readonly string[], inside = 0): string {
  if (!names.length) return "Nothing was saved.";
  const one = names.length === 1 ? names[0] : `${names.length} files`;
  return `${one}${inside > 1 ? ` (${inside} files in one zip)` : ""} - in your downloads.`;
}

/** A size as people read it: "820 B", "14 KB", "2.3 MB". */
export function sizeLine(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
