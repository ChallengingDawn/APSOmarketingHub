"use client";
// THE BANNER'S BUILD PANE (08.11.2026): its sizes, its words (the banner's, and shorter ones for one size), its picture
// or the photos that change with the words, its background, its language. Every change saves on its own (useStudio).

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";

import { Choice } from "@/app/connectors/parts";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { LANGUAGES } from "@/lib/content/languages";
import { photoLabel, SHOP_PHOTOS } from "@/lib/content/studio/kinds/banner/brand";
import { PRESET, PRESETS, THEMES, THEME_KEYS, sizeLabel, sizesOf, wordsFor, type BannerDoc, type OwnWords, type Picture, type PresetKey } from "@/lib/content/studio/kinds/banner/model";
import { Field, PINK, btn, field } from "../../parts";
import { ChipsInput, Hint, PhotoPicker, Section, Swatches, pictureProblem } from "./ui";

export type BuildProps = {
  doc: BannerDoc;
  set: (fn: (d: BannerDoc) => BannerDoc) => void;
  active: PresetKey;
  setActive: (k: PresetKey) => void;
  canEdit: boolean;
};

/** A size's shape, drawn small and true to its proportions. */
function Shape({ k, on }: { k: PresetKey; on: boolean }) {
  const p = PRESET[k];
  const h = p.h ?? Math.round(p.w * 0.3);
  const s = Math.min(30 / p.w, 26 / h);
  return (
    <Box sx={{ width: 34, height: 30, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Box sx={{ width: Math.max(4, p.w * s), height: Math.max(4, h * s), borderRadius: "3px", bgcolor: on ? "#274e64" : "#c9d3dc", transition: "background .15s" }} />
    </Box>
  );
}

function Sizes({ doc, set, active, setActive, canEdit }: BuildProps) {
  const made = sizesOf(doc);
  const toggle = (k: PresetKey) => set((d) => {
    const all = sizesOf(d);
    if (all.includes(k)) {
      if (all.length === 1) return d;
      const rest = all.filter((x) => x !== k);
      return { ...d, format: rest[0], sizes: rest.slice(1) };
    }
    return { ...d, sizes: [...d.sizes, k] };
  });
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75 }}>
      {PRESETS.map((p) => {
        const on = made.includes(p.key);
        const here = active === p.key;
        return (
          <Box key={p.key} onClick={() => { if (!on && canEdit) toggle(p.key); setActive(p.key); }} sx={{
            position: "relative", display: "flex", alignItems: "center", gap: 1, p: 1, pr: 3.5, borderRadius: "12px", cursor: "pointer", minWidth: 0,
            border: `1px solid ${here ? PINK : HAIRLINE}`, bgcolor: here ? "rgba(194,44,110,.05)" : on ? "#fff" : "rgba(255,255,255,.5)",
            transition: "border-color .15s, background .15s", "&:hover": { borderColor: here ? PINK : "#9fb3c0" },
          }}>
            <Shape k={p.key} on={on} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 650, color: on ? INK : MUTED, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.label}{doc.format === p.key && <Box component="span" sx={{ ml: 0.6, px: 0.6, py: "1px", borderRadius: "6px", bgcolor: "#e6eef2", color: "#274e64", fontSize: "0.64rem", fontWeight: 700, verticalAlign: "1px" }}>MAIN</Box>}
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{sizeLabel(p)}{p.out === "html" ? " · shop" : " · PNG"}</Typography>
            </Box>
            <Tooltip title={on ? (made.length === 1 ? "A banner keeps one size at least" : "Not in this size") : "Make it in this size too"}>
              <Box component="button" type="button" disabled={!canEdit} aria-label={on ? `Remove ${p.label}` : `Add ${p.label}`}
                onClick={(e) => { e.stopPropagation(); toggle(p.key); }} sx={{
                  all: "unset", cursor: canEdit ? "pointer" : "default", position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%",
                  display: "grid", placeItems: "center", bgcolor: on ? "#274e64" : "transparent", border: on ? "none" : "1.5px solid #b9c6d1", color: "#fff",
                }}>
                {on && <CheckIcon sx={{ fontSize: 13 }} />}
              </Box>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}

const OWN_EMPTY: OwnWords = { eyebrow: "", headline: "", line: "", button: "" };

function OwnWordsFor({ doc, set, active, canEdit }: BuildProps) {
  const p = PRESET[active];
  const own = doc.own[active] ?? OWN_EMPTY;
  const base = wordsFor({ ...doc, own: {} }, active);
  const put = (k: keyof OwnWords, v: string) => set((d) => ({ ...d, own: { ...d.own, [active]: { ...(d.own[active] ?? OWN_EMPTY), [k]: v } } }));
  return (
    <Section title={`Words for ${p.label}`} right={canEdit && (
      <Button size="small" onClick={() => set((d) => ({ ...d, format: active, sizes: sizesOf(d).filter((k) => k !== active) }))} sx={{ ...btn, fontSize: "0.76rem", color: MUTED, minWidth: 0, py: 0 }}>Make it the main size</Button>
    )}>
      <Hint sx={{ mb: 1.25 }}>Empty fields use the banner&apos;s words. Give this size shorter ones where they do not fit.</Hint>
      {p.limits.eyebrow > 0 && <Field label="Eyebrow" value={own.eyebrow} onChange={(v) => put("eyebrow", v)} max={p.limits.eyebrow} placeholder={base.eyebrow} disabled={!canEdit} />}
      <Field label="Headline" value={own.headline} onChange={(v) => put("headline", v)} max={p.limits.headline} placeholder={base.headline} disabled={!canEdit} />
      {p.limits.line > 0 && <Field label="Line" value={own.line} onChange={(v) => put("line", v)} max={p.limits.line} multiline rows={2} placeholder={base.line} disabled={!canEdit} />}
      {p.limits.button > 0 && <Field label="Button" value={own.button} onChange={(v) => put("button", v)} max={p.limits.button} placeholder={base.button} disabled={!canEdit} />}
    </Section>
  );
}

function PictureFields({ doc, set, canEdit }: BuildProps) {
  const c = doc.content;
  const anyMotion = sizesOf(doc).some((k) => PRESET[k].motion);
  const many = c.photos.length >= 2;
  const lang = doc.language;
  const setImage = (img: Picture) => set((d) => ({ ...d, content: { ...d.content, image: img } }));
  const problem = pictureProblem(c.image.url);
  return (
    <Section title="Picture" right={anyMotion ? (
      <Choice value={many ? "many" : "one"} onChange={(k) => set((d) => ({
        ...d, content: {
          ...d.content,
          photos: k === "many"
            ? (d.content.photos.length >= 2 ? d.content.photos : SHOP_PHOTOS.slice(0, 3).map((p) => ({ url: p.url, alt: "", label: photoLabel(p, lang) })))
            : [],
        },
      }))} options={[{ key: "one", label: "One" }, { key: "many", label: "Changing" }]} />
    ) : undefined}>
      {many ? (
        <>
          <Hint sx={{ mb: 1 }}>The card shows these in turn, in step with the changing words - in this order. Pick two or more.</Hint>
          <PhotoPicker multi lang={lang} selected={c.photos.map((p) => p.url)} onPick={(p) => canEdit && set((d) => {
            const has = d.content.photos.some((x) => x.url === p.url);
            const photos = has ? d.content.photos.filter((x) => x.url !== p.url) : [...d.content.photos, { url: p.url, alt: "", label: photoLabel(p, lang) }];
            return { ...d, content: { ...d.content, photos: photos.length >= 2 ? photos : d.content.photos } };
          })} />
          <Box sx={{ mt: 1.25, display: "grid", gap: 0.75 }}>
            {c.photos.map((p, i) => (
              <TextField key={p.url} size="small" fullWidth label={`Label ${i + 1}`} value={p.label} disabled={!canEdit} sx={field}
                onChange={(e) => set((d) => ({ ...d, content: { ...d.content, photos: d.content.photos.map((x, k) => (k === i ? { ...x, label: e.target.value.slice(0, 80) } : x)) } }))} />
            ))}
          </Box>
        </>
      ) : (
        <>
          <PhotoPicker lang={lang} selected={[c.image.url]} onPick={(p) => canEdit && setImage({ url: p.url, alt: "", label: photoLabel(p, lang) })} />
          <TextField size="small" fullWidth label="Or the address of a shop picture" value={c.image.url} disabled={!canEdit} sx={{ ...field, mt: 1.5 }}
            placeholder="https://www.apsoparts.com/media/…" onChange={(e) => setImage({ ...c.image, url: e.target.value.trim() })}
            error={!!problem} helperText={problem ?? undefined} />
          <Field label="Label on the photo" value={c.image.label} onChange={(v) => setImage({ ...c.image, label: v })} max={40} placeholder="Empty = no label" disabled={!canEdit} />
          <Box sx={{ display: "flex", gap: 1 }}>
            {c.image.url && <Button size="small" disabled={!canEdit} onClick={() => setImage({ url: "", alt: "", label: "" })} sx={{ ...btn, color: MUTED }}>No picture</Button>}
          </Box>
        </>
      )}
    </Section>
  );
}

export default function BuildPane(props: BuildProps) {
  const { doc, set, active, canEdit } = props;
  const c = doc.content;
  const main = PRESET[doc.format];
  const anyMotion = sizesOf(doc).some((k) => PRESET[k].motion);
  const put = (fn: (c: BannerDoc["content"]) => BannerDoc["content"]) => set((d) => ({ ...d, content: fn(d.content) }));
  return (
    <Box>
      <Section first title="Sizes">
        <Sizes {...props} />
        <Hint sx={{ mt: 1 }}>The shop&apos;s sizes become a paste block for Magento; the others a PNG.</Hint>
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
                ? `Each word ends the headline and changes every 2.6 s while the banner is on screen. Sizes without room show "${`${c.headline} ${c.rotatingWords[0]}`.trim()}".`
                : "Endings for the headline that take turns on the shop - like the newsletter band's technologies."}
            </Hint>
          </Box>
        )}
        <Field label="Line" value={c.line} onChange={(v) => put((x) => ({ ...x, line: v }))} max={main.limits.line || 200} multiline rows={2} placeholder="One sentence of substance" disabled={!canEdit} />
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: 1 }}>
          <Field label="Button" value={c.button.label} onChange={(v) => put((x) => ({ ...x, button: { ...x.button, label: v } }))} max={main.limits.button || 24} placeholder="Shop seals" disabled={!canEdit} />
          <Field label="It goes to" value={c.button.url} onChange={(v) => put((x) => ({ ...x, button: { ...x.button, url: v.trim() } }))} placeholder="black-friday" disabled={!canEdit} />
        </Box>
        <Hint>A shop page (&quot;dichtungstechnik.html&quot;) links to itself in every store view; a full address stays as it is.</Hint>
      </Section>

      {active !== doc.format && sizesOf(doc).includes(active) && <OwnWordsFor {...props} />}

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
        <Hint sx={{ mt: 0.75 }}>The AI writes in it; the photo labels follow when you pick a photo.</Hint>
      </Section>

      <Section title="Notes">
        <Field label="For the team" value={doc.notes} onChange={(v) => set((d) => ({ ...d, notes: v }))} multiline rows={3} disabled={!canEdit} />
      </Section>
    </Box>
  );
}
