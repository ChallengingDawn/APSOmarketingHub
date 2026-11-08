"use client";
// THE BANNER'S BUILD PANE (08.11.2026; SARCLA: "the banner can be in multiple places"): where it is used (squared place
// tiles, grouped: the shop, an e-mail, social media, ads), its words (the banner's - each place can carry shorter ones,
// set beside its preview), its picture (the shop's photos, or one made from the banner's words or uploaded - the hub's
// picture panel), its background, its language. Every change saves on its own (useStudio).

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { LANGUAGES } from "@/lib/content/languages";
import { isHubPicture, photoLabel, SHOP_PHOTOS } from "@/lib/content/studio/kinds/banner/brand";
import {
  GROUPS, PRESET, PRESETS, THEMES, THEME_KEYS, sizesOf, togglePlace, roomiest,
  type BannerDoc, type Picture, type PresetKey,
} from "@/lib/content/studio/kinds/banner/model";
import { Field, btn, field } from "../../parts";
import { PicturePanel, type Picture as HubPicture, type PictureAspect } from "../../pictures";
import { ChipsInput, Hint, PhotoPicker, Section, Swatches, pictureProblem } from "./ui";

export const SEL = "#2459d1";

export type BuildProps = {
  doc: BannerDoc;
  set: (fn: (d: BannerDoc) => BannerDoc) => void;
  canEdit: boolean;
  /** A place was added: the stage shows it. */
  onAdded: (k: PresetKey) => void;
  projectId: number;
  pieceId: number;
  me: string;
};

/** A place's shape, drawn small and true to its proportions. */
export function Shape({ k, on, box = 30 }: { k: PresetKey; on: boolean; box?: number }) {
  const p = PRESET[k];
  const h = p.h ?? Math.round(p.w * (k === "cat" ? 0.2 : 0.32));
  const s = Math.min(box / p.w, (box - 4) / h);
  return (
    <Box sx={{ width: box + 4, height: box, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Box sx={{ width: Math.max(4, p.w * s), height: Math.max(4, h * s), borderRadius: "2px", bgcolor: on ? "#274e64" : "#c9d3dc", transition: "background .15s" }} />
    </Box>
  );
}

/** The places, as squared tiles: a click puts the banner there or takes it out. */
function Places({ doc, set, canEdit, onAdded }: BuildProps) {
  const made = sizesOf(doc);
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {GROUPS.map((g) => (
        <Box key={g.key}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 650, color: MUTED, mb: 0.6 }}>{g.label}</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75 }}>
            {PRESETS.filter((p) => p.group === g.key).map((p) => {
              const on = made.includes(p.key);
              const last = on && made.length === 1;
              return (
                <Box key={p.key} component="button" type="button" disabled={!canEdit || last} aria-pressed={on}
                  title={last ? "A banner keeps one place at least" : `${p.label} - ${p.note}. ${p.out === "html" ? "A paste block for the shop" : "A picture (PNG)"}.`}
                  onClick={() => { set((d) => togglePlace(d, p.key)); if (!on) onAdded(p.key); }}
                  sx={{
                    all: "unset", boxSizing: "border-box", cursor: canEdit && !last ? "pointer" : "default", position: "relative", display: "flex", alignItems: "center", gap: 0.75,
                    p: 0.9, pr: 3.25, borderRadius: "6px", minWidth: 0, border: `1px solid ${on ? "rgba(36,89,209,.55)" : HAIRLINE}`,
                    bgcolor: on ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.6)", transition: "border-color .15s, background .15s",
                    "&:hover": canEdit && !last ? { borderColor: on ? SEL : "#9fb3c0" } : {}, "&:focus-visible": { outline: `2px solid ${SEL}`, outlineOffset: 1 },
                  }}>
                  <Shape k={p.key} on={on} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 650, color: on ? INK : MUTED, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.short}</Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
                      {p.h ? `${p.w} × ${p.h}` : "Full width"}
                    </Typography>
                  </Box>
                  <Box sx={{
                    position: "absolute", top: 7, right: 7, width: 16, height: 16, borderRadius: "3px", display: "grid", placeItems: "center",
                    bgcolor: on ? SEL : "transparent", border: on ? "none" : "1.5px solid #b9c6d1", color: "#fff",
                  }}>{on && <CheckIcon sx={{ fontSize: 13 }} />}</Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** The picture the banner's places show: the shop's photos, or one made or uploaded (the hub's picture panel). */
function PictureFields({ doc, set, canEdit, projectId, pieceId, me }: BuildProps) {
  const c = doc.content;
  const anyMotion = sizesOf(doc).some((k) => PRESET[k].motion);
  const many = c.photos.length >= 2;
  const lang = doc.language;
  const [from, setFrom] = useState<"shop" | "hub">(isHubPicture(c.image.url) ? "hub" : "shop");
  const setImage = (img: Picture) => set((d) => ({ ...d, content: { ...d.content, image: img } }));
  const problem = pictureProblem(c.image.url);
  // a picture for the places it is used in: wide for the shop's bands, square or tall for social media
  const places = sizesOf(doc);
  const aspect: PictureAspect = places.some((k) => k === "story" || k === "portrait") && !places.some((k) => PRESET[k].group === "shop") ? "4:5" : places.every((k) => k === "square") ? "1:1" : "3:2";
  const words = [c.headline, c.rotatingWords[0], c.line].filter((x) => x && x.trim()).join(" - ");
  const suggestion = words ? `A photo for a banner that says: "${words}". Industrial components in use, real, calm light.` : "";
  const pickHub = (p: HubPicture) => {
    if (!canEdit) return;
    const label = p.name && !/\.(png|jpe?g|webp|gif)$/i.test(p.name) ? p.name.slice(0, 40) : "";
    if (many) set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.some((x) => x.url === p.url) ? d.content.photos : [...d.content.photos, { url: p.url, alt: "", label }] } }));
    else setImage({ url: p.url, alt: "", label: c.image.url === p.url ? c.image.label : label });
  };
  const cur = many ? c.photos[0]?.url : c.image.url;
  return (
    <Section title="Picture" right={anyMotion ? (
      <SquareChoice value={many ? "many" : "one"} onChange={(k) => canEdit && set((d) => ({
        ...d, content: {
          ...d.content,
          photos: k === "many"
            ? (d.content.photos.length >= 2 ? d.content.photos : [d.content.image, ...SHOP_PHOTOS.filter((p) => p.url !== d.content.image.url).slice(0, 2).map((p) => ({ url: p.url, alt: "", label: photoLabel(p, lang) }))].filter((p) => p.url))
            : [],
        },
      }))} options={[{ key: "one", label: "One" }, { key: "many", label: "Changing" }]} />
    ) : undefined}>
      {cur ? (
        <Box sx={{ position: "relative", aspectRatio: "16 / 7", borderRadius: "8px", overflow: "hidden", bgcolor: "#e9ebed", mb: 1.25, border: `1px solid ${HAIRLINE}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          {many && <Box sx={{ position: "absolute", top: 8, left: 8, px: 0.9, py: 0.25, borderRadius: "4px", bgcolor: "rgba(21,34,58,.78)", color: "#fff", fontSize: "0.72rem", fontWeight: 650 }}>{c.photos.length} in turn</Box>}
        </Box>
      ) : (
        <Box sx={{ aspectRatio: "16 / 7", borderRadius: "8px", border: `1.5px dashed ${HAIRLINE}`, display: "grid", placeItems: "center", mb: 1.25, color: MUTED, fontSize: "0.82rem" }}>No picture</Box>
      )}
      {many ? (
        <>
          <Hint sx={{ mb: 1 }}>The card shows these in turn, in step with the changing words - in this order. Two or more.</Hint>
          <Box sx={{ display: "grid", gap: 0.75, mb: 1.25 }}>
            {c.photos.map((p, i) => (
              <Box key={`${p.url}-${i}`} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" style={{ width: 44, height: 34, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                <TextField size="small" fullWidth label={`Label ${i + 1}`} value={p.label} disabled={!canEdit} sx={field}
                  onChange={(e) => set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.map((x, k) => (k === i ? { ...x, label: e.target.value.slice(0, 80) } : x)) } }))} />
                <Button size="small" disabled={!canEdit || c.photos.length <= 2} onClick={() => set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.filter((_, k) => k !== i) } }))} sx={{ ...btn, minWidth: 0, color: MUTED }}>Out</Button>
              </Box>
            ))}
          </Box>
        </>
      ) : (
        cur && <Field label="Label on the photo" value={c.image.label} onChange={(v) => setImage({ ...c.image, label: v })} max={40} placeholder="Empty = no label" disabled={!canEdit} />
      )}
      <Box sx={{ mb: 1 }}>
        <SquareChoice value={from} onChange={setFrom} options={[{ key: "shop", label: "The shop's photos" }, { key: "hub", label: "Make or upload" }]} />
      </Box>
      {from === "shop" ? (
        <>
          <PhotoPicker multi={many} lang={lang} selected={many ? c.photos.map((p) => p.url) : [c.image.url]} onPick={(p) => canEdit && (many
            ? set((d) => {
              const has = d.content.photos.some((x) => x.url === p.url);
              const photos = has ? d.content.photos.filter((x) => x.url !== p.url) : [...d.content.photos, { url: p.url, alt: "", label: photoLabel(p, lang) }];
              return { ...d, content: { ...d.content, photos: photos.length >= 2 ? photos : d.content.photos } };
            })
            : setImage({ url: p.url, alt: "", label: photoLabel(p, lang) }))} />
          {!many && (
            <TextField size="small" fullWidth label="Or a shop picture's address" value={isHubPicture(c.image.url) ? "" : c.image.url} disabled={!canEdit} sx={{ ...field, mt: 1.25 }}
              placeholder="https://www.apsoparts.com/media/…" onChange={(e) => setImage({ ...c.image, url: e.target.value.trim() })}
              error={!!problem} helperText={problem ?? undefined} />
          )}
        </>
      ) : (
        <PicturePanel key={suggestion ? "s" : "e"} onPick={pickHub} projectId={projectId} pieceId={pieceId} me={me} aspect={aspect} suggestion={suggestion} columns={3} />
      )}
      {!many && c.image.url && (
        <Button size="small" disabled={!canEdit} onClick={() => setImage({ url: "", alt: "", label: "" })} sx={{ ...btn, color: MUTED, mt: 0.5 }}>No picture</Button>
      )}
    </Section>
  );
}

export default function BuildPane(props: BuildProps) {
  const { doc, set, canEdit } = props;
  const c = doc.content;
  const main = PRESET[roomiest(doc)];
  const anyMotion = sizesOf(doc).some((k) => PRESET[k].motion);
  const put = (fn: (c: BannerDoc["content"]) => BannerDoc["content"]) => set((d) => ({ ...d, content: fn(d.content) }));
  return (
    <Box>
      <Section first title="Where it goes">
        <Places {...props} />
        <Hint sx={{ mt: 1.25 }}>The shop&apos;s places give a paste block for Magento; the others a picture at its real size.</Hint>
      </Section>

      <Section title="Words">
        <Field label="Eyebrow" value={c.eyebrow} onChange={(v) => put((x) => ({ ...x, eyebrow: v }))} max={main.limits.eyebrow || 28} placeholder="Newsletter" disabled={!canEdit} />
        <Field label={c.rotatingWords.length ? "Headline - its fixed start" : "Headline"} value={c.headline} onChange={(v) => put((x) => ({ ...x, headline: v }))} max={main.limits.headline}
          placeholder={c.rotatingWords.length ? "Want to know more about" : "The one line the banner is for"} disabled={!canEdit} />
        {anyMotion && (
          <Box sx={{ mb: 1.5 }}>
            <ChipsInput values={c.rotatingWords} max={6} disabled={!canEdit} placeholder={c.rotatingWords.length ? "Another ending, then Enter" : "Changing words (optional) - type one, then Enter"}
              onChange={(v) => put((x) => ({ ...x, rotatingWords: v }))} clean={(s) => s.trim().slice(0, 60)} />
            <Hint sx={{ mt: 0.75 }}>
              {c.rotatingWords.length
                ? `Each ends the headline and changes every 2.6 s on the shop. Pictures show "${`${c.headline} ${c.rotatingWords[0]}`.trim()}".`
                : "Endings for the headline that take turns on the shop - like the newsletter band's technologies."}
            </Hint>
          </Box>
        )}
        <Field label="Line" value={c.line} onChange={(v) => put((x) => ({ ...x, line: v }))} max={main.limits.line || 200} multiline rows={2} placeholder="One sentence of substance" disabled={!canEdit} />
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: 1 }}>
          <Field label="Button" value={c.button.label} onChange={(v) => put((x) => ({ ...x, button: { ...x.button, label: v } }))} max={main.limits.button || 24} placeholder="Shop seals" disabled={!canEdit} />
          <Field label="It goes to" value={c.button.url} onChange={(v) => put((x) => ({ ...x, button: { ...x.button, url: v.trim() } }))} placeholder="black-friday" disabled={!canEdit} />
        </Box>
        <Hint>Counted against {main.label}, the place with the most room. Smaller places get their own shorter words beside their preview.</Hint>
      </Section>

      <PictureFields {...props} />

      <Section title="Background">
        <Swatches value={doc.theme} disabled={!canEdit} onChange={(k) => set((d) => ({ ...d, theme: k }))}
          options={THEME_KEYS.map((k) => ({ key: k, label: THEMES[k].name, fill: THEMES[k].bg }))} />
        <Hint sx={{ mt: 1 }}>{THEMES[doc.theme].name}{doc.theme === "pale" ? " - the newsletter band's" : ""}</Hint>
      </Section>

      <Section title="Language">
        <TextField select size="small" fullWidth value={LANGUAGES.some((l) => l.code === doc.language) ? doc.language : "EN"} disabled={!canEdit} sx={field}
          onChange={(e) => set((d) => ({ ...d, language: e.target.value }))}>
          {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
        </TextField>
        <Hint sx={{ mt: 0.75 }}>The AI writes in it; the shop photos&apos; labels follow when you pick one.</Hint>
      </Section>

      <Section title="Notes">
        <Field label="For the team" value={doc.notes} onChange={(v) => set((d) => ({ ...d, notes: v }))} multiline rows={3} disabled={!canEdit} />
      </Section>
    </Box>
  );
}
