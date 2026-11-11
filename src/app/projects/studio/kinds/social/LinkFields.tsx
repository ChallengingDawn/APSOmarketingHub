"use client";
// THE POST'S LINK IN PUBLISH (cv17, SARCLA 11.11.2026: "continue" - a language version's link follows its language). Its
// address and the words before it; in a language's tab, when the address is still a page of the shop in another language,
// "Find this page in French" beside it: the server finds the same page in the version's language the Page builder's way
// (social server "counterpart" -> page/shop.ts relinkOf, from the shop's own hreflang links) and puts it in - or says the
// shop has none, and the version keeps its address. Nothing is guessed, nothing is written to the shop.

import { useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";

import { languageLabel } from "@/lib/content/languages";
import { linkPath, linkToFind } from "@/lib/content/studio/kinds/social/model";
import { Btn, T } from "./look";

export type FindLink = (url: string, lang: string) => Promise<{ ok: true; url: string | null; error?: string } | { ok: false; error: string }>;

export default function LinkFields({ url, label, lang, canEdit, onUrl, onLabel, find, startNote = null }: {
  url: string; label: string;
  /** the language tab open (a version), null in the main language */
  lang: string | null;
  canEdit: boolean;
  onUrl: (url: string) => void;
  onLabel: (label: string) => void;
  /** the server's lookup; its answer is put in by the caller (onUrl) when it is still the address searched from */
  find: FindLink;
  /** a note to show from the start (the static harness) */
  startNote?: { text: string; tone: "ok" | "warn" } | null;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" } | null>(startNote);
  const from = lang ? linkToFind(url, lang) : null;
  const name = lang ? languageLabel(lang) || lang : "";

  const go = async () => {
    if (!lang || busy) return;
    const asked = url;
    setBusy(true); setNote(null);
    const r = await find(asked, lang);
    setBusy(false);
    if (!r.ok) { setNote({ tone: "warn", text: `The shop could not be read just now (${r.error}) - try again in a moment.` }); return; }
    if (r.url) { onUrl(r.url); setNote({ tone: "ok", text: `Found: the ${name} page is ${linkPath(r.url)}.` }); return; }
    setNote({ tone: "warn", text: r.error ? `${r.error} The address stays as it is.` : `The shop has no ${name} page for this address - it stays as it is; type the ${name} address if there is one.` });
  };

  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1.4fr) minmax(0, 1fr)" }, gap: 1 }}>
        <TextField size="small" label={lang ? `Address · ${lang}` : "Address"} value={url} disabled={!canEdit} onChange={(e) => { setNote(null); onUrl(e.target.value.trim()); }} placeholder="https://www.apsoparts.com/…" />
        <TextField size="small" label="Words before it" value={label} disabled={!canEdit} onChange={(e) => onLabel(e.target.value)} placeholder="Sizes in the shop:" />
      </Box>
      {lang && (from || busy) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
          <Btn onClick={() => void go()} disabled={!canEdit || busy} icon={busy ? <CircularProgress size={13} /> : <TravelExploreIcon sx={{ color: T.accent }} />} sx={{ height: 30, fontSize: "0.8rem" }}>
            {busy ? `Looking for the ${name} page…` : `Find this page in ${name}`}
          </Btn>
          {!busy && !note && from && <Typography sx={{ fontSize: "0.76rem", color: T.ink3, lineHeight: 1.4, flex: "1 1 180px" }}>It goes to the {from} shop now - the shop&apos;s own links name its {name} page.</Typography>}
        </Box>
      )}
      {note && <Typography role="status" sx={{ mt: 0.75, fontSize: "0.78rem", lineHeight: 1.4, color: note.tone === "ok" ? "#1b7a55" : "#a96a12" }}>{note.text}</Typography>}
    </Box>
  );
}
