// A BANNER OR A SLIDE AS A PNG, MADE IN THE BROWSER (08.11.2026) - no new library: the HTML is drawn by the browser
// itself through an SVG <foreignObject> onto a canvas.
//
// Two things make that work under the hub's rules: the pictures go in as data: (fetched through the hub's own picture
// route - a canvas that drew a picture from the shop directly would refuse to give its pixels back), and the brand font
// goes in as data: too (an SVG drawn as a picture loads nothing from outside). The markup is serialised as XHTML, which
// is what a foreignObject needs.

const pictures = new Map<string, Promise<string>>();

const asData = (b: Blob) => new Promise<string>((ok, bad) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => bad(r.error ?? new Error("The picture could not be read."));
  r.readAsDataURL(b);
});

/** A shop picture as a data: address, through the hub (kept for the session - the same photo is drawn many times). */
export function pictureData(url: string): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let p = pictures.get(url);
  if (!p) {
    p = fetch(`/api/content/studio/banner/picture?u=${encodeURIComponent(url)}`).then(async (r) => {
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `The picture did not come (${r.status}).`);
      }
      return asData(await r.blob());
    });
    pictures.set(url, p);
    p.catch(() => pictures.delete(url));
  }
  return p;
}

let fontCss: Promise<string> | null = null;
/** The brand's type (Jost, as data:) - "" when the hub could not load it; the PNG then falls back to Arial. */
export function brandFontCss(): Promise<string> {
  fontCss ??= fetch("/api/content/studio/banner/font").then((r) => (r.ok ? r.text() : "")).catch(() => "");
  return fontCss;
}

/** The brand font in the hub's own page too, once, so the studios' inline previews draw in it. */
export function useFontInPage(css: string) {
  if (!css || typeof document === "undefined" || document.getElementById("apso-brand-font")) return;
  const el = document.createElement("style");
  el.id = "apso-brand-font";
  el.textContent = css;
  document.head.appendChild(el);
}

export type PngJob = {
  /** The markup (styles come separately) and its stylesheet. */
  html: string;
  css: string;
  width: number;
  height: number;
  /** 1 = the real size, 2 = sharp on high-resolution screens. */
  scale?: number;
  fontCss?: string;
  background?: string;
  /** How a picture's address becomes data: (the hub's route by default; a test passes its own). */
  picture?: (url: string) => Promise<string>;
};

/** The markup laid out as it will be drawn: pictures inlined, scripts out, serialised as XHTML in an SVG. */
export async function svgOf(job: PngJob): Promise<{ svg: string; missing: string[] }> {
  const doc = document.implementation.createHTMLDocument("png");
  const root = doc.createElement("div");
  root.setAttribute("style", `width:${job.width}px;height:${job.height}px;overflow:hidden;position:relative;margin:0;background:${job.background ?? "transparent"}`);
  root.innerHTML = `<style>${job.fontCss ?? ""}\n${job.css}</style>${job.html}`;
  root.querySelectorAll("script").forEach((s) => s.remove());
  const missing: string[] = [];
  const get = job.picture ?? pictureData;
  await Promise.all(Array.from(root.querySelectorAll("img")).map(async (img) => {
    const src = img.getAttribute("src") ?? "";
    img.removeAttribute("loading");
    img.removeAttribute("srcset");
    if (!src || src.startsWith("data:")) return;
    try { img.setAttribute("src", await get(src)); } catch { missing.push(src); img.remove(); }
  }));
  const xhtml = new XMLSerializer().serializeToString(root);
  const s = job.scale ?? 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${job.width * s}" height="${job.height * s}" viewBox="0 0 ${job.width} ${job.height}"><foreignObject x="0" y="0" width="${job.width}" height="${job.height}">${xhtml}</foreignObject></svg>`;
  return { svg, missing };
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, bad) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => bad(new Error("The browser could not draw this - try again."));
  img.src = src;
});

/** The PNG itself. `missing` lists pictures that could not be fetched (drawn without them). */
export async function htmlToPng(job: PngJob): Promise<{ blob: Blob; missing: string[] }> {
  const { svg, missing } = await svgOf(job);
  const s = job.scale ?? 1;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = await loadImage(url);
  // the font inside the SVG picture settles a moment after it loads: draw from a second load of the same picture
  await new Promise((r) => setTimeout(r, 120));
  const again = await loadImage(url).catch(() => img);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(job.width * s);
  canvas.height = Math.round(job.height * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot make PNGs.");
  if (job.background) { ctx.fillStyle = job.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(again, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("The PNG could not be made.");
  return { blob, missing };
}

/** The browser's own download of a file made here. */
export function download(data: Blob | string, name: string, type = "text/html;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

/** A file name from a title: plain letters, dashes. */
export const fileName = (title: string, suffix: string) =>
  `${(title || "apsoparts").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "apsoparts"}${suffix}`;
