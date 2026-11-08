"use client";
// A PART OF THE BANNER, CHANGED WHERE IT IS (08.11.2026, Content v3; SARCLA: "banner also" - the editing was "very
// confusing", like the newsletter's). A click on the headline, the small line over it, the line, the button, the
// picture, its label or the background opens a small card right there, with only what that part needs:
//   words      the text, counted against this place's room; where the banner is used in several places, "Everywhere"
//              (the banner's words) or "Only here" (shorter words for this place alone)
//   headline   + the endings that take turns on the shop, where a place moves
//   button     + where it goes
//   picture    the shop's photos, or one made or uploaded (the hub's picture panel); one, or several in turn
//   background the newsletter band's colours
// Every change shows on the banner as it is typed and saves on its own.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { isHubPicture, photoLabel, SHOP_PHOTOS } from "@/lib/content/studio/kinds/banner/brand";
import { PRESET, THEMES, THEME_KEYS, sizesOf, type BannerDoc, type OwnWords, type Picture, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import type { PickPart } from "@/lib/content/studio/kinds/banner/render";
import { btn, field } from "../../parts";
import { PicturePanel, type Picture as HubPicture, type PictureAspect } from "../../pictures";
import { ChipsInput, Hint, PhotoPicker, Swatches } from "./ui";

export type Set = (fn: (d: BannerDoc) => BannerDoc) => void;

export const PART_NAME: Record<PickPart, string> = {
  eyebrow: "Small line over the headline", headline: "Headline", line: "Line", button: "Button", picture: "Picture", label: "Label on the picture", background: "Background",
};

type OwnField = keyof OwnWords;
const CONTENT_OF: Record<OwnField, (d: BannerDoc) => string> = {
  eyebrow: (d) => d.content.eyebrow, headline: (d) => d.content.headline, line: (d) => d.content.line, button: (d) => d.content.button.label,
};
const putContent = (d: BannerDoc, f: OwnField, v: string): BannerDoc => ({
  ...d,
  content: f === "button" ? { ...d.content, button: { ...d.content.button, label: v } } : { ...d.content, [f]: v },
});
const EMPTY_OWN: OwnWords = { eyebrow: "", headline: "", line: "", button: "" };
const LIMIT: Record<OwnField, "eyebrow" | "headline" | "line" | "button"> = { eyebrow: "eyebrow", headline: "headline", line: "line", button: "button" };
const PLACEHOLDER: Record<OwnField, string> = { eyebrow: "Newsletter", headline: "The one line the banner is for", line: "One sentence of substance", button: "Shop seals" };

/** A text of the banner, for this place: the banner's words everywhere, or this place's own. */
function Words({ doc, set, k, f, canEdit }: { doc: BannerDoc; set: Set; k: PresetKey; f: OwnField; canEdit: boolean }) {
  const own = doc.own[k]?.[f] ?? "";
  const only = !!own.trim();
  const many = sizesOf(doc).length > 1;
  const value = only ? own : CONTENT_OF[f](doc);
  const max = PRESET[k].limits[LIMIT[f]] || undefined;
  const over = max != null && value.length > max;
  const setOwn = (v: string) => set((d) => ({ ...d, own: { ...d.own, [k]: { ...(d.own[k] ?? EMPTY_OWN), [f]: v } } }));
  const change = (v: string) => (only ? setOwn(v) : set((d) => putContent(d, f, v)));
  return (
    <Box>
      <TextField autoFocus fullWidth size="small" multiline={f === "line"} minRows={f === "line" ? 2 : undefined} value={value} disabled={!canEdit} placeholder={PLACEHOLDER[f]}
        onChange={(e) => change(f === "line" ? e.target.value : e.target.value.replace(/\n/g, " "))} sx={field}
        helperText={max != null ? <Box component="span" sx={{ display: "flex", justifyContent: "flex-end" }}><span style={{ color: over ? "#c5221f" : MUTED, fontWeight: over ? 700 : 500 }}>{over ? `${value.length - max} too many for the ${PRESET[k].short.toLowerCase()}` : `${value.length} / ${max}`}</span></Box> : undefined} />
      {many && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
          <SquareChoice<string> value={only ? "here" : "all"} onChange={(v) => {
            if (!canEdit) return;
            if (v === "here" && !only) setOwn(CONTENT_OF[f](doc) || " ");
            if (v === "all" && only) set((d) => ({ ...d, own: { ...d.own, [k]: { ...(d.own[k] ?? EMPTY_OWN), [f]: "" } } }));
          }} options={[{ key: "all", label: "Everywhere" }, { key: "here", label: `Only the ${PRESET[k].short.toLowerCase()}` }]} />
        </Box>
      )}
    </Box>
  );
}

/** The banner's picture: the shop's photos, or one made or uploaded; one, or several in turn where a place moves. */
function PictureEditor({ doc, set, canEdit, projectId, pieceId, me }: { doc: BannerDoc; set: Set; canEdit: boolean; projectId: number; pieceId: number; me: string }) {
  const c = doc.content;
  const anyMotion = sizesOf(doc).some((k) => PRESET[k].motion);
  const many = c.photos.length >= 2;
  const lang = doc.language;
  const [from, setFrom] = useState<"shop" | "hub">(isHubPicture(c.image.url) ? "hub" : "shop");
  const setImage = (img: Picture) => set((d) => ({ ...d, content: { ...d.content, image: img } }));
  const places = sizesOf(doc);
  const aspect: PictureAspect = places.some((k) => k === "story" || k === "portrait") && !places.some((k) => PRESET[k].group === "shop") ? "4:5" : places.every((k) => k === "square") ? "1:1" : "3:2";
  const words = [`${c.headline} ${c.rotatingWords[0] ?? ""}`.trim(), c.line].filter((x) => x && x.trim()).join(" ");
  const suggestion = words ? `A photo for a banner that says: "${words}". Industrial components in use, real, calm light.` : "";
  const pickHub = (p: HubPicture) => {
    if (!canEdit) return;
    const label = p.name && !/\.(png|jpe?g|webp|gif)$/i.test(p.name) ? p.name.slice(0, 40) : "";
    if (many) set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.some((x) => x.url === p.url) ? d.content.photos : [...d.content.photos, { url: p.url, alt: "", label }] } }));
    else setImage({ url: p.url, alt: "", label: c.image.url === p.url ? c.image.label : label });
  };
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {anyMotion && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <SquareChoice<string> value={many ? "many" : "one"} onChange={(k) => canEdit && set((d) => ({
            ...d, content: {
              ...d.content,
              photos: k === "many"
                ? (d.content.photos.length >= 2 ? d.content.photos : [d.content.image, ...SHOP_PHOTOS.filter((p) => p.url !== d.content.image.url).slice(0, 2).map((p) => ({ url: p.url, alt: "", label: photoLabel(p, lang) }))].filter((p) => p.url))
                : [],
            },
          }))} options={[{ key: "one", label: "One picture" }, { key: "many", label: "Several in turn" }]} />
        </Box>
      )}
      {many && (
        <Box sx={{ display: "grid", gap: 0.6 }}>
          <Hint>They take turns on the shop, in step with the changing words - in this order.</Hint>
          {c.photos.map((p, i) => (
            <Box key={`${p.url}-${i}`} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
              <TextField size="small" fullWidth label={`Label ${i + 1}`} value={p.label} disabled={!canEdit} sx={field}
                onChange={(e) => set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.map((x, k) => (k === i ? { ...x, label: e.target.value.slice(0, 80) } : x)) } }))} />
              <Button size="small" disabled={!canEdit || c.photos.length <= 2} onClick={() => set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.filter((_, k) => k !== i) } }))} sx={{ ...btn, minWidth: 0, color: MUTED }}>Out</Button>
            </Box>
          ))}
        </Box>
      )}
      <SquareChoice value={from} onChange={setFrom} options={[{ key: "shop", label: "The shop's photos" }, { key: "hub", label: "Make or upload" }]} />
      {from === "shop" ? (
        <PhotoPicker multi={many} lang={lang} selected={many ? c.photos.map((p) => p.url) : [c.image.url]} onPick={(p) => canEdit && (many
          ? set((d) => {
            const has = d.content.photos.some((x) => x.url === p.url);
            const photos = has ? d.content.photos.filter((x) => x.url !== p.url) : [...d.content.photos, { url: p.url, alt: "", label: photoLabel(p, lang) }];
            return { ...d, content: { ...d.content, photos: photos.length >= 2 ? photos : d.content.photos } };
          })
          : setImage({ url: p.url, alt: "", label: photoLabel(p, lang) }))} />
      ) : (
        <PicturePanel key={suggestion ? "s" : "e"} onPick={pickHub} projectId={projectId} pieceId={pieceId} me={me} aspect={aspect} suggestion={suggestion} columns={3} />
      )}
      {!many && c.image.url && (
        <Box><Button size="small" disabled={!canEdit} onClick={() => setImage({ url: "", alt: "", label: "" })} sx={{ ...btn, color: MUTED, px: 0.5 }}>No picture</Button></Box>
      )}
    </Box>
  );
}

/** The card that opens on a part of the banner. */
export default function Editor({ doc, set, k, part, canEdit, projectId, pieceId, me, onClose }: {
  doc: BannerDoc; set: Set; k: PresetKey; part: PickPart; canEdit: boolean; projectId: number; pieceId: number; me: string; onClose: () => void;
}) {
  const c = doc.content;
  const anyMotion = sizesOf(doc).some((x) => PRESET[x].motion);
  return (
    <Box data-part-editor={part} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      sx={{ width: "100%", boxSizing: "border-box", bgcolor: "#fff", borderRadius: "10px", border: `1px solid ${HAIRLINE}`, boxShadow: "0 14px 40px rgba(31,45,78,.16)", p: 1.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: INK }}>{PART_NAME[part]}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon sx={{ fontSize: 17 }} /></IconButton>
      </Box>
      {(part === "eyebrow" || part === "line") && <Words doc={doc} set={set} k={k} f={part} canEdit={canEdit} />}
      {part === "headline" && (
        <>
          <Words doc={doc} set={set} k={k} f="headline" canEdit={canEdit} />
          {anyMotion && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 650, color: MUTED, mb: 0.6 }}>Endings that take turns on the shop</Typography>
              <ChipsInput values={c.rotatingWords} max={6} disabled={!canEdit} placeholder={c.rotatingWords.length ? "Another ending, then Enter" : "Optional - type one, then Enter"}
                onChange={(v) => set((d) => ({ ...d, content: { ...d.content, rotatingWords: v } }))} clean={(s) => s.trim().slice(0, 60)} />
              <Hint sx={{ mt: 0.6 }}>{c.rotatingWords.length ? `Each ends the headline and changes every 2.6 s. Pictures show "${`${c.headline} ${c.rotatingWords[0]}`.trim()}".` : "Like the newsletter band's technologies."}</Hint>
            </Box>
          )}
        </>
      )}
      {part === "button" && (
        <>
          <Words doc={doc} set={set} k={k} f="button" canEdit={canEdit} />
          <TextField fullWidth size="small" label="It goes to" value={c.button.url} disabled={!canEdit} placeholder="black-friday, or a full address" sx={{ ...field, mt: 1.5 }}
            onChange={(e) => set((d) => ({ ...d, content: { ...d.content, button: { ...d.content.button, url: e.target.value.trim() } } }))}
            helperText="A shop page's path links each store view to its own page." />
        </>
      )}
      {part === "label" && (
        <TextField autoFocus fullWidth size="small" value={c.photos.length >= 2 ? c.photos[0].label : c.image.label} disabled={!canEdit} placeholder="Empty = no label" sx={field}
          onChange={(e) => {
            const v = e.target.value.slice(0, 80);
            set((d) => (d.content.photos.length >= 2
              ? { ...d, content: { ...d.content, photos: d.content.photos.map((x, i) => (i === 0 ? { ...x, label: v } : x)) } }
              : { ...d, content: { ...d.content, image: { ...d.content.image, label: v } } }));
          }} />
      )}
      {part === "picture" && <PictureEditor doc={doc} set={set} canEdit={canEdit} projectId={projectId} pieceId={pieceId} me={me} />}
      {part === "background" && (
        <>
          <Swatches value={doc.theme} disabled={!canEdit} onChange={(t) => set((d) => ({ ...d, theme: t }))}
            options={THEME_KEYS.map((t) => ({ key: t, label: THEMES[t].name, fill: THEMES[t].bg }))} />
          <Hint sx={{ mt: 1 }}>{THEMES[doc.theme].name}{doc.theme === "pale" ? " - the newsletter band's" : ""}. The same in every place.</Hint>
        </>
      )}
    </Box>
  );
}
