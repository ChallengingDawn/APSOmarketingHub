"use client";

// BACK OFFICE DISTRIBUTION - the GQS tab (SARCLA 19.10.2026: "GQS should have its own tab, improved"; then "show also
// closed and the outcome of it, status of GQS, ideally also the ESO associated ticket stage", the team "unclear", the
// rules "and correct"). SARCLA | NEW FOR BACK-OFFICE GQS DISTRIBUTION on its own, top to bottom: the figures; where the
// tickets stand now (open or closed, the GQS status, the task's stage, the linked ESO / TSA ticket - read from HubSpot
// every 6 hours for 14 days); the flow from the approval to the owner; the GQS team as one table; the rules, the
// workflow's beside the hub's corrected ones; the tickets. A bar, a box of the diagram or a line of its key narrows the
// tickets below.

import { Fragment, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import {
  ACCENT, AMBER, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT, TRACK, bodyCell, clip, headCell, hsTicket, type Tint,
} from "@/app/uc/report/ui";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { Answer, PersonRow, Row } from "@/lib/boDistribution/engine";
import { GQS_OPEN_STAGES_LEGACY, STAGE, type Person, type RosterKey } from "@/lib/boDistribution/rules";

import { CHAT_LABEL, Detail, Verdict, count, fixesDiffer, gave, pct, sameOwner, type Data, type PeopleData } from "./shared";
import {
  FlowCard, NOBODY, ROAD, narrowOptions, narrowRows, ownerName, peopleColumn, through, useFlowChoice,
  type FlowColumn, type FlowNode, type Narrow, type Way,
} from "./FlowTab";

const KICK = { fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase" as const, letterSpacing: "0.08em", lineHeight: 1.4 };
const NUM = { fontVariantNumeric: "tabular-nums" as const };

/* ── the GQS road: status, type, rule -> node ── */

const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
/** The code's own test: "DT" and "NEW BUSINESS" in the type, spaces folded. */
const isDt = (t: string) => { const u = t.toUpperCase(); return u.includes("DT") && u.includes("NEW BUSINESS"); };
export function gqsEntry(r: Row) {
  const s = tidy(r.gqsStatus).toLowerCase();
  return s === "automatically approved" ? "g:auto" : s === "approved by line manager" ? "g:lm" : "g:other";
}
/** The rule that picked, from an answer's method ("Sales Agent (company: …)", "DT New Business priority", "Least busy"). */
const ruleOf = (a: Answer | null | undefined) => {
  const m = a?.method ?? "";
  return !a ? "q:none" : /^Sales Agent/.test(m) ? "q:sa" : /^SA Sub/.test(m) ? "q:sub" : /^DT New Business/.test(m) ? "q:dt" : /^Least busy/.test(m) ? "q:least" : "q:other";
};
/** The rule that picked, under the rules as they stood before the hand-over. */
export const gqsRule = (r: Row) => ruleOf(r.legacy);
const RULE_SHORT: Record<string, string> = { "q:sa": "Sales Agent", "q:sub": "SA Sub", "q:dt": "DT New Business", "q:least": "Least busy", "q:other": "other rule", "q:none": "" };

const first = (ps: Person[] | undefined, join = ", ") => (ps ?? []).map((p) => p.name).join(join);
const ids = (ps: Person[] | undefined) => (ps ?? []).map((p) => String(p.id));
const ord = (i: number) => ["1st", "2nd", "3rd"][i] ?? `${i + 1}th`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function gqsColumns(d: Data, types: FlowNode[], owners: FlowNode[]): FlowColumn[] {
  return [
    { title: "Entry", how: "On New for Back-Office (2338266314), every time it enters", nodes: [
      { id: "g:auto", label: "Automatically approved", short: "Auto-approved", color: ROAD.main, text: "No review needed" },
      { id: "g:lm", label: "Approved by line manager", short: "Line manager", color: ROAD.main, text: "Reviewed, then approved" },
      { id: "g:other", label: "Other status", color: ROAD.fallback, text: "Approved by Line Manager is set first" },
    ] },
    { title: "Type", how: "The type of request; only DT - New Business has a rule of its own", nodes: types },
    { title: "Rule", how: "In this order; available = the green dot of HubSpot chat", nodes: [
      { id: "q:sa", label: "Sales Agent", color: ROAD.main, text: "The company's Sales Agent, else the contact's - if available, no limit" },
      { id: "q:sub", label: "SA Sub", color: ROAD.main, text: "When the Sales Agent is away or unknown - if available" },
      { id: "q:dt", label: "DT New Business", color: ROAD.special, text: `${first(d.legacy?.gqsDt, ", then ")} - missing from HubSpot's list counts as available` },
      { id: "q:least", label: "Least busy", color: ROAD.fallback, text: `Fewest open GQS tickets of the available in ${first(d.legacy?.gqsTeam)}` },
      { id: "q:other", label: "Other", color: ROAD.stop, quiet: true },
      { id: "q:none", label: "Not decided", color: ROAD.stop, text: "Could not be read", quiet: true },
    ] },
    { title: "Owner", how: "What the step gave in HubSpot; not settled yet: the copy's pick", nodes: [
      ...owners,
      { id: NOBODY, label: "Nobody yet", color: ROAD.stop, text: "Nobody found, or HubSpot has no owner yet" },
    ] },
  ];
}

const GQS_ROADS = [
  { color: ROAD.main, label: "Usual road" }, { color: ROAD.special, label: "DT New Business" }, { color: ROAD.fallback, label: "Least busy / other" },
  { color: ROAD.person, label: "Person" }, { color: ROAD.stop, label: "No owner" },
];

/* ── where a task stands now (Actual.gqs - undefined on rows read before 19.10.2026, null when the read failed) ── */

type Gqs = NonNullable<NonNullable<Row["actual"]>["gqs"]>;
const nowOf = (r: Row): Gqs | null => r.actual?.gqs ?? null;
type Show = "all" | "open" | "closed" | "unread";
type State = Exclude<Show, "all">;
const stateOf = (r: Row): State => { const g = nowOf(r); return !g ? "unread" : g.closed ? "closed" : "open"; };
const NO_STATUS = "No status", NO_STAGE = "No stage", NO_LINK = "No linked ESO / TSA ticket";
const statusOf = (r: Row) => { const g = nowOf(r); return g ? tidy(g.status) || NO_STATUS : null; };
const stageOf = (r: Row) => { const g = nowOf(r); return g ? tidy(g.stage) || NO_STAGE : null; };
const linkOf = (r: Row) => { const g = nowOf(r); return !g ? null : g.parent ? `${g.parent.pipeline} · ${tidy(g.parent.stage) || "stage unknown"}` : NO_LINK; };
/** Open / closed / not read: the first two categorical slots in their fixed order, "not read" the de-emphasis grey. */
const STATE: Record<State, { label: string; color: string }> = {
  open: { label: "Open", color: SERIES[0] }, closed: { label: "Closed", color: SERIES[1] }, unread: { label: "Not read yet", color: DEEMPHASIS },
};
/** A GQS status in words, tinted by what it says - the word carries the meaning, the tint agrees with it. */
function statusTint(s: string | null | undefined): Tint {
  const t = tidy(s).toLowerCase();
  if (!t) return "slate";
  if (/refus|reject|declin|lost|cancel/.test(t)) return "pink";
  if (/accept|\bwon\b/.test(t)) return "green";
  if (/review|pending|wait/.test(t)) return "amber";
  if (/approv/.test(t)) return "blue";
  return "purple";
}

/** What the tickets table shows: open / closed, a status, a task stage, a linked ticket's stage. */
type NowPick = { show: Show; status: string | null; stage: string | null; link: string | null };
const NO_PICK: NowPick = { show: "all", status: null, stage: null, link: null };
const keep = (r: Row, f: NowPick, skip?: keyof NowPick) =>
  (skip === "show" || f.show === "all" || stateOf(r) === f.show)
  && (skip === "status" || !f.status || statusOf(r) === f.status)
  && (skip === "stage" || !f.stage || stageOf(r) === f.stage)
  && (skip === "link" || !f.link || linkOf(r) === f.link);

function Outcome({ rows, pick, onPick }: { rows: Row[]; pick: NowPick; onPick: (k: keyof NowPick, v: string) => void }) {
  const read = rows.filter((r) => nowOf(r));
  const by: Record<State, number> = { open: 0, closed: 0, unread: 0 };
  for (const r of rows) by[stateOf(r)]++;
  const failed = rows.filter((r) => r.actual && r.actual.gqs === null).length;
  const latest = read.reduce((m, r) => Math.max(m, Date.parse(r.actual?.at ?? "") || 0), 0);
  const lists: { key: "status" | "stage" | "link"; title: string; hint: string; rows: { label: string; value: number }[] }[] = [
    { key: "status", title: "GQS status now", hint: "The task's status of GQS in HubSpot today", rows: count(read, statusOf) },
    { key: "stage", title: "The task's stage now", hint: "Where the GQS task is in its pipeline", rows: count(read, stageOf) },
    { key: "link", title: "The linked ESO / TSA ticket", hint: "The stage of the sales ticket the task belongs to", rows: count(read, linkOf) },
  ];
  const states = (["open", "closed", "unread"] as const);
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<FlagOutlinedIcon />} tint="green" title="Where the GQS tickets stand now"
        note="Open or closed, the GQS status, the task's stage and the linked ESO / TSA ticket - click a bar to see its tickets" />
      {rows.length ? (
        <Box role="img" aria-label={states.map((k) => `${STATE[k].label} ${by[k]}`).join(", ")}
          sx={{ display: "flex", gap: "2px", height: 14, borderRadius: "7px", overflow: "hidden", bgcolor: TRACK }}>
          {states.filter((k) => by[k]).map((k) => (
            <Tooltip key={k} title={`${STATE[k].label}: ${full(by[k])} (${pct(by[k], rows.length)})`}>
              <Box onClick={() => onPick("show", k)} sx={{ flex: `${by[k]} 1 0`, minWidth: 4, bgcolor: STATE[k].color, cursor: "pointer", opacity: pick.show === "all" || pick.show === k ? 1 : 0.35, transition: "opacity 120ms ease" }} />
            </Tooltip>
          ))}
        </Box>
      ) : null}
      <Box sx={{ display: "flex", gap: { xs: 0.5, md: 1.5 }, flexWrap: "wrap", mt: rows.length ? 1 : 0, mx: -1 }}>
        {states.map((k) => {
          const on = pick.show === k;
          return (
            <Box key={k} component="button" type="button" disabled={!by[k] && !on} onClick={() => onPick("show", k)} aria-pressed={on} sx={{
              all: "unset", boxSizing: "border-box", display: "inline-flex", alignItems: "baseline", gap: 0.75, px: 1, py: 0.5, borderRadius: "10px",
              cursor: by[k] || on ? "pointer" : "default", border: `1px solid ${on ? ACCENT : "transparent"}`, bgcolor: on ? "rgba(36,89,209,.07)" : "transparent",
              "&:hover": by[k] ? { bgcolor: on ? "rgba(36,89,209,.1)" : "rgba(21,34,58,.04)" } : {}, "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
            }}>
              <Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: STATE[k].color, alignSelf: "center" }} />
              <Box component="span" sx={{ fontSize: "0.82rem", fontWeight: 600, color: MUTED }}>{STATE[k].label}</Box>
              <Box component="span" sx={{ fontSize: "1.1rem", fontWeight: 700, color: by[k] ? INK : FAINT, ...NUM }}>{full(by[k])}</Box>
              <Box component="span" sx={{ fontSize: "0.76rem", color: FAINT, ...NUM }}>{pct(by[k], rows.length)}</Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 2.5, lg: 3 }, mt: 2, pt: 2.25, borderTop: `1px solid ${HAIRLINE}` }}>
        {lists.map((l) => (
          <Box key={l.key} sx={{ minWidth: 0 }}>
            <Typography sx={KICK}>{l.title}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, mb: 1 }}>{l.hint}</Typography>
            <BarList rows={l.rows} format={full} labelWidth={156} maxLabel={30} onSelect={(label) => onPick(l.key, label)} selectedLabel={pick[l.key]}
              emptyMessage={rows.length ? "Not read yet - the next runs read them." : "No GQS ticket in the last 7 days yet."} />
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, lineHeight: 1.5 }}>
        Read from HubSpot every 6 hours for 14 days{latest ? `, last ${when(new Date(latest).toISOString())}` : ""}.
        {by.unread ? ` Not read yet: ${full(by.unread)} - a task is first read 10 minutes after it enters; older ones get it over the next runs${failed ? `, and ${full(failed)} that could not be read are tried again` : ""}.` : ""}
      </Typography>
    </GlassCard>
  );
}

/* ── the team: one table ── */

type Member = { id: string; name: string; p: PersonRow | null; got: number; copy: number; hub: number };

function Head({ label, tip, align }: { label: string; tip?: string; align?: "right" }) {
  return (
    <TableCell align={align} sx={headCell}>
      {tip ? <Tooltip title={tip}><Box component="span" tabIndex={0} sx={{ borderBottom: `1px dotted ${FAINT}`, cursor: "help" }}>{label}</Box></Tooltip> : label}
    </TableCell>
  );
}
const Count = ({ v, strong }: { v: number; strong?: boolean }) => (
  <Box component="span" sx={{ fontSize: "0.88rem", fontWeight: strong ? 700 : 600, color: v ? INK : FAINT, ...NUM }}>{v ? full(v) : "–"}</Box>
);

const AVAIL_WORDS: Record<string, string> = { chat: "the green chat dot", ooo: "not out of office", both: "the green chat dot and not out of office" };
const KNOWN_STAGE: Record<string, string> = { "6078992599": "Waiting on APSO", [STAGE.gqsWaitingOnApso]: "Open the GQS Task", "3279663337": "a deleted stage (3279663337)" };

function Team({ d, rows }: { d: Data; rows: Row[] }) {
  const [n, setN] = useState(0);
  const held = useHeld<PeopleData>(`/api/uc/bo-distribution?people=1&n=${n}`, [n]);
  const r = held.result;
  const people = r?.state === "ok" ? r.data.people ?? [] : [];
  const byId = new Map(people.map((p) => [String(p.id), p]));
  const hubList = (k: RosterKey) => d.settings.rosters?.[k] ?? d.legacy?.[k];
  const wfTeam = ids(d.legacy?.gqsTeam), wfDt = ids(d.legacy?.gqsDt), hubTeam = ids(hubList("gqsTeam")), hubDt = ids(hubList("gqsDt"));
  const saNames = new Set([...ids(d.legacy?.saToOwnerGqs), ...ids(hubList("saToOwnerGqs"))]);
  const cap = d.settings.hub?.cap ?? null;
  const availability = d.settings.hub?.availability ?? "chat";

  const m = new Map<string, Member>();
  const add = (id: string, name: string | null | undefined) => {
    let x = m.get(id);
    if (!x) { x = { id, name: byId.get(id)?.name ?? name ?? id, p: byId.get(id) ?? null, got: 0, copy: 0, hub: 0 }; m.set(id, x); }
    return x;
  };
  // the team: the workflow's two GQS lists and the hub's (the page's lists)
  for (const p of [...(d.legacy?.gqsTeam ?? []), ...(hubList("gqsTeam") ?? []), ...(d.legacy?.gqsDt ?? []), ...(hubList("gqsDt") ?? [])]) add(String(p.id), p.name);
  const inTeam = new Set(m.keys());
  for (const x of rows) {
    const g = x.actual ? gave(x) : null;
    if (g?.id) add(String(g.id), g.name).got++;
    if (x.legacy?.ownerId) add(String(x.legacy.ownerId), x.legacy.ownerName).copy++;
    if (x.hub?.ownerId) add(String(x.hub.ownerId), x.hub.ownerName).hub++;
  }
  const rank = (o: Member) => { const a = wfTeam.indexOf(o.id), b = hubTeam.indexOf(o.id), c = wfDt.indexOf(o.id); return a >= 0 ? a : b >= 0 ? 20 + b : c >= 0 ? 40 + c : 60; };
  const team = [...m.values()].filter((o) => inTeam.has(o.id)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const others = [...m.values()].filter((o) => !inTeam.has(o.id) && (o.got || o.copy || o.hub)).sort((a, b) => b.got - a.got || b.hub - a.hub || a.name.localeCompare(b.name));
  const waits = rows.filter((x) => x.hub && !x.hub.ownerId).length;

  const lists = (o: Member, member: boolean) => {
    const chips: { t: string; tint: Tint }[] = [];
    const a = wfDt.indexOf(o.id), b = hubDt.indexOf(o.id);
    if (a >= 0 || b >= 0) chips.push(a === b ? { t: `DT New Business ${ord(a)}`, tint: "purple" } : a < 0 ? { t: `DT ${ord(b)} - hub only`, tint: "amber" } : b < 0 ? { t: `DT ${ord(a)} - workflow only`, tint: "amber" } : { t: `DT ${ord(a)}, hub ${ord(b)}`, tint: "amber" });
    const ta = wfTeam.includes(o.id), tb = hubTeam.includes(o.id);
    if (ta || tb) chips.push(ta && tb ? { t: "GQS team", tint: "blue" } : ta ? { t: "GQS team - old list only", tint: "amber" } : { t: "GQS team - hub only", tint: "amber" });
    if (!member && saNames.has(o.id)) chips.push({ t: "Sales Agent name", tint: "slate" });
    return chips.length ? <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{chips.map((c) => <Chip key={c.t} tint={c.tint}>{c.t}</Chip>)}</Box> : <Box component="span" sx={{ color: FAINT }}>–</Box>;
  };
  const status = (o: Member) => {
    if (r === null) return <CircularProgress size={12} sx={{ color: FAINT }} />;
    const p = o.p;
    if (!p) return <Box component="span" sx={{ color: FAINT }}>–</Box>;
    if (p.deactivated) return <Box><Chip tint="pink">deactivated</Chip><Typography sx={{ fontSize: "0.7rem", color: MUTED, mt: 0.4 }}>the hub never picks</Typography></Box>;
    return p.chat === "available" ? <Chip tint="green">available</Chip> : <Chip tint="slate">{p.chat ? (CHAT_LABEL[p.chat] ?? p.chat).toLowerCase() : "no status"}</Chip>;
  };
  const open = (o: Member) => {
    if (r === null) return <CircularProgress size={12} sx={{ color: FAINT }} />;
    const p = o.p;
    if (!p) return <Box component="span" sx={{ color: FAINT }}>–</Box>;
    const right = p.gqsOpenFixed, wf = p.gqsOpen;
    const tip = wf === null
      ? `The old routing's count failed for ${o.name}: its code then read 999, so its least-busy step passed them over. The hub leaves a failed count out instead of guessing.`
      : right === null ? "The count on the right stages failed this time - read again later."
      : `The old routing's least-busy step counted a stage that no longer exists and missed "Waiting on APSO", so it sees ${full(wf)} where ${full(right)} are open${wf < right ? ` - ${full(right - wf)} waiting on APSO are not counted, and ${o.name.split(" ")[0]} looks less busy than they are` : ""}. The hub counts the right stages.`;
    return (
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Box component="span" sx={{ fontSize: "0.95rem", fontWeight: 700, color: right === null ? FAINT : INK, ...NUM }}>{right === null ? "–" : full(right)}</Box>
          {cap && right !== null && right >= cap ? <Chip tint="amber">at the limit of {cap}</Chip> : null}
        </Box>
        {wf !== right && (
          <Tooltip title={tip}>
            <Box component="span" tabIndex={0} sx={{ fontSize: "0.72rem", color: AMBER, borderBottom: `1px dotted ${AMBER}`, cursor: "help", whiteSpace: "nowrap" }}>
              {wf === null ? "the old routing read 999" : `the old routing saw ${full(wf)}`}
            </Box>
          </Tooltip>
        )}
      </Box>
    );
  };
  const line = (o: Member, member: boolean) => {
    const off = !!o.p?.deactivated;
    return (
      <TableRow key={o.id} sx={{ bgcolor: off ? "rgba(253,232,241,.5)" : undefined }}>
        <TableCell sx={{ ...bodyCell, minWidth: 150 }}>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: off ? RED : INK, lineHeight: 1.3, textDecoration: off ? "line-through" : "none" }}>{o.name}</Typography>
        </TableCell>
        <TableCell sx={bodyCell}>{status(o)}</TableCell>
        <TableCell sx={bodyCell}>{open(o)}</TableCell>
        <TableCell align="right" sx={bodyCell}><Count v={o.got} strong /></TableCell>
        <TableCell align="right" sx={bodyCell}><Count v={o.copy} /></TableCell>
        <TableCell align="right" sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
          <Count v={o.hub} strong={o.hub !== o.copy} />
          {o.hub !== o.copy && <Box component="span" sx={{ fontSize: "0.72rem", color: MUTED, ml: 0.5, ...NUM }}>{o.hub > o.copy ? "+" : "−"}{full(Math.abs(o.hub - o.copy))}</Box>}
        </TableCell>
        <TableCell sx={{ ...bodyCell, minWidth: 160 }}>{lists(o, member)}</TableCell>
      </TableRow>
    );
  };
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="green" title="The GQS team"
        note={`Chat status and open GQS tasks now${r?.state === "ok" ? ` (${when(r.data.at)})` : ""}; the tickets of the last 7 days - who got them, and who would`} />
      {r === null && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1.5 }}>
          <CircularProgress size={14} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading everyone&apos;s chat status and open GQS tasks…</Typography>
        </Box>
      )}
      {r !== null && r.state !== "ok" && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.84rem", color: RED }}>Could not read the chat status and open tasks: {r.state === "error" ? r.error : "not configured"}</Typography>
          <Button size="small" onClick={() => setN((x) => x + 1)} sx={{ textTransform: "none" }}>Try again</Button>
        </Box>
      )}
      <Box sx={{ overflowX: "auto", mx: { xs: -1, md: 0 } }}>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead>
            <TableRow>
              <Head label="Person" />
              <Head label="Chat status" tip={`The green dot of HubSpot chat.${availability !== "chat" ? ` The hub reads ${AVAIL_WORDS[availability]} (Settings).` : ""}`} />
              <Head label="Open GQS tasks" tip={`Open now on the right stages - with "Waiting on APSO". Where the old routing counted differently, the line under it says what it saw.`} />
              <Head label="Got · 7 days" align="right" tip="What the person was actually given in the last 7 days" />
              <Head label="Old rules" align="right" tip="The rules as they stood before the hand-over, on the same tickets" />
              <Head label="Hub would give" align="right" tip="The same tickets with the corrected rules (How it decides, at the end of this page); the small figure is the change against the old ones" />
              <Head label="Lists" tip="DT New Business order and the GQS team - the old lists and the ones in use (People tab); amber where they differ" />
            </TableRow>
          </TableHead>
          <TableBody>
            {team.map((o) => line(o, true))}
            {!team.length && (
              <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>Nobody in the GQS lists.</TableCell></TableRow>
            )}
            {!!others.length && (
              <TableRow>
                <TableCell colSpan={7} sx={{ ...bodyCell, pt: 2.25, pb: 0.75 }}>
                  <Typography sx={KICK}>Not in the GQS lists - as Sales Agent, SA Sub or by hand</Typography>
                </TableCell>
              </TableRow>
            )}
            {others.map((o) => line(o, false))}
          </TableBody>
        </Table>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.5, lineHeight: 1.5 }}>
        Hover a column title for what it counts.{waits ? ` With nobody available the hub would leave ${full(waits)} ${waits === 1 ? "ticket" : "tickets"} waiting in New for Back-Office.` : ""}
      </Typography>
    </GlassCard>
  );
}

/* ── the rules now, beside how they stood before the hand-over ── */

type Side = { text: React.ReactNode; n?: number; extra?: string; chips?: string[] };
type Step = { title: string; wf: Side; hub: Side };

function SideBox({ side, kind }: { side: Side; kind: "wf" | "hub" }) {
  const chips = side.chips ?? [];
  const fixed = kind === "hub" && chips.length > 0;
  return (
    <Box sx={{
      minWidth: 0, p: 1.25, borderRadius: "12px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 1.25, alignItems: "start",
      bgcolor: fixed ? "rgba(231,246,238,.65)" : "rgba(21,34,58,.035)", borderLeft: `3px solid ${fixed ? GREEN : "transparent"}`,
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ ...KICK, fontSize: "0.64rem", display: { xs: "block", md: "none" }, color: kind === "hub" ? GREEN : FAINT, mb: 0.25 }}>{kind === "hub" ? "Now" : "Before"}</Typography>
        <Typography component="div" sx={{ fontSize: "0.8rem", color: kind === "hub" && !fixed ? MUTED : INK, lineHeight: 1.5 }}>{side.text}</Typography>
        {!!chips.length && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.75 }}>
            {chips.map((c) => <Chip key={c} tint={kind === "hub" ? "green" : "amber"}>{c}</Chip>)}
          </Box>
        )}
      </Box>
      {side.n !== undefined && (
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: side.n ? INK : FAINT, lineHeight: 1.3, ...NUM }}>{full(side.n)}</Typography>
          {side.extra && <Typography sx={{ fontSize: "0.68rem", color: MUTED, whiteSpace: "nowrap" }}>{side.extra}</Typography>}
        </Box>
      )}
    </Box>
  );
}

function Rules({ d, rows }: { d: Data; rows: Row[] }) {
  const hub = d.settings.hub ?? d.defaults?.hub;
  const live = !!d.settings.live?.gqs;
  const stage = (id: string) => d.stages?.gqs?.find((s) => s.id === id)?.label ?? KNOWN_STAGE[id] ?? id;
  const q = (s: string) => `"${s}"`;
  const hubStages = hub?.gqsStages?.length ? hub.gqsStages : d.defaults?.hub?.gqsStages ?? [];
  const stagesFixed = hubStages.join() !== GQS_OPEN_STAGES_LEGACY.join();
  const hubList = (k: RosterKey) => d.settings.rosters?.[k] ?? d.legacy?.[k];
  const own = (k: RosterKey) => { const v = d.settings.rosters?.[k]; return !!v && ids(v).join() !== ids(d.legacy?.[k]).join(); };
  const avail = AVAIL_WORDS[hub?.availability ?? "chat"];
  const availFix = (hub?.availability ?? "chat") !== "chat" ? [`available = ${avail}`] : [];
  const wait = (hub?.whenNobody ?? "wait") === "wait";
  const cap = hub?.cap ?? null;
  const n = (a: (r: Row) => Answer | null, rule: string) => rows.filter((r) => ruleOf(a(r)) === rule).length;
  const wf = (r: Row) => r.legacy, hb = (r: Row) => r.hub;
  const wfNobody = rows.filter((r) => r.legacy && !r.legacy.ownerId).length;
  const hubWaits = rows.filter((r) => r.hub && !r.hub.ownerId).length;
  const wrote = rows.filter((r) => r.wrote?.ok).length;

  const steps: Step[] = [
    { title: "Enters New for Back-Office",
      wf: { text: <>Every time a task enters the stage. A status other than &quot;Automatically Approved&quot; is set to &quot;Approved by Line Manager&quot;.</>, n: rows.length },
      hub: { text: <>The same tickets, read every minute. {live ? "Live: it sets the status the same way." : "Shadow: it only compares and writes nothing."}</>, n: rows.length } },
    { title: "Sales Agent",
      wf: { text: <>The company&apos;s Sales Agent, else the contact&apos;s - if available (the green chat dot), with no limit. A user missing from HubSpot&apos;s list counts as away.</>, n: n(wf, "q:sa") },
      hub: { text: <>The same{own("saToOwnerGqs") ? ", with the hub's own list of Sales Agent names" : ""}; available = {avail}. A deactivated Sales Agent is skipped.</>, n: n(hb, "q:sa"),
        chips: [...availFix, ...(own("saToOwnerGqs") ? ["own Sales Agent names"] : [])] } },
    { title: "SA Sub",
      wf: { text: "The same, when the Sales Agent is away or unknown.", n: n(wf, "q:sub") },
      hub: { text: <>The same; available = {avail}. A deactivated SA Sub is skipped.</>, n: n(hb, "q:sub"), chips: availFix } },
    { title: "DT - New Business",
      wf: { text: <>Only for this type: {first(d.legacy?.gqsDt, ", then ") || "nobody"} - the first available. Here a user missing from HubSpot&apos;s list counts as available, a deactivated one too.</>, n: n(wf, "q:dt"),
        chips: ["missing = available"] },
      hub: { text: <>{first(hubList("gqsDt"), ", then ") || "Nobody"} - the first available ({avail}). Missing from HubSpot&apos;s list = away; a deactivated person is never picked.</>, n: n(hb, "q:dt"),
        chips: ["missing = away", "deactivated never picked", ...availFix, ...(own("gqsDt") ? ["own order"] : [])] } },
    { title: "Least busy of the GQS team",
      wf: { text: <>{first(d.legacy?.gqsTeam) || "Nobody"}: the fewest open GQS tasks among the available (missing from the list = available). Counts {list(GQS_OPEN_STAGES_LEGACY.map((x) => q(stage(x))))} - and misses {q(stage("6078992599"))}. A failed count reads 999. Nobody available: the least busy of everyone.</>,
        n: n(wf, "q:least"), extra: wfNobody ? `${full(wfNobody)} found nobody` : undefined,
        chips: ["counts a deleted stage", `misses ${stage("6078992599")}`, "failed count = 999", "nobody available → anyone"] },
      hub: { text: <>{first(hubList("gqsTeam")) || "Nobody"}, deactivated people left out: the fewest open GQS tasks among the available ({avail}; missing = away). Counts {list(hubStages.map((x) => q(stage(x))))}. A failed count leaves the person out.{cap ? ` At most ${cap} open tasks a person.` : ""} Nobody available: {wait ? "nobody - the task waits in New for Back-Office (once live, the workflow's safety net still assigns it after 3 minutes)" : "the least busy of everyone, as the workflow"}.</>,
        n: n(hb, "q:least"), extra: hubWaits ? `${full(hubWaits)} would wait` : undefined,
        chips: [...(stagesFixed ? [`counts ${stage("6078992599")}`] : []), "failed count left out", "missing = away", "deactivated left out", ...(cap ? [`limit ${cap}`] : []), ...(wait ? ["waits when nobody is available"] : []), ...(own("gqsTeam") ? ["own team"] : [])] } },
    { title: "Writes",
      wf: { text: <>The owner, stage {q(stage(STAGE.gqsWaitingOnApso))} and the company when the Sales Agent came from a contact; then the owner gets &quot;NEW GQS TASK&quot; in HubSpot.</> },
      hub: live
        ? { text: <>Live: the same - owner, stage, status and company{hub?.note ? ", and a note on the ticket" : ""}. A task with no contact or company first gets them from its linked ticket, as the workflow does; one older than 20 minutes or already owned is left alone.</>, n: wrote, extra: "written" }
        : { text: "Shadow: nothing - live mode for GQS is off (Settings)." } },
  ];
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How it decides"
        note="The rules in their order - the first that finds someone wins. Beside them, how they stood before the hand-over: green where they were corrected" />
      <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "32px minmax(0, 1fr) minmax(0, 1fr)", columnGap: 1.5, mb: 1 }}>
        <span />
        <Typography sx={KICK}>Before the hand-over, until 19.10.2026</Typography>
        <Typography sx={{ ...KICK, color: GREEN }}>The hub - with the fixes</Typography>
      </Box>
      <Box>
        {steps.map((s, i) => (
          <Box key={s.title} sx={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr)", columnGap: 1.5, position: "relative", pb: i < steps.length - 1 ? 2 : 0 }}>
            {i < steps.length - 1 && <Box sx={{ position: "absolute", left: 15, top: 32, bottom: 4, width: "2px", bgcolor: TINT.purple.bg }} />}
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: TINT.purple.bg, color: TINT.purple.fg, fontSize: "0.8rem", fontWeight: 800 }}>{i + 1}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: "32px" }}>{s.title}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 0.75, md: 1.5 }, mt: 0.25 }}>
                <SideBox side={s.wf} kind="wf" />
                <SideBox side={s.hub} kind="hub" />
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 2, lineHeight: 1.5 }}>
        The figures: the last 7 days&apos; {full(rows.length)} tickets - on the left as the rules stood before the hand-over, on the right as they are now. Change the hub&apos;s rules on the Settings and People tabs.
      </Typography>
    </GlassCard>
  );
}

/* ── the tickets ── */

const stop = (e: React.MouseEvent) => e.stopPropagation();

function NowCell({ r }: { r: Row }) {
  const g = nowOf(r);
  if (!g) return (
    <Box>
      <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{r.actual?.gqs === null ? "Could not be read - tried again" : "Not read yet"}</Typography>
      {r.gqsStatus && <Typography sx={{ fontSize: "0.7rem", color: FAINT, ...clip(200) }}>at entry: {r.gqsStatus}</Typography>}
    </Box>
  );
  const st = STATE[g.closed ? "closed" : "open"];
  return (
    <Box sx={{ display: "grid", gap: 0.4, justifyItems: "start", minWidth: 0 }}>
      <Chip tint={statusTint(g.status)}>{tidy(g.status) || NO_STATUS}</Chip>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, maxWidth: 230 }}>
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: st.color, flexShrink: 0 }} />
        <Box component="span" title={tidy(g.stage) || NO_STAGE} sx={{ fontSize: "0.76rem", color: INK, minWidth: 0, ...clip(220) }}>{st.label} · {tidy(g.stage) || NO_STAGE}</Box>
      </Box>
      {g.parent
        ? <Box component="a" href={hsTicket(g.parent.id)} target="_blank" rel="noopener" onClick={stop} title={`${g.parent.pipeline} ticket ${g.parent.id}`}
            sx={{ display: "block", fontSize: "0.74rem", color: MUTED, textDecoration: "none", ...clip(230), "&:hover": { color: ACCENT, textDecoration: "underline" } }}>
            {g.parent.pipeline} · {tidy(g.parent.stage) || "stage unknown"}
          </Box>
        : <Typography sx={{ fontSize: "0.72rem", color: FAINT }}>no linked ESO / TSA ticket</Typography>}
    </Box>
  );
}

function GqsDetail({ r }: { r: Row }) {
  const g = nowOf(r);
  const line = (k: string, v: React.ReactNode) => <Box sx={{ display: "flex", gap: 1, fontSize: "0.8rem", py: 0.25 }}><Box sx={{ color: MUTED, minWidth: 140 }}>{k}</Box><Box sx={{ color: INK, minWidth: 0 }}>{v}</Box></Box>;
  return (
    <Box sx={{ display: "grid", gap: 0.25, mt: 0.75, pt: 0.75, borderTop: `1px dashed ${HAIRLINE}` }}>
      {line("GQS type", tidy(r.gqsType) || "none")}
      {line("Status at entry", tidy(r.gqsStatus) || "none")}
      {r.company && line("Company", `${r.company.name}${r.company.salesPriority ? ` · ${r.company.salesPriority}` : ""}`)}
      {g ? (
        <>
          {line("Task now", `${g.closed ? "closed" : "open"} · ${tidy(g.stage) || NO_STAGE} · ${tidy(g.status) || NO_STATUS}${r.actual?.at ? ` - read ${when(r.actual.at)}` : ""}`)}
          {line("Linked ticket", g.parent
            ? <Box component="a" href={hsTicket(g.parent.id)} target="_blank" rel="noopener" sx={{ color: ACCENT }}>{g.parent.pipeline} {g.parent.id} · {tidy(g.parent.stage) || "stage unknown"}</Box>
            : "none found")}
        </>
      ) : line("Task now", r.actual?.gqs === null ? "could not be read - the next run tries again" : "not read yet")}
      {r.wrote && line("The hub wrote", r.wrote.ok ? `${r.wrote.ownerName ?? "—"} at ${when(r.wrote.at)}` : r.wrote.error ? `failed: ${r.wrote.error}` : `nothing - ${r.wrote.skipped ?? "left to the workflow"}`)}
    </Box>
  );
}

function GqsTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const { slice, pager } = usePaged(rows, 15);
  const small = { fontSize: "0.72rem", color: MUTED, lineHeight: 1.35 };
  return (
    <>
      <Box sx={{ overflowX: "auto", mx: { xs: -1, md: 0 } }}>
        <Table size="small" sx={{ minWidth: 960 }}>
          <TableHead><TableRow>{["Entered", "Ticket", "Distribution gave", "Copy gives", "Hub gives", "Now", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((r) => {
              const g = r.actual ? gave(r) : null;
              const copyRule = RULE_SHORT[ruleOf(r.legacy)], hubRule = RULE_SHORT[ruleOf(r.hub)];
              const sub = [tidy(r.gqsType) || "no type", r.company?.name].filter(Boolean).join(" · ");
              return (
                <Fragment key={r.key}>
                  <TableRow hover onClick={() => setOpen(open === r.key ? null : r.key)} sx={{ cursor: "pointer", verticalAlign: "top" }}>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap", color: MUTED, fontSize: "0.8rem" }}>
                      {when(r.enteredAt)}
                      {r.approx && <Box sx={{ mt: 0.4 }}><Chip tint="slate">replayed</Chip></Box>}
                    </TableCell>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" onClick={stop} sx={{ color: INK, fontWeight: 600, fontSize: "0.84rem", textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(280) }}>{r.subject || r.ticketId}</Box>
                      <Typography title={sub} sx={{ ...small, ...clip(280) }}>{sub}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                      {g ? g.name ?? "nobody" : <Box component="span" sx={{ color: FAINT }}>not settled yet</Box>}
                      {r.actual?.dupsOwnerName && r.actual.dupsOwnerId !== g?.id && <Typography sx={small}>then DUPS → {r.actual.dupsOwnerName}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                      {r.legacy ? r.legacy.ownerName ?? "nobody" : "—"}
                      {copyRule && <Typography sx={small}>{copyRule}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", fontWeight: fixesDiffer(r) ? 700 : 400 }}>
                      {r.hub ? r.hub.ownerName ?? <Box component="span" sx={{ color: AMBER }}>nobody - waits</Box> : "—"}
                      {hubRule && <Typography sx={{ ...small, fontWeight: 400 }}>{hubRule}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, minWidth: 190 }}><NowCell r={r} /></TableCell>
                    <TableCell sx={bodyCell}><Verdict r={r} /></TableCell>
                  </TableRow>
                  {open === r.key && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ ...bodyCell, bgcolor: "rgba(36,89,209,.04)" }}>
                        <Detail r={r} />
                        <GqsDetail r={r} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>No GQS ticket here.</Typography>}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "64px minmax(0, 1fr)" }, columnGap: 1.5, rowGap: 0.5, alignItems: "center" }}>
      <Typography sx={KICK}>{label}</Typography>
      {children}
    </Box>
  );
}

/* ── the tab ── */

const ANY = "~any";

export function GqsTab({ d }: { d: Data }) {
  const rows = d.rows.filter((r) => r.pipeline === "gqs");
  const settled = rows.filter((r) => r.legacy?.ownerId && r.actual);
  const live = settled.filter((r) => !r.approx);
  const same = settled.filter(sameOwner).length;
  const writes = rows.filter((r) => r.wrote);
  const wrote = writes.filter((r) => r.wrote!.ok).length, failed = writes.filter((r) => r.wrote!.error).length, left = writes.filter((r) => r.wrote!.skipped).length;
  const liveOn = !!d.settings.live?.gqs;
  const read = rows.filter((r) => nowOf(r));
  const openRows = read.filter((r) => !nowOf(r)!.closed), closedRows = read.filter((r) => nowOf(r)!.closed);
  const topOpen = count(openRows, stageOf).find((x) => x.label !== NO_STAGE);
  const closedBy = count(closedRows, statusOf).slice(0, 2);

  // the diagram's columns: the types as they come (small ones together), the people who got them
  const typeCounts = count(rows, (r) => tidy(r.gqsType) || null);
  const keepTypes = new Set((typeCounts.length > 7 ? typeCounts.slice(0, 6) : typeCounts).map((x) => x.label));
  const typeId = (r: Row) => { const t = tidy(r.gqsType); return !t ? "t:~none" : keepTypes.has(t) ? `t:${t}` : "t:~others"; };
  const types: FlowNode[] = [
    ...[...keepTypes].map((t) => ({ id: `t:${t}`, label: t, short: t.length > 22 ? `${t.slice(0, 21)}…` : undefined, color: isDt(t) ? ROAD.special : ROAD.main, text: isDt(t) ? `${first(d.legacy?.gqsDt, ", then ")}, when no Sales Agent is available` : undefined })),
    { id: "t:~others", label: "Other types", color: ROAD.main, quiet: true, text: `${typeCounts.length - keepTypes.size} more, each with a few` },
    { id: "t:~none", label: "No type", color: ROAD.fallback, quiet: true },
  ];
  const owners = peopleColumn(rows.map(ownerName).filter((x): x is string => !!x));
  const columns = gqsColumns(d, types, owners.nodes);
  const ways: Way[] = rows.map((r) => ({ row: r, way: [gqsEntry(r), typeId(r), gqsRule(r), owners.id(ownerName(r))] }));
  const { sel, pick, clear } = useFlowChoice(columns.length);
  const [narrow, setNarrow] = useState<Narrow>("all");
  const [now, setNow] = useState<NowPick>(NO_PICK);
  const picked = through(ways, sel).map((w) => w.row);
  const chosen = sel.map((s, c) => columns[c].nodes.find((x) => x.id === s)?.label).filter(Boolean);

  // a bar or a part of the outcome card: choose it (again: take it away) and go to the tickets
  const pickNow = (k: keyof NowPick, v: string) => {
    const on = now[k] === v;
    const next: NowPick = { ...now };
    if (k === "show") next.show = on ? "all" : (v as Show); else next[k] = on ? null : v;
    setNow(next);
    if (!on && typeof document !== "undefined") document.getElementById("gqs-tickets")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // each group of filters counts with the other groups applied
  const forShow = narrowRows(picked.filter((r) => keep(r, now, "show")), narrow);
  const showOptions = (["all", "open", "closed", "unread"] as const).map((k) => ({ key: k, label: k === "all" ? "All" : STATE[k].label, count: k === "all" ? forShow.length : forShow.filter((r) => stateOf(r) === k).length }));
  const forStatus = narrowRows(picked.filter((r) => keep(r, now, "status")), narrow);
  const statuses = count(forStatus, statusOf);
  if (now.status && !statuses.some((x) => x.label === now.status)) statuses.push({ label: now.status, value: 0 });
  const statusOptions = [{ key: ANY, label: "Any", count: forStatus.length }, ...statuses.map((x) => ({ key: x.label, label: x.label, count: x.value }))];
  const nowKept = picked.filter((r) => keep(r, now));
  const shown = narrowRows(nowKept, narrow);
  const also = ([["stage", "Task stage"], ["link", "Linked ticket"]] as const).filter(([k]) => now[k]);

  const kpis = [
    { label: "GQS tickets, 7 days", value: full(rows.length), note: `Entered New for Back-Office${rows.some((r) => r.approx) ? ` - ${full(rows.filter((r) => r.approx).length)} replayed` : ""}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "purple" as const },
    { label: "Still open", value: read.length ? full(openRows.length) : "—", note: read.length ? `${pct(openRows.length, read.length)} of the ${full(read.length)} read${topOpen ? ` - most in ${topOpen.label}` : ""}` : "Not read yet", icon: <PendingActionsOutlinedIcon />, tint: "blue" as const },
    { label: "Closed", value: read.length ? full(closedRows.length) : "—", note: closedBy.length ? closedBy.map((x) => `${x.label} ${full(x.value)}`).join(" · ") : read.length ? "None yet" : "Not read yet", icon: <TaskAltOutlinedIcon />, tint: "green" as const },
    { label: "Owner left as chosen", value: pct(same, settled.length), note: `${full(same)} of ${full(settled.length)} settled${live.length ? `; live ${pct(live.filter(sameOwner).length, live.length)}` : ""}`, icon: <PersonOutlineOutlinedIcon />, tint: "slate" as const },
    { label: "Corrections change the owner", value: full(rows.filter(fixesDiffer).length), note: "Deactivated people, failed counts, the stages counted - where the corrected rules differ from the old routing", icon: <CompareArrowsOutlinedIcon />, tint: "amber" as const },
    ...(liveOn || writes.length ? [{ label: "Written by the hub", value: full(wrote), note: liveOn ? `Live for GQS${left ? ` - ${full(left)} left alone` : ""}${failed ? `, ${full(failed)} failed` : ""}` : "Live mode is off for GQS now", icon: <EditNoteOutlinedIcon />, tint: "pink" as const }] : []),
  ];
  const k = kpis.length;
  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", lg: `repeat(${k > 5 ? 3 : k}, minmax(0, 1fr))`, xl: `repeat(${k}, minmax(0, 1fr))` }, gap: 2 }}>
        {kpis.map((x) => <KpiTile key={x.label} icon={x.icon} tint={x.tint} label={x.label} value={x.value} note={x.note} />)}
      </Box>
      <Outcome rows={rows} pick={now} onPick={pickNow} />
      <FlowCard
        icon={<AltRouteOutlinedIcon />} tint="purple" title="How the GQS tickets were given out"
        note={`The last 7 days: from the approval to the owner - ${full(rows.length)} tickets`}
        columns={columns} ways={ways} sel={sel} onPick={pick} onClear={clear} roads={GQS_ROADS}
      />
      <Team d={d} rows={rows} />
      <Box id="gqs-tickets" sx={{ scrollMarginTop: 16, minWidth: 0 }}>
        <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="GQS tickets"
            note={`${full(shown.length)} of ${full(rows.length)}${chosen.length ? ` - through ${chosen.join(" › ")}` : ""}. A box of the diagram or a bar above narrows them; a row opens its reasons`} />
          <Box sx={{ display: "grid", gap: 1.25, mb: 2 }}>
            <FilterRow label="Now"><Choice<Show> value={now.show} onChange={(v) => setNow({ ...now, show: v })} options={showOptions} /></FilterRow>
            {statuses.length > 0 && (
              <FilterRow label="Status"><Choice<string> value={now.status ?? ANY} onChange={(v) => setNow({ ...now, status: v === ANY ? null : v })} options={statusOptions} /></FilterRow>
            )}
            <FilterRow label="Owner"><Choice<Narrow> value={narrow} onChange={setNarrow} options={narrowOptions(nowKept)} /></FilterRow>
            {!!also.length && (
              <FilterRow label="Also">
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  {also.map(([key, label]) => (
                    <Box key={key} component="button" type="button" onClick={() => setNow({ ...now, [key]: null })} aria-label={`Remove ${label}`} sx={{
                      all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1.25, pr: 0.75, py: 0.5, borderRadius: "999px",
                      border: `1px solid ${ACCENT}`, bgcolor: "rgba(36,89,209,.08)", color: ACCENT, fontSize: "0.8rem", fontWeight: 600,
                      "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
                    }}>
                      {label}: {now[key]}<CloseIcon sx={{ fontSize: 14 }} />
                    </Box>
                  ))}
                </Box>
              </FilterRow>
            )}
          </Box>
          <GqsTable rows={shown} />
        </GlassCard>
      </Box>
      {/* how it works, after what happened - reference, not a figure */}
      <Rules d={d} rows={rows} />
    </>
  );
}
