"use client";
// THE NEWSLETTER'S LAST STEP AS A PUBLISHING VIEW (cv16, 11.11.2026). The Page builder's last step (../page/Publish.tsx):
// the assistant folds away, sections, one "Update all" with its progress, a refusal in plain words with "Try again" for
// the ones that failed, links to what was published. Here what goes out is ONE HUBSPOT DRAFT PER LANGUAGE - never an
// e-mail sent: a person checks each draft and schedules it in HubSpot.
//   E-mails    a row per language: its subject, its draft (none yet / up to date / changed since - with Open in HubSpot),
//              what to look at before it goes out, Make the draft (again), its HTML (copy, download); on top "Make the
//              drafts" - every language with none or changed since - with "Making the FR draft in HubSpot · 2 of 3…"
//   Links      every language's links, where they lead and whether the page is on the shop in its store view
//   Pictures   the pictures kept in the hub, which a draft puts into HubSpot's files (named from what they show)
// Drafts to HubSpot stay behind the admin's switch, as before.
// cv17 (11.11.2026, "continue"): a language's draft made before is UPDATED in place (the same e-mail in HubSpot) while it
// still is a draft there - "Update the draft"; sent, scheduled or deleted in HubSpot, a new one is made and its row says
// why. A translated language's draft is made from the campaign's own e-mail in that language when HubSpot has it.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { hubPictures } from "@/lib/content/studio/kinds/newsletter/model";
import { draftProgress, draftRows, linksByLanguage, makeAllOf, retryLangs, versionIn, withVersion, type DraftRow } from "@/lib/content/studio/kinds/newsletter/langs";
import { PINK, btn, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { toolBtn } from "../blog/ui";
import { StateLine, type PageLinks } from "./PagePick";

type Push = { on: boolean; byEnv: boolean; admin: boolean };
type Made = { done: boolean; why?: string; url?: string; emailId?: string; note?: string; sig?: string; at?: string; made?: "updated" | "new" };
type Section = "emails" | "links" | "pictures";

const when = (iso: string | null) => {
  if (!iso) return "";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(t);
};

function stateOf(r: DraftRow): { tone: "ok" | "warn" | "none"; line: string } {
  if (r.state === "same") return { tone: "ok", line: `Draft in HubSpot${r.at ? ` · ${when(r.at)}` : ""}` };
  if (r.state === "changed") return { tone: "warn", line: `Changed since its draft${r.at ? ` of ${when(r.at)}` : ""} - update it` };
  return { tone: "none", line: "Not in HubSpot yet" };
}

export function Send({ api, pages, push, onPush, open, onOpen }: {
  api: StudioApi; pages: PageLinks; push: Push | null; onPush: (p: Push) => void;
  /** the language open in the e-mail; a row's name opens its own */
  open: string; onOpen: (lang: string) => void;
}) {
  const canEdit = api.data.access.canEdit;
  const [section, setSection] = useState<Section>("emails");
  const [run, setRun] = useState<{ langs: string[]; i: number; lang: string } | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [asking, setAsking] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { load } = pages;
  // the Page builder's pages, to say which links are not on the shop yet
  useEffect(() => { load(); }, [load]);
  const rows = useMemo(() => draftRows(api.doc, pages.rows), [api.doc, pages.rows]);
  const all = makeAllOf(rows);
  const on = !!push?.on && canEdit;
  const p = api.data.piece;

  const html = async (lang: string) => { const r = await api.act<{ html: string }>("html", { lang }); return r.ok ? r.result.html : null; };
  /** Make the drafts of these languages, one after the other; each result said under its row. */
  const make = async (langs: string[]) => {
    setNote(null);
    const out: { lang: string; ok: boolean; updated?: boolean }[] = [];
    for (let i = 0; i < langs.length; i++) {
      const lang = langs[i];
      setRun({ langs, i, lang });
      const r = await api.act<Made>("hubspot", { confirm: true, lang });
      const ok = r.ok && r.result.done;
      out.push({ lang, ok, updated: r.ok && r.result.made === "updated" });
      if (ok && r.ok) {
        const m = r.result;
        api.setDoc((cur: unknown) => { const v = versionIn(cur, lang); return withVersion(cur, lang, { ...v, hubspot: { emailId: m.emailId, url: m.url, state: "draft", at: m.at ?? new Date().toISOString(), sig: m.sig } }); });
        setResults((x) => ({ ...x, [lang]: { ok: true, text: m.note ?? "The draft is in HubSpot." } }));
      } else {
        setResults((x) => ({ ...x, [lang]: { ok: false, text: r.ok ? r.result.why ?? "HubSpot made no draft." : r.error } }));
      }
    }
    setRun(null);
    const failed = retryLangs(out);
    const updated = out.filter((x) => x.ok && x.updated).length;
    const fresh = out.filter((x) => x.ok && !x.updated).length;
    const done = [fresh ? `${fresh} made` : "", updated ? `${updated} updated` : ""].filter(Boolean).join(", ");
    setNote(failed.length ? `${done || "None made"} - ${failed.join(", ")} refused (said under ${failed.length === 1 ? "it" : "each"}).` : `${out.length === 1 ? `The draft is ${updated ? "updated" : ""}`.trim() : `${out.length} drafts are`} in HubSpot${out.length > 1 ? ` (${done})` : ""} - nothing is sent: a person checks ${out.length === 1 ? "it" : "each"} and schedules it there.`);
  };
  const failed = Object.entries(results).filter(([, r]) => !r.ok).map(([l]) => l);
  // the confirmation: which are made, which updated (a draft made before is updated in place - cv17)
  const asked = (() => {
    const ls = asking ?? [];
    const update = ls.filter((l) => !!rows.find((x) => x.lang === l)?.emailId).length;
    const verb = update === ls.length ? "Update" : update ? "Make or update" : "Make";
    return {
      update,
      title: ls.length > 1 ? `${verb} ${ls.length} drafts in HubSpot?` : `${verb} the ${ls[0] ?? ""} draft in HubSpot?`,
      go: ls.length > 1 ? `${verb} the drafts` : `${verb} the draft`,
    };
  })();

  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      {/* the switch (an admin's), as before */}
      {push && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.8rem", color: MUTED }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: push.on ? "#1b7a55" : "#9aa5b8" }} />
          <Box component="span" sx={{ flex: 1 }}>{push.on ? "Drafts go to HubSpot - a person schedules them there. Nothing is ever sent from here." : "Drafts to HubSpot are off - the HTML of each language is here to copy."}</Box>
          {push.admin && !push.byEnv && (
            <Button size="small" sx={{ ...toolBtn, height: 26 }}
              onClick={async () => { const r = await api.act<{ ok: boolean; on?: boolean; why?: string }>("pushSwitch", { on: !push.on }); if (r.ok && r.result.ok) onPush({ ...push, on: !!r.result.on }); else setNote(r.ok ? r.result.why ?? null : r.error); }}>
              {push.on ? "Switch off" : "Switch on"}
            </Button>
          )}
        </Box>
      )}
      {/* one button for every draft that is missing or out of date */}
      <Box>
        <Button fullWidth variant="contained" disableElevation startIcon={run ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <SendOutlinedIcon />} disabled={!on || !!run || !all.langs.length}
          onClick={() => setAsking(all.langs)} sx={{ ...mainBtn, minHeight: 38, height: "auto", py: 0.6, whiteSpace: "normal", lineHeight: 1.25 }}>
          {run ? draftProgress(run.lang, run.i + 1, run.langs.length) : all.label}
        </Button>
        {run && <LinearProgress variant="determinate" value={((run.i + 0.5) / run.langs.length) * 100} sx={{ mt: 0.5, height: 3, borderRadius: 2, bgcolor: "rgba(194,44,110,.12)", "& .MuiLinearProgress-bar": { bgcolor: PINK } }} />}
        {!run && all.why && <StateLine tone="warn" line={all.why} />}
        {!push?.on && push && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5 }}>{push.admin ? "Switch drafts on above to make them." : "An admin switches drafts to HubSpot on."}</Typography>}
      </Box>
      {note && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Typography sx={{ flex: 1, fontSize: "0.8rem", color: failed.length ? "#8f1d1b" : "#1b7a55", lineHeight: 1.4 }}>{note}</Typography>
          {failed.length > 0 && !run && on && (
            <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 15 }} />} onClick={() => void make(failed)} sx={{ ...toolBtn, height: 28, flexShrink: 0 }}>Try again{failed.length < rows.length ? ` (${failed.join(", ")})` : ""}</Button>
          )}
        </Box>
      )}

      <SquareChoice value={section} onChange={(v: Section) => setSection(v)} options={[{ key: "emails", label: `E-mails · ${rows.length}` }, { key: "links", label: "Links" }, { key: "pictures", label: "Pictures" }]} />

      {section === "emails" && rows.map((r) => {
        const st = stateOf(r);
        const res = results[r.lang];
        const busy = run?.lang === r.lang;
        return (
          <Box key={r.lang} data-lang-row={r.lang} sx={{ p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${r.lang === open ? "rgba(194,44,110,.35)" : HAIRLINE}` }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Box component="button" type="button" onClick={() => onOpen(r.lang)} title="Open this e-mail" sx={{ all: "unset", cursor: "pointer", fontSize: "0.8rem", fontWeight: 800, color: r.lang === open ? PINK : INK, letterSpacing: ".02em", "&:hover": { textDecoration: "underline" } }}>{r.lang}</Box>
              <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.86rem", fontWeight: 650, color: r.subject ? INK : "#b26a00", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.subject || "No subject yet"}</Typography>
              {busy && <CircularProgress size={13} sx={{ color: PINK }} />}
            </Box>
            <StateLine tone={st.tone} line={st.line} />
            {res && <StateLine tone={res.ok ? "ok" : "bad"} line={res.ok ? res.text : `Refused: ${res.text}`} />}
            {r.blocked && <StateLine tone="bad" line={r.blocked} />}
            {r.issues.filter((x) => x.text !== r.blocked).length > 0 && (
              <Box component="details" sx={{ mt: 0.5, "& summary": { cursor: "pointer", fontSize: "0.76rem", color: "#7f4f0b", fontWeight: 600 } }}>
                <summary>{r.issues.filter((x) => x.text !== r.blocked).length} to look at before it goes out</summary>
                {r.issues.filter((x) => x.text !== r.blocked).map((x, i) => <StateLine key={i} tone={x.tone} line={x.text} />)}
              </Box>
            )}
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
              {on && <Button size="small" disabled={!!run || !!r.blocked} onClick={() => setAsking([r.lang])} startIcon={res && !res.ok ? <RefreshIcon sx={{ fontSize: 15 }} /> : <SendOutlinedIcon sx={{ fontSize: 15 }} />} sx={{ ...toolBtn, height: 28, color: res && !res.ok ? "#8f1d1b" : INK }}>
                {res && !res.ok ? "Try again" : r.state === "none" ? "Make the draft" : "Update the draft"}
              </Button>}
              {r.url && <Button size="small" href={r.url} target="_blank" rel="noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={{ ...toolBtn, height: 28 }}>Open in HubSpot</Button>}
              <Button size="small" startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ ...toolBtn, height: 28 }}
                onClick={async () => { const h = await html(r.lang); if (h) { await navigator.clipboard.writeText(h).catch(() => undefined); setResults((x) => ({ ...x })); setNote(`The ${r.lang} HTML is copied.`); } }}>HTML</Button>
              <Button size="small" startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />} sx={{ ...toolBtn, height: 28 }} aria-label={`Download the ${r.lang} e-mail`}
                onClick={async () => {
                  const h = await html(r.lang);
                  if (!h) return;
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([h], { type: "text/html" }));
                  a.download = `${(r.subject || p.title).replace(/[^\w-]+/g, "-").slice(0, 56) || "newsletter"}-${r.lang}.html`;
                  a.click();
                }}>Download</Button>
            </Box>
          </Box>
        );
      })}

      {section === "links" && linksByLanguage(api.doc, pages.rows).map((g) => (
        <Box key={g.lang} sx={{ p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{g.lang} <Box component="span" sx={{ fontWeight: 500, color: MUTED }}>· its pages in {g.store}</Box></Typography>
          {!g.links.length && <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 0.5 }}>No link yet.</Typography>}
          {g.links.map((l, i) => (
            <Box key={i} sx={{ mt: 0.75 }}>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{l.where}</Typography>
              <Typography component="a" href={l.url} target="_blank" rel="noreferrer" sx={{ display: "block", fontSize: "0.76rem", color: "#2459d1", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", wordBreak: "break-all", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{l.url.replace(/^https?:\/\//, "")}</Typography>
              {l.line ? <StateLine tone={l.tone ?? "warn"} line={l.line} mt={0.25} /> : null}
            </Box>
          ))}
        </Box>
      ))}
      {section === "links" && pages.loading && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Reading the Page builder&apos;s pages…</Typography>}

      {section === "pictures" && rows.map((r) => {
        const v = versionIn(api.doc, r.lang);
        const hub = hubPictures(v);
        const pics = v.blocks.flatMap((b) => (b.kind === "products" ? b.items.filter((x) => x.imageUrl).map((x) => ({ url: x.imageUrl, alt: x.name })) : "imageUrl" in b && b.imageUrl ? [{ url: b.imageUrl, alt: b.imageAlt }] : []));
        return (
          <Box key={r.lang} sx={{ p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: INK }}>{r.lang} <Box component="span" sx={{ fontWeight: 500, color: MUTED }}>· {pics.length} picture{pics.length === 1 ? "" : "s"}{hub.length ? ` · ${hub.length} kept in the hub - the draft puts ${hub.length === 1 ? "it" : "them"} into HubSpot's files, named from what ${hub.length === 1 ? "it shows" : "they show"}` : ""}</Box></Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 0.75, mt: 0.75 }}>
              {pics.map((x, i) => (
                <Box key={i} title={x.alt || "No words for it yet"}>
                  <Box component="img" src={x.url} alt={x.alt} sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: "4px", border: `1px solid ${HAIRLINE}`, display: "block" }} />
                  <Typography sx={{ fontSize: "0.7rem", color: x.alt ? MUTED : "#b26a00", lineHeight: 1.3, mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.alt || "No words - inboxes that block pictures show nothing"}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}

      <Dialog open={!!asking} onClose={() => setAsking(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>{asked.title}</DialogTitle>
        <DialogContent>
          {asking?.map((l) => { const r = rows.find((x) => x.lang === l); return <Typography key={l} sx={{ fontSize: "0.86rem", color: INK }}><b>{l}</b> · “{r?.subject || p.title}”{r?.emailId ? " - its draft is updated, the same e-mail in HubSpot" : " - a new draft"}</Typography>; })}
          {asked.update > 0 && <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 1 }}>What was changed on {asked.update === 1 ? "that draft" : "those drafts"} in HubSpot is replaced by this e-mail. Sent, scheduled or deleted there: a new one is made, said why.</Typography>}
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 1 }}>Nothing is sent to anybody: a person checks each draft and schedules it in HubSpot.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAsking(null)} sx={btn}>Cancel</Button>
          <Button variant="contained" disableElevation sx={mainBtn} onClick={() => { const l = asking ?? []; setAsking(null); void make(l); }}>{asked.go}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
