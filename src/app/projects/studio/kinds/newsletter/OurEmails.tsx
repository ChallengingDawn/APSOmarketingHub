"use client";
// OUR E-MAILS (SARCLA 08.11.2026: "look at the latest we sent, but we should be able to select more and bring more
// different options"). The e-mails we sent from HubSpot, newest first, one card per campaign across its languages, each
// language with its figures; the one picked shows as it went out (its public web version). From here:
//   Start from it        its subject, preheader, stories, pictures and buttons become this newsletter's (Undo brings back)
//   Write like these     several picked: the assistant writes in their voice and knows how they did
// Read-only - nothing is written to HubSpot.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import type { StudioApi } from "../../useStudio";
import { field, mainBtn } from "../../parts";

type Variant = { id: string; language: string; subject: string; date: string; sent: number; openRate: number | null; clickRate: number | null; webUrl: string | null };
type Group = { key: string; label: string; kind: "campaign" | "survey" | "other"; date: string; variants: Variant[] };
export type Learned = { from: string; picked?: boolean; newsletters?: { subject: string; date: string; opens: string; clicks: string; words?: string }[]; why?: string };

const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "8px", whiteSpace: "nowrap" as const };
const pct = (n: number | null) => (n === null ? "-" : `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`);
const day = (iso: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export function OurEmails({ api, open, onClose, onStart, onLearn, language }: {
  api: StudioApi; open: boolean; onClose: () => void; language: string;
  /** "Start from it": the server's blocks for that e-mail, laid over the newsletter by the studio (with Undo). */
  onStart: (r: { subject: string; preheader: string; language: string; blocks: unknown[]; startedFrom: { emailId: string; subject: string; language: string; date: string } }) => void;
  /** "Write like these": what the assistant now knows of them. */
  onLearn: (learned: Learned, picked: { emailId: string; subject: string }[]) => void;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [kind, setKind] = useState<"campaign" | "all">("campaign");
  const [lang, setLang] = useState<string>(() => language.toUpperCase());
  const [q, setQ] = useState("");
  const [showing, setShowing] = useState<Variant | null>(null);
  const [picked, setPicked] = useState<Variant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || groups) return;
    void api.act<{ ok: boolean; groups: Group[]; why?: string }>("ourEmails").then((r) => {
      if (!r.ok) { setWhy(r.error); setGroups([]); return; }
      setGroups(r.result.groups);
      if (!r.result.ok) setWhy(r.result.why ?? "HubSpot did not answer.");
      // the latest we sent, in the newsletter's language, shows first
      const first = r.result.groups.find((g) => g.kind === "campaign") ?? r.result.groups[0];
      const v = first?.variants.find((x) => x.language === language.toUpperCase()) ?? first?.variants[0];
      if (v) setShowing(v);
    });
  }, [open, groups, api, language]);

  const langs = useMemo(() => [...new Set((groups ?? []).flatMap((g) => g.variants.map((v) => v.language)).filter(Boolean))], [groups]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (groups ?? [])
      .filter((g) => kind === "all" || g.kind === "campaign")
      .filter((g) => lang === "ALL" || g.variants.some((v) => v.language === lang))
      .filter((g) => !words || g.variants.some((v) => v.subject.toLowerCase().includes(words)));
  }, [groups, kind, lang, q]);
  const isPicked = (v: Variant) => picked.some((x) => x.id === v.id);
  const toggle = (v: Variant) => setPicked((p) => (isPicked(v) ? p.filter((x) => x.id !== v.id) : [...p, v].slice(-4)));

  const start = async () => {
    if (!showing) return;
    setBusy("start");
    const r = await api.act<{ ok: boolean; why?: string; subject: string; preheader: string; language: string; blocks: unknown[]; startedFrom: { emailId: string; subject: string; language: string; date: string } }>("fromEmail", { emailId: showing.id });
    setBusy(null);
    if (!r.ok) return setWhy(r.error);
    if (!r.result.ok) return setWhy(r.result.why ?? "Not read.");
    onStart(r.result);
    onClose();
  };
  const learn = async () => {
    if (!picked.length) return;
    setBusy("learn");
    const r = await api.act<Learned>("learn", { emailIds: picked.map((v) => v.id) });
    setBusy(null);
    if (!r.ok) return setWhy(r.error);
    onLearn(r.result, picked.map((v) => ({ emailId: v.id, subject: v.subject })));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" slotProps={{ paper: { sx: { borderRadius: "14px", height: "88vh", overflow: "hidden" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2.5, py: 1.5, borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: INK }}>Our e-mails</Typography>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>What we sent from HubSpot, newest first - start from one, or pick up to four for the assistant to write like</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(360px, 440px) minmax(0, 1fr)" }, minHeight: 0, minWidth: 0, flex: 1, overflow: "hidden" }}>
        {/* the list */}
        <Box sx={{ borderRight: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
          <Box sx={{ p: 1.5, display: "grid", gap: 1, borderBottom: `1px solid ${HAIRLINE}` }}>
            <TextField size="small" placeholder="Search the subjects" value={q} onChange={(e) => setQ(e.target.value)} sx={field} />
            <SquareChoice value={kind} onChange={setKind} options={[{ key: "campaign", label: "Newsletters & features" }, { key: "all", label: "Every e-mail" }]} />
            <SquareChoice label="Language" value={lang} onChange={setLang} options={[{ key: "ALL", label: "All" }, ...langs.map((l) => ({ key: l, label: l }))]} />
          </Box>
          <Box sx={{ overflowY: "auto", overflowX: "hidden", flex: 1, p: 1.25, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1, alignContent: "start" }}>
            {!groups && <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, p: 2 }}><CircularProgress size={16} /> Reading HubSpot…</Box>}
            {groups && shown.length === 0 && <Typography sx={{ fontSize: "0.85rem", color: MUTED, p: 1.5 }}>{why ?? "No e-mail matches."}</Typography>}
            {shown.map((g) => (
              <Box key={g.key} sx={{ minWidth: 0, p: 1.25, borderRadius: "10px", border: `1px solid ${g.variants.some((v) => v.id === showing?.id) ? "#2459d1" : HAIRLINE}`, bgcolor: "#fff" }}>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{day(g.date)}{g.kind !== "campaign" ? ` · ${g.kind === "survey" ? "survey" : "service e-mail"}` : ""}</Typography>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK, lineHeight: 1.3, mb: 0.75 }}>{g.label}</Typography>
                <Box sx={{ display: "grid", gap: 0.4 }}>
                  {g.variants.filter((v) => lang === "ALL" || v.language === lang || g.variants.length === 1).map((v) => (
                    <Box key={v.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.5, py: 0.25, borderRadius: "6px", bgcolor: showing?.id === v.id ? "rgba(36,89,209,.07)" : "transparent" }}>
                      <Checkbox size="small" checked={isPicked(v)} onChange={() => toggle(v)} sx={{ p: 0.25 }} inputProps={{ "aria-label": `Pick ${v.language} ${v.subject}` }} />
                      <Box component="button" type="button" onClick={() => setShowing(v)} sx={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
                        <Box component="span" sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#2459d1", width: 22 }}>{v.language}</Box>
                        <Box component="span" sx={{ fontSize: "0.8rem", color: INK, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.subject}</Box>
                        <Tooltip title={v.openRate === null ? `${v.sent.toLocaleString("en")} sent - opens not tracked for this one` : `${v.sent.toLocaleString("en")} sent · ${pct(v.openRate)} opened · ${pct(v.clickRate)} clicked`}>
                          <Box component="span" sx={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {v.sent >= 1000 ? `${(v.sent / 1000).toFixed(1)}k` : v.sent} · {pct(v.openRate)} · {pct(v.clickRate)}
                          </Box>
                        </Tooltip>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
        {/* the one picked, as it went out */}
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, bgcolor: "#eef1f6" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, bgcolor: "#fff" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{showing?.subject ?? "Pick an e-mail"}</Typography>
              {showing && <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{showing.language} · {day(showing.date)} · {showing.sent.toLocaleString("en")} sent{showing.openRate !== null ? ` · ${pct(showing.openRate)} opened · ${pct(showing.clickRate)} clicked` : " · opens not tracked"}</Typography>}
            </Box>
            {showing?.webUrl && <Tooltip title="Open it as it went out"><IconButton size="small" component="a" href={showing.webUrl} target="_blank" rel="noreferrer"><OpenInNewIcon fontSize="small" /></IconButton></Tooltip>}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, p: 2, display: "flex", justifyContent: "center" }}>
            {showing?.webUrl
              ? <Box component="iframe" key={showing.id} src={showing.webUrl} title={showing.subject} sandbox="allow-same-origin" sx={{ width: "100%", maxWidth: 720, height: "100%", border: 0, borderRadius: "8px", bgcolor: "#fff", boxShadow: "0 10px 30px rgba(31,45,78,.12)" }} />
              : <Typography sx={{ color: MUTED, alignSelf: "center", fontSize: "0.88rem" }}>{showing ? "This e-mail has no web version to show." : ""}</Typography>}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, bgcolor: "#fff", flexWrap: "wrap" }}>
            {why && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", flex: "1 1 100%" }}>{why}</Typography>}
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, flex: 1 }}>
              {picked.length ? `${picked.length} picked: ${picked.map((v) => `${v.language} “${v.subject.slice(0, 32)}${v.subject.length > 32 ? "…" : ""}”`).join(", ")}` : "Tick up to four for the assistant to write like."}
            </Typography>
            <Button variant="outlined" disabled={!picked.length || !!busy} onClick={learn} sx={{ ...btn, color: INK, borderColor: HAIRLINE }}>
              {busy === "learn" ? "Reading them…" : `Write like ${picked.length > 1 ? "these" : "this one"}`}
            </Button>
            <Button variant="contained" disableElevation disabled={!showing || !!busy} onClick={start} sx={mainBtn}>
              {busy === "start" ? "Reading it…" : "Start from this one"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
