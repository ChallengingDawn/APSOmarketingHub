"use client";
// PICTURES IN EVERY STUDIO (SARCLA 08.11.2026: "on pictures frame you should be able to upload a photo or generate one",
// "a gallery of the photos that I've generated", "it doesn't create the photo and it opens another window - just put it
// on the canvas"). One panel, embedded where the picture goes (or in a dialog where a studio has no side room):
//   Make one     a few words -> a picture in the house style, kept in the hub, picked at once
//   Upload       a photo from the computer: shrunk here, sent in small parts (the 8 KB body limit), kept
//   Mine / This project / Logos   the galleries, newest first; a click picks
//   Products     the shop's own product photos (Content v7, SARCLA 10.11.2026 point 11: "on pictures we should have all of
//                our products as well"): found by name, product or article number, or browsed by the shop's categories -
//                the photo's address kept, the product's name its alt text. Every panel that offers photos offers it.
// Server: /api/content/assets (lib/content/assets.ts), /api/content/products (lib/content/productPictures.ts). A picked
// picture is its address, never its bytes.

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { field, mainBtn } from "./parts";
import { ProductPictures } from "./productPictures";
import { whileWorking } from "./working";
import { readAnswer } from "@/lib/http/answer";

export type Picture = {
  id: number; kind: "generated" | "upload" | "logo" | "product"; url: string; width: number | null; height: number | null;
  name: string | null; prompt: string | null; projectId: number | null; by: string | null; at: string;
  /** what it shows, for the alt text (a product: its name as the shop writes it) */
  alt?: string | null;
  /** a product of the shop: its number and its page */
  product?: { number: string; url: string } | null;
};
export type PictureAspect = "1:1" | "4:5" | "16:9" | "3:2";
type Where = { projectId?: number | null; pieceId?: number | null };

async function post<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  // in plain words, never "The hub answered 200." (Content v7 - a picture is kept alive, its status is always 200)
  return readAnswer(fetch("/api/content/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })) as Promise<T & { ok: boolean; error?: string }>;
}

/** A picture from a few words, in the house style. Takes 10-40 s. */
export async function makePicture(prompt: string, aspect: PictureAspect, where: Where = {}): Promise<{ ok: true; picture: Picture } | { ok: false; error: string }> {
  // the studio's frame shows it being made, from the click (working.ts)
  const r = await whileWorking({ label: "Making the picture…", kind: "picture" }, () => post<{ asset?: Picture }>({ action: "generate", prompt, aspect, ...where }));
  return r.ok && r.asset ? { ok: true, picture: r.asset } : { ok: false, error: r.error ?? "No picture came back." };
}

/**
 * A picture fine-tuned (Content v5, SARCLA 09.11.2026: "Ask AI under a photo should give you the option to fine-tune the
 * photo"): the SAME picture with one change - the image model is given the picture as it is. The old one stays in the
 * gallery. Only a picture kept in the hub (its /api/content/picture/ address). Takes 10-40 s.
 */
export async function refinePicture(url: string, ask: string, aspect: PictureAspect, where: Where = {}): Promise<{ ok: true; picture: Picture } | { ok: false; error: string }> {
  const r = await whileWorking({ label: "Fine-tuning the picture…", kind: "picture" }, () => post<{ asset?: Picture }>({ action: "refine", url, ask, aspect, ...where }));
  return r.ok && r.asset ? { ok: true, picture: r.asset } : { ok: false, error: r.error ?? "No picture came back." };
}

/** The quick fine-tunes every studio offers for a picture (the free ask covers the rest). */
export const PICTURE_TUNES: { label: string; ask: string }[] = [
  { label: "Plain white background", ask: "Put the part on a plain, even white background - nothing else around it, a soft shadow under it." },
  { label: "Closer on the part", ask: "Come closer: the part fills most of the frame, the same angle, the background less visible." },
  { label: "Brighter and sharper", ask: "Brighter, cleaner light and crisper detail on the part; the same colours and contents." },
  { label: "In a real machine", ask: "Show the same part fitted in a real industrial machine where it is used, in a clean, well-lit setting." },
];

/** The file, made at most 2400 px wide here (PNG kept when it has transparency), as base64. */
async function shrink(file: File): Promise<string> {
  const raw = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file); });
  if (file.type === "image/svg+xml" || file.type === "image/gif") return raw.slice(raw.indexOf(",") + 1);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file is not a picture.")); i.src = raw; });
  const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const png = file.type === "image/png";
  const out = c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
  // a PNG photo with no transparency travels as JPEG - a tenth of the parts
  const smaller = png && out.length > 3_000_000 ? c.toDataURL("image/jpeg", 0.9) : out;
  return smaller.slice(smaller.indexOf(",") + 1);
}

/** A photo from the computer, into the hub - in parts of 6000 characters, four at a time. */
export async function uploadPicture(file: File, where: Where & { kind?: "upload" | "logo" } = {}, onProgress?: (share: number) => void): Promise<{ ok: true; picture: Picture } | { ok: false; error: string }> {
  try {
    if (file.size > 25 * 1024 * 1024) return { ok: false, error: "That file is over 25 MB." };
    const b64 = await shrink(file);
    const parts: string[] = [];
    for (let i = 0; i < b64.length; i += 6000) parts.push(b64.slice(i, i + 6000));
    if (parts.length > 1500) return { ok: false, error: "That picture is too big - at most 8 MB." };
    const start = await post<{ token?: string }>({ action: "upload-start" });
    if (!start.ok || !start.token) return { ok: false, error: start.error ?? "The upload did not start." };
    let next = 0; let done = 0; let failed: string | null = null;
    const worker = async () => {
      while (!failed && next < parts.length) {
        const n = next++;
        let r = await post({ action: "upload-part", token: start.token, n, data: parts[n] });
        if (!r.ok) r = await post({ action: "upload-part", token: start.token, n, data: parts[n] });
        if (!r.ok) { failed = r.error ?? "A part did not arrive."; return; }
        done += 1; onProgress?.(done / parts.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (failed) return { ok: false, error: failed };
    const fin = await post<{ asset?: Picture }>({ action: "upload-finish", token: start.token, parts: parts.length, kind: where.kind ?? "upload", name: file.name, projectId: where.projectId, pieceId: where.pieceId });
    return fin.ok && fin.asset ? { ok: true, picture: fin.asset } : { ok: false, error: fin.error ?? "The picture was not kept." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type GalleryScope = "mine" | "project" | "logos" | "all";
export function usePictures(scope: GalleryScope, projectId?: number | null) {
  const [pictures, setPictures] = useState<Picture[] | null>(null);
  const [images, setImages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (scope === "project" && !projectId) { setPictures([]); return; }
    const q = new URLSearchParams({ scope, ...(projectId ? { project: String(projectId) } : {}) });
    const j = await fetch(`/api/content/assets?${q}`).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    if (!j.ok) { setError(j.error ?? "Not read."); setPictures([]); return; }
    setImages(j.images !== false); setPictures(j.assets); setError(null);
  }, [scope, projectId]);
  useEffect(() => { void load(); }, [load]);
  return { pictures, images, error, reload: load, add: (p: Picture) => setPictures((all) => [p, ...(all ?? []).filter((x) => x.id !== p.id)]), drop: (id: number) => setPictures((all) => (all ?? []).filter((x) => x.id !== id)) };
}

/** A grid of pictures; a click picks one. */
export function PictureGrid({ pictures, onPick, onRemove, me, columns = 3, empty }: {
  pictures: Picture[] | null; onPick: (p: Picture) => void; onRemove?: (p: Picture) => void; me?: string; columns?: number; empty?: string;
}) {
  if (!pictures) return <Box sx={{ py: 3, display: "grid", placeItems: "center" }}><CircularProgress size={18} /></Box>;
  if (!pictures.length) return <Typography sx={{ fontSize: "0.82rem", color: MUTED, py: 2 }}>{empty ?? "No pictures yet."}</Typography>;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 0.75 }}>
      {pictures.map((p) => (
        <Box key={p.id} sx={{ position: "relative", "&:hover .rm": { opacity: 1 } }}>
          <Tooltip title={p.prompt ?? p.name ?? ""} placement="top" enterDelay={500}>
            <Box component="button" type="button" onClick={() => onPick(p)} draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/uri-list", p.url); e.dataTransfer.setData("application/x-hub-picture", JSON.stringify(p)); }}
              sx={{
                all: "unset", cursor: "pointer", display: "block", width: "100%", aspectRatio: "1", borderRadius: "6px", overflow: "hidden",
                bgcolor: p.kind === "logo" ? "#fff" : "#eef1f6", border: `1px solid ${HAIRLINE}`, boxSizing: "border-box",
                backgroundImage: p.kind === "logo" ? "linear-gradient(45deg,#f3f5f8 25%,transparent 25%,transparent 75%,#f3f5f8 75%),linear-gradient(45deg,#f3f5f8 25%,transparent 25%,transparent 75%,#f3f5f8 75%)" : "none",
                backgroundSize: "12px 12px", backgroundPosition: "0 0, 6px 6px",
                "&:hover": { boxShadow: "0 0 0 2px #2459d1" }, "&:focus-visible": { outline: "2px solid #2459d1" },
              }}>
              <Box component="img" src={p.url} alt={p.prompt ?? p.name ?? "picture"} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: p.kind === "logo" ? "contain" : "cover", p: p.kind === "logo" ? 1 : 0, boxSizing: "border-box", display: "block" }} />
            </Box>
          </Tooltip>
          {onRemove && me && p.by === me && (
            <IconButton className="rm" size="small" aria-label="Remove the picture" onClick={() => onRemove(p)}
              sx={{ position: "absolute", top: 3, right: 3, opacity: 0, bgcolor: "rgba(255,255,255,.92)", "&:hover": { bgcolor: "#fff" }, p: 0.4 }}>
              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );
}

type Tab = "make" | "upload" | "mine" | "project" | "logos" | "all" | "products";

/** The panel: make one, upload one, or pick from the galleries. */
export function PicturePanel({ onPick, projectId, pieceId, aspect: initialAspect = "1:1", me, tabs: asked = ["make", "upload", "mine", "project"], start = "make", suggestion, columns = 3, store }: {
  onPick: (p: Picture) => void; projectId?: number | null; pieceId?: number | null; aspect?: PictureAspect; me?: string;
  tabs?: Tab[]; start?: Tab; suggestion?: string; columns?: number;
  /** the store view whose product names the Products source shows ("de-CH"; the studio's language) */
  store?: string;
}) {
  // the shop's products beside every choice of photos (a panel of logos, or of one thing only, keeps to it)
  const tabs: Tab[] = asked.includes("products") || asked.length < 2 || asked.includes("logos") ? asked : [...asked, "products"];
  const [tab, setTab] = useState<Tab>(tabs.includes(start) ? start : tabs[0]);
  const [prompt, setPrompt] = useState(suggestion ?? "");
  const [aspect, setAspect] = useState<PictureAspect>(initialAspect);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<Picture[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const gallery = usePictures(tab === "logos" ? "logos" : tab === "project" ? "project" : tab === "all" ? "all" : "mine", projectId);
  const where = { projectId: projectId ?? null, pieceId: pieceId ?? null };

  const make = async () => {
    setBusy(true); setErr(null);
    const r = await makePicture(prompt, aspect, where);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMade((m) => [r.picture, ...m]);
    gallery.add(r.picture);
    onPick(r.picture);
  };
  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setErr(null);
    for (const f of list) {
      setProgress(0);
      const r = await uploadPicture(f, { ...where, kind: tab === "logos" ? "logo" : "upload" }, setProgress);
      setProgress(null);
      if (!r.ok) { setErr(r.error); return; }
      gallery.add(r.picture);
      if (list.length === 1) onPick(r.picture);
    }
  };
  const remove = async (p: Picture) => {
    const r = await post({ action: "remove", id: p.id });
    if (r.ok) gallery.drop(p.id); else setErr(r.error ?? "Not removed.");
  };
  const LABEL: Record<Tab, string> = { make: "Make one", upload: "Upload", mine: "Mine", project: "This project", logos: "Logos", all: "Everyone's", products: "Products" };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, minWidth: 0 }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void upload(e.dataTransfer.files); } }}>
      <SquareChoice value={tab} onChange={setTab} options={tabs.map((t) => ({ key: t, label: LABEL[t] }))} />
      {tab === "make" && (
        <>
          <TextField multiline minRows={3} maxRows={8} size="small" fullWidth value={prompt} onChange={(e) => setPrompt(e.target.value)} sx={field}
            placeholder="What it shows - e.g. a technician's hands fitting a red silicone seal on a stainless food line, morning light"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim() && !busy) void make(); }} />
          <SquareChoice label="Shape" value={aspect} onChange={setAspect} options={[{ key: "1:1", label: "Square" }, { key: "4:5", label: "Portrait" }, { key: "16:9", label: "Wide" }, { key: "3:2", label: "Photo" }]} />
          <Button variant="contained" disableElevation disabled={!prompt.trim() || busy} onClick={() => void make()} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlinedIcon />} sx={mainBtn}>
            {busy ? "Making the picture… (up to 40 s)" : "Make the picture"}
          </Button>
          {!gallery.images && <Typography sx={{ fontSize: "0.78rem", color: "#b26a00" }}>Pictures cannot be made on this hub - its image key is not set. Upload one instead.</Typography>}
          {made.length > 0 && (
            <>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>Made just now</Typography>
              <PictureGrid pictures={made} onPick={onPick} columns={columns} />
            </>
          )}
        </>
      )}
      {(tab === "upload" || tab === "logos") && (
        <>
          <input ref={fileRef} type="file" accept={tab === "logos" ? "image/png,image/svg+xml,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,image/gif"} multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          <Box component="button" type="button" onClick={() => fileRef.current?.click()} sx={{
            all: "unset", cursor: "pointer", border: `1.5px dashed ${HAIRLINE}`, borderRadius: "8px", py: tab === "logos" ? 1.5 : 3, px: 2, textAlign: "center", color: MUTED,
            "&:hover": { borderColor: "#2459d1", color: "#2459d1", bgcolor: "rgba(36,89,209,.04)" },
          }}>
            <FileUploadOutlinedIcon sx={{ display: "block", mx: "auto", mb: 0.5 }} />
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "inherit" }}>{tab === "logos" ? "Add a logo (SVG or PNG)" : "Drop photos here, or click to choose"}</Typography>
            {tab === "upload" && <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>PNG, JPEG, WebP - shrunk to 2400 px here, kept in the hub</Typography>}
          </Box>
          {progress !== null && <LinearProgress variant="determinate" value={progress * 100} sx={{ borderRadius: 2 }} />}
          {tab === "logos" && <PictureGrid pictures={gallery.pictures} onPick={onPick} onRemove={remove} me={me} columns={columns} empty="No logo added yet." />}
        </>
      )}
      {tab === "products" && <ProductPictures onPick={onPick} columns={columns} store={store} />}
      {(tab === "mine" || tab === "project" || tab === "all") && (
        <PictureGrid pictures={gallery.pictures} onPick={onPick} onRemove={remove} me={me} columns={columns}
          empty={tab === "mine" ? "The pictures you make or upload come here." : tab === "all" ? "No picture in the hub yet." : "No picture in this project yet."} />
      )}
      {err && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f" }}>{err}</Typography>}
    </Box>
  );
}

/** The same panel in a dialog, for a studio with no side room. Picking closes it. */
export function PictureDialog({ open, onClose, onPick, title = "A picture", ...rest }: {
  open: boolean; onClose: () => void; onPick: (p: Picture) => void; title?: string;
} & Omit<Parameters<typeof PicturePanel>[0], "onPick">) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: "14px" } } }}>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", color: INK }}>
        <Box sx={{ flex: 1 }}>{title}</Box>
        <IconButton aria-label="Close" onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: "4px !important", pb: 3 }}>
        <PicturePanel {...rest} columns={4} onPick={(p) => { onPick(p); onClose(); }} />
      </DialogContent>
    </Dialog>
  );
}

