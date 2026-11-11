"use client";
// A PART OF THE BANNER, IN ITS OWN POPUP ON THE BANNER (cv16, 11.11.2026; SARCLA: "compare the evolution of this page [the
// Page builder] to the other content types' generators, and improve them"). The Page builder's element popups (its
// pops.tsx: TextPop, ButtonPop, PicturePop - reused as they are), opened by a click on a part of the banner, with the
// sections in the Page builder's order:
//   words      the part's words, live on the banner as they are typed; counted against this place's room; "Everywhere" or
//              "Only the <place>" where the banner is used in several places
//   its page   the button: "Find a page" (the shop's page index) + "In every store view"
//   look       the headline: its colour and a word in red; the design (the background): the shop's designs, its colours
//   Ask AI     the part's own box - applied at once, with the Undo of exactly that (the bar's "Ask AI" puts the cursor here)
//   foot       Take it out (the small line, the line, the button, the label, the picture)
// The picture: This picture / Gallery / Products / Fine-tune; "Make it" / "Make another" from the box's CURRENT words;
// while one is made, "From: ..." and "Make it from these words instead" - the newest ask wins (page/pictureJobs.ts).
// The design (a click on the banner's ground): the whole banner's popup - its design, then "Write it again with AI" with
// "What should change? Empty: write it from the brief", applied at once with Undo.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { photoLabel } from "@/lib/content/studio/kinds/banner/brand";
import { clearPart, readPart, targetOf, writePart, type WordPartKey } from "@/lib/content/studio/kinds/banner/edit";
import { HEAD_COLORS, PRESET, sizeLabel, sizesOf, type BannerDoc, type OwnWords, type Picture, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { AI_BOX_ATTR } from "@/lib/content/studio/kinds/page/barAi";
import { isNewest, startJob, type SlotJobs } from "@/lib/content/studio/kinds/page/pictureJobs";
import type { PickPart } from "@/lib/content/studio/kinds/banner/render";
import { PINK, btn, mainBtn } from "../../parts";
import { makePicture, refinePicture, uploadPicture, type Picture as HubPicture, type PictureAspect } from "../../pictures";
import { storeForLang } from "../../productPictures";
import type { StudioApi } from "../../useStudio";
import type { Making } from "../page/Fields";
import { ButtonPop, PicturePop, PopCard, TextPop } from "../page/pops";
import DesignFields from "./Design";
import { PART_NAME, inLine, type Set } from "./Editor";
import { SaidRules, type BannerAi } from "./Output";
import { ChipsInput, PhotoPicker } from "./ui";

const STORES = ["de-CH", "fr-CH", "it-CH", "en-INT", "de-DE", "fr-FR", "it-IT", "nl-NL", "pl-PL"];
/** The store views in the banner's language (its button's page in each of them). */
const storesOf = (lang: string) => STORES.filter((s) => s.slice(0, 2) === lang.slice(0, 2).toLowerCase());

const Sub = ({ children, mt = 1.5 }: { children: React.ReactNode; mt?: number }) => (
  <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mt, mb: 0.6 }}>{children}</Typography>
);

/** The picture's aspect for the places it is used in (as the map's picture slot). */
export function aspectOf(doc: BannerDoc): PictureAspect {
  const places = sizesOf(doc);
  return places.some((x) => x === "story" || x === "portrait") && !places.some((x) => PRESET[x].group === "shop") ? "4:5" : places.every((x) => x === "square") ? "1:1" : "3:2";
}
/** What the picture should show when no words were given for it: the banner's own words. */
export function ideaOf(doc: BannerDoc): string {
  if (doc.idea?.trim()) return doc.idea.trim();
  const c = doc.content;
  const words = [`${c.headline} ${c.rotatingWords[0] ?? ""}`.trim(), c.line].filter((x) => x && x.trim()).join(" ");
  return words ? `A photo for a banner that says: "${words}". Industrial components in use, real, calm light.` : "Industrial components in use, real, calm light, for APSOparts.";
}

/** "Everywhere" or "Only the <place>" for a part's words, where the banner is used in several places. */
function WhereWords({ doc, set, k, f, canEdit, onTarget }: { doc: BannerDoc; set: Set; k: PresetKey; f: keyof OwnWords; canEdit: boolean;
  /** where the words typed in the popup go from now on */
  onTarget: (t: "own" | "banner") => void;
}) {
  if (sizesOf(doc).length < 2) return null;
  const own = doc.own[k]?.[f] ?? "";
  const only = !!own.trim();
  const master = f === "button" ? doc.content.button.label : doc.content[f];
  const EMPTY: OwnWords = { eyebrow: "", headline: "", line: "", button: "" };
  return (
    <Box sx={{ mt: 1 }}>
      <SquareChoice<string> value={only ? "here" : "all"} onChange={(v) => {
        if (!canEdit) return;
        if (v === "here" && !only) { onTarget("own"); set((d) => ({ ...d, own: { ...d.own, [k]: { ...(d.own[k] ?? EMPTY), [f]: master || " " } } })); }
        if (v === "all" && only) { onTarget("banner"); set((d) => ({ ...d, own: { ...d.own, [k]: { ...(d.own[k] ?? EMPTY), [f]: "" } } })); }
      }} options={[{ key: "all", label: "Everywhere" }, { key: "here", label: `Only the ${inLine(PRESET[k].short)}` }]} />
    </Box>
  );
}

/** The headline's look: its colour, a word of it in the shop's red; and the endings that take turns where a place moves. */
function HeadlineMore({ doc, set, canEdit }: { doc: BannerDoc; set: Set; canEdit: boolean }) {
  const words = [...new Set(doc.content.headline.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((w) => w.length > 1))].slice(0, 10);
  const anyMotion = sizesOf(doc).some((x) => PRESET[x].motion);
  return (
    <>
      {anyMotion && (
        <Box sx={{ mt: 1.25 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 650, color: MUTED, mb: 0.5 }}>Endings that take turns on the shop</Typography>
          <ChipsInput values={doc.content.rotatingWords} max={6} disabled={!canEdit} placeholder={doc.content.rotatingWords.length ? "Another ending, then Enter" : "Optional - type one, then Enter"}
            onChange={(v) => set((d) => ({ ...d, content: { ...d.content, rotatingWords: v } }))} clean={(s) => s.trim().slice(0, 60)} />
        </Box>
      )}
      <Sub>Look</Sub>
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 650, color: MUTED, mb: 0.5 }}>Its colour</Typography>
      <SquareChoice<string> value={doc.headColor} onChange={(v) => canEdit && set((d) => ({ ...d, headColor: v as BannerDoc["headColor"] }))}
        options={HEAD_COLORS.map((c) => ({ key: c.key, label: c.label, disabled: !canEdit }))} />
      {words.length > 0 && (
        <>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 650, color: MUTED, mt: 1, mb: 0.5 }}>A word in red</Typography>
          <SquareChoice<string> value={words.includes(doc.accent) ? doc.accent : ""} onChange={(w) => canEdit && set((d) => ({ ...d, accent: d.accent === w ? "" : w }))}
            options={[{ key: "", label: "None", disabled: !canEdit }, ...words.map((w) => ({ key: w, label: w, disabled: !canEdit }))]} />
        </>
      )}
    </>
  );
}

/** "Write it again with AI" with its box (the Page builder's block popup): applied at once, with Undo. */
function WriteBox({ ai, canAi }: { ai: BannerAi; canAi: boolean }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const busy = !!ai.busy;
  const go = async () => {
    setMsg(null);
    const ask = q.trim();
    const err = await ai.writeAgain(ask ? "ask" : "topic", ask || undefined);
    if (err) setMsg({ tone: "warn", text: err }); else { setQ(""); setMsg({ tone: "ok", text: ask ? "Written again as you asked - it is on the banner." : "Written again from the brief - it is on the banner." }); }
  };
  return (
    <Box sx={{ mt: 1.5, p: 1.1, borderRadius: "9px", bgcolor: "rgba(194,44,110,.045)", border: "1px solid rgba(194,44,110,.16)" }}>
      <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "8px", bgcolor: "#fff", px: 1, py: 0.4, "&:focus-within": { borderColor: PINK } }}>
        <InputBase fullWidth multiline minRows={2} maxRows={5} value={q} disabled={!canAi || busy} onChange={(e) => setQ(e.target.value.slice(0, 1200))}
          placeholder="What should change? Empty: write it from the brief" inputProps={{ [AI_BOX_ATTR]: "1", "aria-label": "What should change?" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void go(); } }} sx={{ fontSize: "0.84rem", lineHeight: 1.45 }} />
      </Box>
      <Button fullWidth variant="contained" disableElevation disabled={!canAi || busy} onClick={() => void go()}
        startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} />}
        sx={{ ...mainBtn, mt: 0.75, bgcolor: PINK, borderRadius: "7px", height: 34, fontSize: "0.82rem", "&:hover": { bgcolor: "#a3245c" } }}>
        {busy ? "Writing the banner…" : "Write it again with AI"}
      </Button>
      {msg && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.75 }}>
          <Typography sx={{ flex: 1, fontSize: "0.78rem", color: msg.tone === "warn" ? "#a96a12" : "#1b7a55", lineHeight: 1.4 }}>{msg.text}</Typography>
          {msg.tone === "ok" && ai.wrote && <Button size="small" onClick={() => { ai.undoWrote(); setMsg({ tone: "ok", text: "Taken back." }); }} sx={{ ...btn, px: 1, py: 0, minWidth: 0, color: PINK, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", fontSize: "0.76rem" }}>Undo</Button>}
        </Box>
      )}
      {ai.said.length > 0 && <SaidRules said={ai.said} />}
    </Box>
  );
}

/** The picture's popup: the Page builder's PicturePop with the banner's sources (the shop's own photos under it). */
function PicturePart({ api, doc, set, k, canEdit, canMake, onClose, onWork }: {
  api: StudioApi; doc: BannerDoc; set: Set; k: PresetKey; canEdit: boolean; canMake: boolean; onClose: () => void;
  onWork: (w: { label: string; since: number; share?: number } | null) => void;
}) {
  const c = doc.content;
  const many = c.photos.length >= 2;
  const pic = many ? c.photos[0] : c.image;
  const lang = doc.language;
  const aspect = aspectOf(doc);
  const where = { projectId: api.data.piece.projectId, pieceId: api.data.piece.id };
  const [making, setMaking] = useState<Making | null>(null);
  const jobs = useRef<SlotJobs>({});
  const file = useRef<HTMLInputElement | null>(null);
  const put = (url: string, label = "", product?: { alt: string }) => set((d) => {
    const p: Picture = { url, alt: product?.alt ?? "", label: product ? "" : label, ...(product ? { fit: "product" as const } : {}) };
    return d.content.photos.length >= 2
      ? { ...d, content: { ...d.content, photos: d.content.photos.some((x) => x.url === url) ? d.content.photos : [...d.content.photos, p] } }
      : { ...d, content: { ...d.content, image: product ? p : { ...p, label: label || (d.content.image.fit === "product" ? "" : d.content.image.label) } } };
  });
  // the newest ask wins (the Page builder's pictureJobs): an older picture still lands in the project's pictures, never here
  const make = async (idea: string, fine?: string) => {
    const n = startJob(jobs.current, "picture");
    const label = fine ? "Fine-tuning the picture…" : "Making the picture…";
    setMaking({ state: "making", label, idea });
    onWork({ label: fine ? "Fine-tuning the picture" : "Making the picture", since: Date.now() });
    const r = fine ? await refinePicture(pic.url, fine, aspect, where) : await makePicture(idea, aspect, where);
    if (!isNewest(jobs.current, "picture", n)) return r.ok ? null : r.error;
    onWork(null);
    if (!r.ok) { setMaking({ state: "error", error: r.error }); return r.error; }
    setMaking(null);
    put(r.picture.url);
    return null;
  };
  const upload = async (list: FileList | null) => {
    const f = Array.from(list ?? []).find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const n = startJob(jobs.current, "picture");
    const since = Date.now();
    onWork({ label: "Uploading", since, share: 0 });
    const r = await uploadPicture(f, where, (share) => onWork({ label: "Uploading", since, share }));
    if (!isNewest(jobs.current, "picture", n)) return;
    onWork(null);
    if (!r.ok) { setMaking({ state: "error", error: r.error }); return; }
    setMaking(null);
    put(r.picture.url);
  };
  useEffect(() => () => onWork(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      <PicturePop kicker={`${PRESET[k].label} · ${sizeLabel(PRESET[k])}`} title={many ? `Picture 1 of ${c.photos.length} (they take turns)` : "Picture"}
        api={api} store={storeForLang(lang)} aspect={aspect} url={pic.url} alt={pic.alt} idea={ideaOf(doc)} making={making} canEdit={canEdit} canMake={canMake}
        onMake={(idea) => void make(idea || ideaOf(doc))} onIdea={(idea) => set((d) => ({ ...d, idea: idea.slice(0, 600) }))}
        onUpload={() => file.current?.click()}
        onPick={(p: HubPicture) => put(p.url, p.kind === "product" ? "" : p.name && !/\.(png|jpe?g|webp|gif)$/i.test(p.name) ? p.name.slice(0, 40) : "", p.kind === "product" ? { alt: (p.alt ?? "").slice(0, 300) } : undefined)}
        onAlt={(alt) => set((d) => (d.content.photos.length >= 2
          ? { ...d, content: { ...d.content, photos: d.content.photos.map((x, i) => (i === 0 ? { ...x, alt: alt.slice(0, 300) } : x)) } }
          : { ...d, content: { ...d.content, image: { ...d.content.image, alt: alt.slice(0, 300) } } }))}
        onRemove={!many ? () => { set((d) => ({ ...d, content: { ...d.content, image: { url: "", alt: "", label: "" } } })); onClose(); } : undefined}
        onRefine={canMake ? (ask) => make(ideaOf(doc), ask) : null}
        onClose={onClose}
        hint={(
          <Box sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, mb: 0.6 }}>The shop&apos;s technology photos</Typography>
            <PhotoPicker lang={lang} selected={many ? c.photos.map((x) => x.url) : [c.image.url]} onPick={(ph) => canEdit && put(ph.url, photoLabel(ph, lang))} />
          </Box>
        )} />
    </>
  );
}

/**
 * The popup of the part selected on the banner. Its words go onto the banner as they are typed (and are listed under
 * "Changes made here" with their Undo when it closes); the AI's are applied at once with the Undo of exactly that.
 */
export default function PartPopup({ api, doc, set, k, part, canEdit, ai, onClose, onTyped, onWork }: {
  api: StudioApi; doc: BannerDoc; set: Set; k: PresetKey; part: PickPart; canEdit: boolean; ai: BannerAi; onClose: () => void;
  onTyped?: (label: string, before: BannerDoc) => void;
  onWork: (w: { label: string; since: number; share?: number } | null) => void;
}) {
  const canAi = api.data.ai && canEdit;
  const kicker = `${PRESET[k].label} · ${sizeLabel(PRESET[k])}`;
  const before = useRef(doc);
  // a part's words keep where they came from while its popup is open (the banner's, or this place's own)
  const target = useRef(part === "background" || part === "picture" ? "banner" : targetOf(doc, k, part as WordPartKey));
  useEffect(() => { before.current = doc; target.current = part === "background" || part === "picture" ? "banner" : targetOf(doc, k, part as WordPartKey); }, [part, k]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    if (part !== "background" && part !== "picture") {
      const w = part as WordPartKey;
      if (readPart(doc, k, w) !== readPart(before.current, k, w)) onTyped?.(`${PART_NAME[part]}: changed in its popup`, before.current);
    }
    onClose();
  };
  const remove = (w: WordPartKey) => ({
    label: "Take it out",
    run: () => { const b = doc; set((d) => clearPart(d, w)); onTyped?.(`${PART_NAME[w]}: taken out`, b); onClose(); },
  });
  const ask = (w: "eyebrow" | "headline" | "line" | "button") => (canAi ? async (q: string) => ai.askPart(w, q) : null);

  if (part === "picture") return <PicturePart api={api} doc={doc} set={set} k={k} canEdit={canEdit} canMake={canAi} onClose={onClose} onWork={onWork} />;
  if (part === "background") {
    return (
      <PopCard kicker={kicker} title="The banner · its design" onClose={onClose} maxBody="min(66vh, 680px)"
        foot={<><Box sx={{ flex: 1 }} /><Button size="small" variant="contained" disableElevation onClick={onClose} sx={{ ...mainBtn, borderRadius: "7px", px: 2, py: 0.5, fontSize: "0.82rem", minWidth: 0 }}>Done</Button></>}>
        <Sub mt={0}>Look</Sub>
        <DesignFields doc={doc} set={set} canEdit={canEdit} pieceId={api.data.piece.id} />
        {canEdit && <><Sub>Ask AI</Sub><WriteBox ai={ai} canAi={canAi} /></>}
      </PopCard>
    );
  }
  if (part === "button") {
    const max = PRESET[k].limits.button || 24;
    return (
      <ButtonPop kicker={kicker} title="Button" label={readPart(doc, k, "button")} max={max}
        onLabel={(v) => set((d) => writePart(d, k, "button", v, target.current as "own" | "banner"))}
        url={doc.content.button.url} onUrl={(v) => set((d) => ({ ...d, content: { ...d.content, button: { ...d.content.button, url: v.trim() } } }))}
        api={api} store={storeForLang(doc.language)} stores={storesOf(doc.language)} grounds={[]} fallback="#d80901" canEdit={canEdit} ai={ask("button")}
        onRemove={canEdit ? remove("button") : null} onClose={close}
        hint={(
          <>
            {PRESET[k].group === "shop" ? "A page picked here is linked as it is - on a shop page too; a path without a store view (\"black-friday\") links each store view to its own page." : "On a picture the button is drawn; the link is the post's or the e-mail's."}
            <WhereWords doc={doc} set={set} k={k} f="button" canEdit={canEdit} onTarget={(t) => { target.current = t; }} />
          </>
        )} />
    );
  }
  const w = part as WordPartKey;
  const max = w === "label" ? 80 : PRESET[k].limits[w] || null;
  return (
    <TextPop kicker={kicker} title={PART_NAME[part]} value={readPart(doc, k, w)} max={max} multiline={w === "line"} canEdit={canEdit} live
      onChange={(v) => set((d) => writePart(d, k, w, v, target.current as "own" | "banner"))}
      onDone={(v) => { set((d) => writePart(d, k, w, v, target.current as "own" | "banner")); close(); }}
      onClose={close}
      ai={w === "label" ? null : ask(w)}
      onRemove={canEdit && w !== "headline" ? remove(w) : null}
      hint={w === "label" ? "The label on the picture (the newsletter band's design)." : (
        <>
          <WhereWords doc={doc} set={set} k={k} f={w} canEdit={canEdit} onTarget={(t) => { target.current = t; }} />
          {w === "headline" && <HeadlineMore doc={doc} set={set} canEdit={canEdit} />}
        </>
      )} />
  );
}
