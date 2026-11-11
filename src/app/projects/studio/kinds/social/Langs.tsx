"use client";
// THE POST'S LANGUAGES, EACH A TAB OF ITS OWN (cv16, the Page builder's point 6; SARCLA 11.11.2026: "compare the evolution of
// this page to the other content types and improve them"). In the canvas's bar: the to-do's own language first, then each
// version (model.ts LangVersion); a click opens that language - the canvas, the map, the captions, the checks and the files
// are then that version's, and every AI ask writes in it. "Another language": translated by the AI - EVERY part goes
// along: each network's caption, the first comment, the link's words, the words on every page in every format (one ask,
// the shop's word rules on what comes back) - or copied to write by hand. The link follows the language: each version
// has its own address (Publish), and the checks say when it still points to another language's shop.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import TranslateIcon from "@mui/icons-material/Translate";

import { LANGUAGES, languageLabel } from "@/lib/content/languages";
import { copiedVersion, translatedVersion, type LangItem } from "@/lib/content/studio/kinds/social/model";
import { leftOutLine } from "@/lib/content/studio/kinds/social/ai";
import { useClock } from "../../standard";
import { PINK } from "../../parts";
import { IconBtn, T } from "./look";
import type { StudioCtx } from "./Studio";

export default function LangSwitch({ ctx }: { ctx: StudioCtx }) {
  const codes = Object.keys(ctx.full.langs);
  const main = ctx.mainLang;
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; warn: boolean } | null>(null);
  const clock = useClock(!!busy);
  // the note steps aside by itself after a while (a click closes it at once)
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 15000); return () => clearTimeout(t); }, [note]);
  const others = LANGUAGES.filter((l) => l.code !== main && !codes.includes(l.code));

  const add = async (code: string, how: "translate" | "copy") => {
    setMenu(null); setNote(null);
    const at = new Date().toISOString();
    if (how === "copy") {
      ctx.setFull((d) => ({ ...d, langs: { ...d.langs, [code]: copiedVersion(d, at) } }));
      ctx.goLang(code);
      setNote({ text: `${languageLabel(code)}: the ${languageLabel(main) || "main"} words, to write by hand.`, warn: false });
      return;
    }
    setBusy(code);
    const r = await ctx.api.ai<{ items: LangItem[]; leftOut?: string[] }>("translate", { to: code });
    setBusy(null);
    if (!r.ok) { setNote({ text: r.error, warn: true }); return; }
    let missing = 0;
    ctx.setFull((d) => {
      const t = translatedVersion(d, r.result.items, at);
      missing = t.missing;
      return { ...d, langs: { ...d.langs, [code]: t.version } };
    });
    ctx.goLang(code);
    const left = leftOutLine(r.result.leftOut);
    setNote({
      text: `Translated into ${languageLabel(code)} - every caption and every page's words.${missing ? ` ${missing} part${missing > 1 ? "s" : ""} kept in ${languageLabel(main) || "the main language"}.` : ""}${left ? ` ${left}` : ""} Its link: set its own address in Publish.`,
      warn: !!missing || !!left,
    });
  };
  const drop = (code: string) => {
    setMenu(null);
    if (!window.confirm(`Take the ${languageLabel(code)} version out? Its words go (the version history keeps them).`)) return;
    ctx.goLang(null);
    ctx.setFull((d) => { const langs = { ...d.langs }; delete langs[code]; return { ...d, langs }; });
  };

  const tab = (code: string | null, i: number) => {
    const on = (ctx.lang ?? null) === code;
    const label = code ?? (main || "Main");
    return (
      <Box key={code ?? "main"} component="button" type="button" role="radio" aria-checked={on} title={code ? `${languageLabel(code)} version` : `${languageLabel(main) || "The to-do's language"} - the main one`}
        onClick={() => { if (!on) ctx.goLang(code); }} sx={{
          all: "unset", cursor: on ? "default" : "pointer", px: 1, height: 30, display: "inline-flex", alignItems: "center", fontSize: "0.76rem", fontWeight: 700, letterSpacing: ".02em",
          borderLeft: i ? `1px solid ${T.line2}` : "none", color: on ? "#fff" : T.ink, bgcolor: on ? T.ink : "transparent",
          "&:hover": on ? {} : { bgcolor: T.hover }, "&:focus-visible": { outline: `2px solid ${T.focus}`, outlineOffset: -2 },
        }}>{label}</Box>
    );
  };

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      {codes.length > 0 && (
        <Box role="radiogroup" aria-label="The post's languages" sx={{ display: "inline-flex", flexShrink: 0, border: `1px solid ${T.line2}`, borderRadius: "6px", overflow: "hidden", bgcolor: "#fff" }}>
          {[null, ...codes].map((c, i) => tab(c, i))}
        </Box>
      )}
      <IconBtn title={codes.length ? "Another language, or this one again" : "The post in another language"} onClick={(e) => setMenu(e.currentTarget)} active={!!menu} disabled={!ctx.canEdit || !!busy}><TranslateIcon /></IconBtn>
      {busy && <Typography role="status" sx={{ fontSize: "0.78rem", fontWeight: 700, color: PINK, whiteSpace: "nowrap" }}>Translating into {languageLabel(busy)}… <Box component="span" sx={{ color: T.ink3, fontVariantNumeric: "tabular-nums" }}>{clock}</Box></Typography>}
      {/* what the translation did: a small note under the bar (the bar has no room), closed by a click */}
      {!busy && note && (
        <Box role="status" onClick={() => setNote(null)} sx={{ position: "absolute", top: "calc(100% + 8px)", left: 12, zIndex: 7, maxWidth: 420, p: 1, pr: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${T.line}`, boxShadow: T.shadow, cursor: "pointer" }}>
          <Typography sx={{ fontSize: "0.78rem", color: note.warn ? "#a96a12" : "#1b7a55", lineHeight: 1.4 }}>{note.text}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: T.ink3, mt: 0.25 }}>Close</Typography>
        </Box>
      )}
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { width: 330, borderRadius: "12px", mt: 0.5, boxShadow: T.shadow } } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.25, fontSize: "0.72rem", fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em" }}>Another language</Typography>
        <Typography sx={{ px: 2, pb: 0.75, fontSize: "0.76rem", color: T.ink3, lineHeight: 1.4 }}>Every caption, the first comment, the link's words and every page's words go along - a tab of its own.</Typography>
        {others.map((l) => (
          <Box key={l.code} sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 2, py: 0.6, "&:hover": { bgcolor: T.sunken } }}>
            <Typography sx={{ flex: 1, fontSize: "0.86rem", fontWeight: 600, color: T.ink }}>{l.label} <Box component="span" sx={{ color: T.ink3, fontWeight: 500 }}>{l.code}</Box></Typography>
            <Box component="button" type="button" disabled={!ctx.api.data.ai} onClick={() => void add(l.code, "translate")} sx={{ all: "unset", cursor: "pointer", fontSize: "0.76rem", fontWeight: 700, color: PINK, px: 0.75, py: 0.3, borderRadius: "5px", "&:hover": { bgcolor: "rgba(194,44,110,.07)" }, "&:disabled": { color: T.ink3, cursor: "default" } }}>Translate with AI</Box>
            <Box component="button" type="button" onClick={() => void add(l.code, "copy")} sx={{ all: "unset", cursor: "pointer", fontSize: "0.76rem", fontWeight: 600, color: T.ink2, px: 0.75, py: 0.3, borderRadius: "5px", "&:hover": { bgcolor: T.hover } }}>Copy</Box>
          </Box>
        ))}
        {ctx.lang && <Divider sx={{ my: 0.5 }} />}
        {ctx.lang && ctx.api.data.ai && (
          <MenuItem onClick={() => { const l = ctx.lang!; if (window.confirm(`Translate ${languageLabel(l)} from ${languageLabel(main) || "the main language"} again? What was changed in ${languageLabel(l)} goes (the version history keeps it).`)) void add(l, "translate"); }} sx={{ fontSize: "0.86rem" }}>
            Translate {languageLabel(ctx.lang)} again from {languageLabel(main) || "the main language"}
          </MenuItem>
        )}
        {ctx.lang && <MenuItem onClick={() => drop(ctx.lang!)} sx={{ fontSize: "0.86rem", color: "#b42318" }}>Take the {languageLabel(ctx.lang)} version out</MenuItem>}
      </Menu>
    </Box>
  );
}
