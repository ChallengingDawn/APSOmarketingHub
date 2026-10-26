"use client";

// PERSONAS - a HubSpot app (UC & HubSpot Apps). Each contact's persona (hs_persona) from its job and its company
// (SARCLA 25.10.2026: "migrate as a new sub-app and reinforce it"; 26.10: no comparison with the old workflow, the
// unclassified ones shown differently, "change it at once"). Reads/writes /api/uc/personas (src/lib/personas).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import { PERSONAS, type PersonaKey } from "@/lib/personas/rules";
import type { Change, RunInfo, Settings, State } from "@/lib/personas/engine";

const API = "/api/uc/personas";
const hsContact = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-1/${id}`;
type Data = { settings: Settings; last: RunInfo | null; state: State | null; workflowOn: boolean | null; writing: boolean; admin: boolean; keys: PersonaKey[] };

const persona = (k: PersonaKey | null) => (k ? PERSONAS[k].name : "none");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : "—");
/** What each Unclassified reason means, in plain words - and its group. */
const MISSING: Record<string, { text: string; group: "nojob" | "job" }> = {
  "no job - company has an industry": { text: "No job title - the company has an industry code", group: "nojob" },
  "no job - company without industry": { text: "No job title - the company has no industry code either", group: "nojob" },
  "no job and no company": { text: "No job title and no company", group: "nojob" },
  "job title matches no persona": { text: "The job title fits no persona (sales, manager, other …)", group: "job" },
  "purchaser in DACH - not a machine builder of 50+ or APSOgrowth": { text: "Purchaser in DACH - company not a machine builder of 50+ people, not APSOgrowth", group: "job" },
  "purchaser outside DACH and Italy": { text: "Purchaser outside DACH and Italy", group: "job" },
  "owner outside DACH": { text: "Owner or managing director outside DACH", group: "job" },
  "owner in DACH - company over 50 people or size unknown": { text: "Owner in DACH - company over 50 people, or its size unknown", group: "job" },
};

/** The cascade in plain words - first match wins (rules.ts). */
function Rules() {
  const steps: [PersonaKey, string][] = [
    ["P8", "the company's industry is 3.1 - 3.3 (resellers, channel)"],
    ["P5", "the company's industry is 4.1 (cut-to-size, toll manufacturing)"],
    ["P6", "the company's industry is 2.x (plants, MRO) - or the contact works in maintenance"],
    ["P7", "the contact is an engineer, technician, designer or project leader"],
    ["P3", "the company is in Italy, or the contact speaks Italian"],
    ["P4", "an owner or managing director of a DACH company of 50 people or fewer"],
    ["P1", "a purchaser at a DACH machine builder (industry 1.1) of 50 people or more"],
    ["P2", "a purchaser at an APSOgrowth customer"],
    ["UN", "none of the above - Unclassified"],
  ];
  return (
    <Box sx={{ display: "grid", gap: 0.25 }}>
      {steps.map(([k, text], i) => (
        <Box key={k} sx={{ display: "grid", gridTemplateColumns: "26px 190px minmax(0,1fr)", gap: 1, py: 0.5, alignItems: "center" }}>
          <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: "#eef3fb", color: "#3767b0", fontSize: "0.76rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{i + 1}</Box>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{PERSONAS[k].name}</Typography>
          <Typography sx={{ fontSize: "0.86rem", color: INK }}>{text}</Typography>
        </Box>
      ))}
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mt: 1 }}>
        First match wins. Job words are matched in German, English, French and Italian, with or without accents. A contact with no job and no company is left as it is. A persona set by hand in HubSpot is never overwritten.
      </Typography>
    </Box>
  );
}

export default function Personas() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [to, setTo] = useState<PersonaKey | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const open = useMemo(() => (d?.state?.changes ?? []).filter((x) => !x.done || !!x.done.error), [d]);
  const rows = open.filter((x) => to === "all" || x.to === to);
  const { slice, pager } = usePaged<Change>(rows, 25);

  const body = (() => {
    if (r === null) return <LoadingPanel label="Reading the personas…" />;
    if (!d) return <UpstreamPanel source="Personas" error={r.state === "error" ? r.error : "not there yet - this page fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
    const s = d.state;
    const mode = d.settings.mode;
    const call = async (what: string, method: "PUT" | "POST", b: unknown) => {
      setBusy(what); setMsg(null);
      try {
        const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
        const j = (await res.json()) as { ok: boolean; error?: string };
        setMsg(j.ok ? (what === "full" ? "Checking every contact - a few minutes." : "Done.") : j.error ?? `HTTP ${res.status}`);
        setN((x) => x + 1);
      } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
    };
    // the counts of every change (the daily check counts them all; only the first rows are listed)
    const byTo = (k: PersonaKey) => s?.changeCounts?.[k] ?? open.filter((x) => x.to === k).length;
    const toChange = s?.changeCounts ? Object.values(s.changeCounts).reduce((a, b) => a + b, 0) : open.length;
    const classified = s ? d.keys.reduce((a, k) => a + (s.rules[k] ?? 0), 0) : 0;
    const un = s?.rules.UN ?? 0;
    const why = s ? Object.entries(s.why).map(([w, c]) => ({ w, c, m: MISSING[w] ?? { text: w, group: "job" as const } })).sort((a, b) => b.c - a.c) : [];
    const goLive = () => {
      if (!window.confirm(`Change the persona of ${full(toChange)} contacts now, and every contact from then on? A persona set by hand in HubSpot is never overwritten; every change is kept with what was there before.`)) return;
      void call("mode", "PUT", { mode: "live" });
    };
    return (
      <>
        {mode !== "live" ? (
          <Info>{mode === "shadow" ? "Paused - the hub works each persona out and shows here what would change, but writes nothing to HubSpot. Switch to Live below." : "Off - nothing is looked at."}</Info>
        ) : !d.writing ? (
          <Info><b>Live - waiting:</b> the HubSpot workflow “SARCLA | PERSONAS SET” is {d.workflowOn ? "still switched on" : "not readable"} - the hub writes nothing while it runs. Switch it off in HubSpot (Automation → Workflows) and the hub goes on within 15 minutes.</Info>
        ) : (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Automatic: every 15 minutes the contacts changed since the last run, and every contact once a day, get the persona of the rules below.</Typography>
        )}

        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<GroupsOutlinedIcon />} tint="blue" title="Personas" note={s ? `Every contact, checked ${when(s.at)} - ${full(classified)} contacts; ${full(s.skipped)} with no job and no company are left out` : "Every contact is checked within minutes of the deploy"} />
          {s && (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Persona", "Who", "Contacts", "Share"].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i >= 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {d.keys.map((k) => {
                    const b = s.rules[k] ?? 0;
                    return (
                      <TableRow key={k}>
                        <TableCell sx={{ ...bodyCell, fontWeight: 600, whiteSpace: "nowrap", color: k === "UN" ? MUTED : INK }}>{PERSONAS[k].name}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{PERSONAS[k].short}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{full(b)}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED }}>{pct(b, classified)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </GlassCard>

        {s && (
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<HelpOutlineIcon />} tint="amber" title={`Unclassified · ${full(un)}`} note="What is missing for these contacts to get a persona - a new rule for a large group gives many of them one" />
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["What is missing", "Contacts", "Share", ""].map((h, i) => <TableCell key={i} sx={{ ...headCell, textAlign: i === 1 || i === 2 ? "right" : "left" }}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {(["nojob", "job"] as const).map((g) => {
                    const items = why.filter((x) => x.m.group === g);
                    if (!items.length) return null;
                    const sum = items.reduce((a, x) => a + x.c, 0);
                    return [
                      <TableRow key={g}>
                        <TableCell sx={{ ...bodyCell, fontWeight: 700, color: INK, bgcolor: "rgba(21,34,58,.03)" }}>{g === "nojob" ? "No job title" : "Job title known - no persona fits"}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", bgcolor: "rgba(21,34,58,.03)" }}>{full(sum)}</TableCell>
                        <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED, bgcolor: "rgba(21,34,58,.03)" }}>{pct(sum, un)}</TableCell>
                        <TableCell sx={{ ...bodyCell, bgcolor: "rgba(21,34,58,.03)" }} />
                      </TableRow>,
                      ...items.map((x) => (
                        <TableRow key={x.w}>
                          <TableCell sx={{ ...bodyCell, pl: 3, fontSize: "0.84rem" }}>{x.m.text}</TableCell>
                          <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(x.c)}</TableCell>
                          <TableCell sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED }}>{pct(x.c, un)}</TableCell>
                          <TableCell sx={{ ...bodyCell, width: { xs: 80, md: 220 } }}>
                            <Box sx={{ height: 8, borderRadius: 4, bgcolor: "#f3e6d3", overflow: "hidden" }}><Box sx={{ height: "100%", width: `${un ? Math.max(1, (x.c / un) * 100) : 0}%`, bgcolor: "#d39a4a" }} /></Box>
                          </TableCell>
                        </TableRow>
                      )),
                    ];
                  })}
                </TableBody>
              </Table>
            </Box>
          </GlassCard>
        )}

        {s && (
          <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
            <CardTitle icon={<SwapHorizIcon />} tint="green" title={`${d.writing ? "Being changed" : "To change"} · ${full(toChange)}`}
              note={`Contacts whose persona in HubSpot is not the rules' one${toChange > open.length ? ` - ${full(open.length)} of them listed here` : ""}`}
              right={d.admin && mode !== "live" && toChange > 0 ? (
                <Button size="small" variant="contained" disableElevation disabled={!!busy} onClick={goLive} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>Change all {full(toChange)} now</Button>
              ) : undefined} />
            <Box sx={{ mb: 1.5 }}>
              <Choice<PersonaKey | "all"> value={to} onChange={setTo} options={[{ key: "all", label: "All", count: toChange }, ...d.keys.filter((k) => byTo(k)).map((k) => ({ key: k, label: `→ ${k === "UN" ? "Unclassified" : k}`, count: byTo(k) }))]} />
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead><TableRow>{["Contact", "Company", "Now", "By the rules", "Why", ""].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {slice.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell sx={bodyCell}>
                        <Box component="a" href={hsContact(x.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(220) }}>{x.name || x.email || x.id}</Box>
                        <Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(220) }}>{x.email || "no e-mail"}</Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: x.company ? INK : FAINT, ...clip(200) }}>{x.company || "—"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED, whiteSpace: "nowrap" }}>{persona(x.from)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>{persona(x.to)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{x.why}</TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{x.done?.error ? <Chip tint="pink">not written</Chip> : <Chip tint={d.writing ? "amber" : "slate"}>{d.writing ? "next run" : "would write"}</Chip>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {pager}
            {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>Nothing to change.</Typography>}
            {open.some((x) => x.done?.error) && <Typography sx={{ fontSize: "0.78rem", color: RED, mt: 1 }}>Some could not be written - they are tried again next run.</Typography>}
          </GlassCard>
        )}

        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<RuleOutlinedIcon />} tint="slate" title="The rules" note="In this order - the first that fits gives the persona" />
          <Rules />
        </GlassCard>

        {d.admin && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Admin:</Typography>
            <Button size="small" variant="text" disabled={!!busy} onClick={() => (mode === "live" ? void call("mode", "PUT", { mode: "shadow" }) : goLive())} sx={{ textTransform: "none" }}>{mode === "live" ? "Pause" : "Switch to Live"}</Button>
            <Button size="small" variant="text" disabled={!!busy || mode === "off"} onClick={() => void call("run", "POST", { action: "run" })} sx={{ textTransform: "none" }}>Run now</Button>
            <Button size="small" variant="text" disabled={!!busy || mode === "off"} onClick={() => void call("full", "POST", { action: "full" })} sx={{ textTransform: "none" }}>Check every contact now</Button>
            {busy && <CircularProgress size={14} />}
            {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
            {d.last && <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>Last run {when(d.last.at)}: {full(d.last.looked)} looked at, {full(d.last.differ)} differ, {full(d.last.written)} written{d.last.kept ? `, ${full(d.last.kept)} kept (set by hand)` : ""}{d.last.error ? ` - ${d.last.error}` : ""}.</Typography>}
          </Box>
        )}
      </>
    );
  })();

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader title="Personas" subtitle="Each contact's persona from its job and its company" />
      {body}
    </Box>
  );
}
