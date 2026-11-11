"use client";
// THE CARD OF ONE ELEMENT OF THE E-MAIL (cv16, 11.11.2026) - the Page builder's element popups (../page/pops.tsx, Content
// v14: "review in depth the element options and popups ... link, product, photos, element text") for the newsletter. A
// click on words, a button or a picture in the e-mail picks it; its card opens under it, in the Page builder's order:
//   WORDS          edited in the e-mail itself, as they read (the newsletter's way since Content v3) - said here
//   ITS LINK       where it leads, "A page from the Page builder" (its address in the language's store view), and
//                  "In every language": the same element's link in each language's e-mail
//   ITS PICTURE    a picture: what it should show (its own words - "Make it" / "Make another" use them as they are NOW;
//                  while it is made the card says "From: ..." and new words give "Make it from these words instead" -
//                  the newest ask wins, ../page/pictureJobs.ts), Upload, Gallery, the words for an inbox without pictures
//   ASK AI         its own box (the bar's "Ask AI" puts the cursor there - data-ai-box): applied at once, with its Undo
//   THE LOGO       our logo, back to it, or another one from the hub's Logos (or uploaded) - cv17: here, no more on the left
//   foot           Take it out; a product: Duplicate, Move left / right
// No Look section: an e-mail's look is our template's. cv17 (11.11.2026, "continue"): the card is the one place an element is
// edited - the picked block's row on the left points here (./Blocks.tsx BlockTools); an upload shows how far it is.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsOutlinedIcon from "@mui/icons-material/CollectionsOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { isNewest, madeFrom, makeButton, startJob, type SlotJobs } from "@/lib/content/studio/kinds/page/pictureJobs";
import { isOurLogo, pictureIdea, partText, type NewsletterDoc } from "@/lib/content/studio/kinds/newsletter/model";
import { elementOf, itemOrder, linkInLanguages, orderItem, takeOut, withLink } from "@/lib/content/studio/kinds/newsletter/elements";
import { linkNote } from "@/lib/content/studio/kinds/newsletter/pageLinks";
import { PicturePanel, makePicture, uploadPicture } from "../../pictures";
import { PINK, btn, field } from "../../parts";
import { PagePick, StateLine, type PageLinks } from "./PagePick";

type Rect = { left: number; top: number; width: number; height: number };
type Where = { projectId: number; pieceId: number; me: string };

const Sub = ({ children, mt = 1.25 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.66rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mt, mb: 0.5 }}>{children}</Typography>
);
const ASKS = [
  { label: "Shorter", ask: "Make it shorter, same meaning." },
  { label: "Clearer", ask: "Simpler words, shorter sentences, the same facts." },
  { label: "More personal", ask: "Speak to the reader directly (the language's polite form for business), the same facts." },
];
const quiet = { ...btn, color: INK, px: 1, borderRadius: "7px", fontSize: "0.78rem", height: 28 } as const;

export function ElementPop({ d, k, rect, device, canEdit, aiOn, pages, whole, langs, where, onMaking, setV, onAsk, onClose, onKey }: {
  /** the open language's e-mail */
  d: NewsletterDoc;
  /** the element's key ("<block id>:<field>") */
  k: string;
  rect: (selector: string) => Rect | null;
  device: "desktop" | "mobile";
  canEdit: boolean; aiOn: boolean; pages: PageLinks;
  /** the whole newsletter (every language), for "In every language" */
  whole: unknown; langs: string[];
  where: Where; onMaking: (key: string | null) => void;
  setV: (next: NewsletterDoc | ((cur: NewsletterDoc) => NewsletterDoc)) => void;
  onAsk: (request: string) => Promise<{ error?: string; undo?: () => void; note?: string }>;
  onClose: () => void;
  /** a product moved or duplicated: the key it has now */
  onKey?: (key: string) => void;
}) {
  const el = elementOf(d, k);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ tone: "ok" | "warn"; text: string; undo?: (() => void) | null } | null>(null);
  // a picture: its words, the asks running (the newest wins), the gallery
  const [idea, setIdea] = useState("");
  const [making, setMaking] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** an upload under way: how far (0-1) */
  const [up, setUp] = useState<number | null>(null);
  const jobs = useRef<SlotJobs>({});
  const file = useRef<HTMLInputElement | null>(null);
  const b = el?.block;
  const item = el?.item ?? null;
  useEffect(() => { setSaid(null); setQ(""); setGallery(false); setErr(null); setUp(null); setIdea(b ? (b.kind === "products" && item !== null ? [b.items[item]?.name, b.items[item]?.text].filter(Boolean).join(" - ") : pictureIdea(b)) : ""); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!el || !b) return null;

  // its place: under the element, inside the e-mail's column (on a phone the column is the phone)
  const sel = el.kind === "picture" || el.kind === "logo" ? `[data-pic="${CSS.escape(k)}"]` : `[data-ed="${CSS.escape(k)}"]`;
  const er = rect(sel) ?? rect(`[data-block="${CSS.escape(b.id)}"]`);
  const br = rect(`[data-block="${CSS.escape(b.id)}"]`) ?? er;
  if (!er || !br) return null;
  const w = Math.min(device === "mobile" ? 340 : 380, Math.max(280, br.width - 24));
  const left = Math.max(br.left + 8, Math.min(er.left, br.left + br.width - w - 8));
  // under the dark label the e-mail puts at the element (its B, Link, Ask AI stay in view)
  // a picture: over its top, under that label (a picture is tall - under it the card would be out of view)
  const top = el.kind === "picture" || el.kind === "logo" ? er.top + 44 : er.top + er.height + 40;

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true); setSaid(null);
    const r = await onAsk(text.trim());
    setBusy(false);
    setQ("");
    if (r.error) setSaid({ tone: "warn", text: r.error });
    else setSaid({ tone: "ok", text: r.note ?? "Written - it is in the e-mail.", undo: r.undo ?? null });
  };
  const out = canEdit ? takeOut(d, k) : null;
  const order = canEdit ? itemOrder(d, k) : null;
  const move = (how: "dup" | -1 | 1) => { const r = orderItem(d, k, how); if (r) { setV(r.doc); onKey?.(r.key); } };
  const words = el.kind === "words" || el.kind === "button" ? partText(d, k) ?? "" : "";

  /* ── a picture made from its own words; the newest ask wins ── */
  const picKey = k;
  const hasPic = "imageUrl" in b ? !!b.imageUrl : b.kind === "products" && item !== null ? !!b.items[item]?.imageUrl : false;
  const putPicture = (url: string, alt: string, prompt: string | null) => setV((cur) => ({
    ...cur, blocks: cur.blocks.map((x) => {
      if (x.id !== b.id) return x;
      if (x.kind === "products" && item !== null) return { ...x, items: x.items.map((y, i) => (i === item ? { ...y, imageUrl: url } : y)) };
      if ("imageUrl" in x) return { ...x, imageUrl: url, imageAlt: x.imageAlt || alt, ...(prompt !== null && "imagePrompt" in x ? { imagePrompt: prompt } : {}) } as typeof x;
      return x;
    }),
  }));
  /** the header's logo: ours (""), or another one */
  const putLogo = (url: string) => setV((cur) => ({ ...cur, blocks: cur.blocks.map((x) => (x.id === b.id && x.kind === "header" ? { ...x, logoUrl: url } : x)) }));
  const aspect = b.kind === "article" && (b.layout === "left" || b.layout === "right") ? "1:1" as const : b.kind === "products" ? "1:1" as const : "16:9" as const;
  const make = async () => {
    const words = idea.trim();
    if (!words) return;
    const n = startJob(jobs.current, picKey);
    setErr(null); setMaking(words); onMaking(picKey);
    const r = await makePicture(words, aspect, { projectId: where.projectId, pieceId: where.pieceId });
    // an older ask's picture never goes in (it is in the project's pictures, the gallery)
    if (!isNewest(jobs.current, picKey, n)) return;
    setMaking(null); onMaking(null);
    if (!r.ok) { setErr(r.error); return; }
    putPicture(r.picture.url, r.picture.alt ?? words.slice(0, 120), words);
  };
  const mb = makeButton({ hasPicture: hasPic, making: making !== null, makingFrom: making, draft: idea, canMake: canEdit && aiOn });

  return (
    <Box key={k} role="dialog" aria-label={el.label} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      sx={{ position: "absolute", left, top, width: w, pointerEvents: "auto", zIndex: 5, bgcolor: "#fff", borderRadius: "12px", border: "1px solid rgba(21,34,58,.10)", boxShadow: "0 18px 48px rgba(21,34,58,.20), 0 2px 8px rgba(21,34,58,.08)", color: INK, overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, pl: 1.75, pr: 0.75, pt: 1, pb: 0.8, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.64rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>{el.label}</Typography>
          <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {el.kind === "picture" ? (hasPic ? "This picture" : "A picture to add") : el.kind === "logo" ? (b.kind === "header" && !isOurLogo(b.logoUrl) ? "Another logo" : "Our logo") : words.trim() || "No words yet"}
          </Typography>
        </Box>
        <Tooltip title="Close (Esc)"><IconButton size="small" onClick={onClose} aria-label="Close" sx={{ color: MUTED }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      </Box>
      <Box sx={{ px: 1.75, py: 1.25, maxHeight: "min(56vh, 520px)", overflowY: "auto" }}>
        {(el.kind === "words" || el.kind === "button") && (
          <>
            <Sub mt={0}>Words</Sub>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>Edited in the e-mail, as they read - click them there{el.kind === "words" && /:(text|footer)$/.test(k) ? "; B in the bar over them makes words bold" : ""}.</Typography>
          </>
        )}
        {el.kind === "logo" && b.kind === "header" && (
          <>
            <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.4 }}>{isOurLogo(b.logoUrl) ? "Our logo, as the e-mails we send from HubSpot carry it." : "Another logo, from the hub's Logos."}</Typography>
            {canEdit && (
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.75 }}>
                {!isOurLogo(b.logoUrl) && <Button size="small" onClick={() => putLogo("")} sx={{ ...quiet, border: `1px solid ${HAIRLINE}` }}>Back to our logo</Button>}
                <Button size="small" onClick={() => setGallery((v) => !v)} startIcon={<CollectionsOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...quiet, border: `1px solid ${gallery ? "#2459d1" : HAIRLINE}` }}>{gallery ? "Keep this one" : "Another logo…"}</Button>
              </Box>
            )}
            <Collapse in={gallery && canEdit} timeout={200} unmountOnExit>
              <Box sx={{ mt: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1, bgcolor: "#fbfcfd" }}>
                <PicturePanel tabs={["logos", "upload"]} start="logos" aspect="3:2" columns={3} projectId={where.projectId} pieceId={where.pieceId} me={where.me}
                  onPick={(pic) => { putLogo(pic.url); setGallery(false); }} />
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.5 }}>A PNG or JPG: Outlook and Gmail do not show SVG.</Typography>
              </Box>
            </Collapse>
          </>
        )}

        {el.kind === "picture" && (
          <>
            <Sub mt={0}>What the picture should show</Sub>
            <TextField fullWidth multiline minRows={2} maxRows={5} size="small" value={idea} disabled={!canEdit} onChange={(e) => setIdea(e.target.value.slice(0, 600))}
              placeholder="The part in use, hands and tools, the workshop - no lettering" sx={{ ...field, "& .MuiInputBase-root": { fontSize: "0.84rem", lineHeight: 1.45 } }} />
            {making !== null && (
              <Box role="status" sx={{ mt: 0.75 }}>
                <LinearProgress sx={{ height: 3, borderRadius: 2, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />
                <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 0.4, lineHeight: 1.35 }}>Making it - up to 40 seconds. From: “{madeFrom(making)}”</Typography>
              </Box>
            )}
            {err && <Typography sx={{ fontSize: "0.76rem", color: "#c5221f", mt: 0.5 }}>{err}</Typography>}
            {canEdit && (
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.75 }}>
                <Button size="small" disabled={mb.disabled} onClick={() => void make()} startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
                  sx={{ ...quiet, bgcolor: mb.disabled ? undefined : PINK, color: mb.disabled ? undefined : "#fff", "&:hover": { bgcolor: "#a3245c" } }}>{mb.label}</Button>
                <Button size="small" disabled={up !== null} onClick={() => file.current?.click()} startIcon={<FileUploadOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...quiet, border: `1px solid ${HAIRLINE}` }}>Upload</Button>
                <Button size="small" onClick={() => setGallery((v) => !v)} startIcon={<CollectionsOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...quiet, border: `1px solid ${gallery ? "#2459d1" : HAIRLINE}` }}>Gallery</Button>
              </Box>
            )}
            <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (!f) return;
              setErr(null); setUp(0);
              const r = await uploadPicture(f, { projectId: where.projectId, pieceId: where.pieceId }, setUp);
              setUp(null);
              if (!r.ok) setErr(r.error); else putPicture(r.picture.url, r.picture.alt ?? "", null);
            }} />
            {up !== null && <LinearProgress variant="determinate" value={up * 100} aria-label="Uploading the picture" sx={{ mt: 0.75, height: 3, borderRadius: 2 }} />}
            <Collapse in={gallery} timeout={200} unmountOnExit>
              <Box sx={{ mt: 1, border: `1px solid ${HAIRLINE}`, borderRadius: "8px", p: 1, bgcolor: "#fbfcfd" }}>
                <PicturePanel onPick={(pic) => { putPicture(pic.url, pic.alt ?? "", null); setGallery(false); }} projectId={where.projectId} pieceId={where.pieceId} me={where.me} aspect={aspect}
                  suggestion={idea || undefined} columns={3} tabs={["project", "mine", "products"]} start="project" />
              </Box>
            </Collapse>
            {"imageAlt" in b && hasPic && (
              <TextField fullWidth size="small" label="What it shows (if pictures are off)" value={b.imageAlt} disabled={!canEdit}
                onChange={(e) => { const v = e.target.value; setV((cur) => ({ ...cur, blocks: cur.blocks.map((x) => (x.id === b.id && "imageAlt" in x ? ({ ...x, imageAlt: v } as typeof x) : x)) })); }}
                sx={{ ...field, mt: 1.25 }} />
            )}
          </>
        )}

        {el.url !== null && (
          <>
            <Sub>Its link</Sub>
            <TextField fullWidth size="small" value={el.url} disabled={!canEdit} placeholder="https://www.apsoparts.com/…" inputProps={{ "aria-label": "Where it leads" }}
              onChange={(e) => setV((cur) => withLink(cur, k, e.target.value.trim()))} sx={{ ...field, "& input": { fontSize: "0.82rem" } }} />
            {canEdit && <Box sx={{ mt: 1.5 }}><PagePick pages={pages} language={d.language} value={el.url} onPick={(u) => setV((cur) => withLink(cur, k, u))} /></Box>}
            {langs.length > 1 && (
              <>
                <Sub mt={0.5}>In every language</Sub>
                {linkInLanguages(whole, k).map((x) => {
                  const n = x.url ? linkNote(x.url, x.lang, pages.rows) : null;
                  return (
                    <Box key={x.lang} sx={{ display: "flex", gap: 0.75, alignItems: "baseline", py: 0.25 }}>
                      <Typography sx={{ fontSize: "0.74rem", fontWeight: 800, width: 22, flexShrink: 0, color: x.lang === d.language.toUpperCase() ? PINK : INK }}>{x.lang}</Typography>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: "0.74rem", color: x.url ? "#2459d1" : MUTED, fontFamily: x.url ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" : undefined, wordBreak: "break-all" }}>{x.url ? x.url.replace(/^https?:\/\//, "") : "No link"}</Typography>
                        {n && n.tone !== "ok" && <StateLine tone={n.tone} line={n.line} mt={0.1} />}
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}
          </>
        )}

        {canEdit && aiOn && (el.kind === "words" || el.kind === "button") && (
          <>
            <Sub>Ask AI</Sub>
            <Box sx={{ p: 1, borderRadius: "9px", bgcolor: "rgba(194,44,110,.045)", border: "1px solid rgba(194,44,110,.16)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {busy ? <CircularProgress size={15} thickness={5} sx={{ color: PINK, flexShrink: 0 }} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 17, color: PINK, flexShrink: 0 }} />}
                <InputBase fullWidth value={q} disabled={busy} onChange={(e) => setQ(e.target.value)} placeholder={busy ? "Writing…" : "Ask AI for these words…"} inputProps={{ [AI_BOX_ATTR]: "1", "aria-label": "Ask AI for these words" }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(q); } }} sx={{ fontSize: "0.84rem", "& input::placeholder": { color: "#8a95a3", opacity: 1 } }} />
                <IconButton size="small" disabled={busy || !q.trim()} onClick={() => void ask(q)} aria-label="Ask" sx={{ color: PINK }}><SendRoundedIcon sx={{ fontSize: 17 }} /></IconButton>
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.75, flexWrap: "wrap" }}>
                {ASKS.map((a) => (
                  <Box key={a.label} component="button" type="button" disabled={busy} onClick={() => void ask(a.ask)} sx={{
                    all: "unset", cursor: busy ? "default" : "pointer", fontSize: "0.74rem", fontWeight: 650, color: busy ? "#b3bccb" : INK, px: 0.9, py: 0.3, borderRadius: "5px",
                    border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", "&:hover": busy ? {} : { borderColor: PINK, color: PINK },
                  }}>{a.label}</Box>
                ))}
              </Box>
            </Box>
            {said && (
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.75 }}>
                <Typography sx={{ flex: 1, fontSize: "0.78rem", color: said.tone === "warn" ? "#a96a12" : "#1b7a55", lineHeight: 1.4 }}>{said.text}</Typography>
                {said.undo && <Button size="small" onClick={() => { said.undo?.(); setSaid({ tone: "ok", text: "Taken back." }); }} sx={{ ...btn, px: 1, py: 0, minWidth: 0, color: PINK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", fontSize: "0.76rem" }}>Undo</Button>}
              </Box>
            )}
          </>
        )}
      </Box>
      {canEdit && (out || order) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.75, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "#fafbfc" }}>
          {out && <Button size="small" onClick={() => { setV(out.doc); onClose(); }} startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />} sx={{ ...quiet, color: MUTED, "&:hover": { color: "#c5221f" } }}>Take it out</Button>}
          <Box sx={{ flex: 1 }} />
          {order && (
            <>
              <Tooltip title="Duplicate - one more product next to it"><span><IconButton size="small" disabled={!order.dup} onClick={() => move("dup")} aria-label="Duplicate this product"><ContentCopyOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Tooltip title="Move it left"><span><IconButton size="small" disabled={!order.up} onClick={() => move(-1)} aria-label="Move this product left"><ArrowBackIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Tooltip title="Move it right"><span><IconButton size="small" disabled={!order.down} onClick={() => move(1)} aria-label="Move this product right"><ArrowForwardIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
