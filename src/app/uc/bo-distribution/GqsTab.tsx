"use client";

// BACK OFFICE DISTRIBUTION - the GQS tab (SARCLA 19.10.2026: "GQS should have its own tab, improved, not channelled on
// the flow"): SARCLA | NEW FOR BACK-OFFICE GQS DISTRIBUTION on its own - the figures, the flow from the approval to
// the owner, the GQS team as the code sees it now, its rules in plain words, and the tickets. A box of the diagram or
// a line of its key narrows the tickets below.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { full } from "@/app/charts/format";
import { AMBER, CardTitle, FAINT, GlassCard, HAIRLINE, INK, KpiTile, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { Chip, Choice, when } from "@/app/connectors/parts";
import type { PersonRow, Row } from "@/lib/boDistribution/engine";
import type { Person } from "@/lib/boDistribution/rules";

import { CHAT_LABEL, TicketTable, count, fixesDiffer, gave, pct, sameOwner, type Data, type PeopleData } from "./shared";
import {
  FlowCard, NOBODY, ROAD, narrowOptions, narrowRows, ownerName, peopleColumn, through, useFlowChoice,
  type FlowColumn, type FlowNode, type Narrow, type Way,
} from "./FlowTab";

/* ── the GQS road: status, type, rule -> node ── */

const tidy = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
/** The code's own test: "DT" and "NEW BUSINESS" in the type, spaces folded. */
const isDt = (t: string) => { const u = t.toUpperCase(); return u.includes("DT") && u.includes("NEW BUSINESS"); };
export function gqsEntry(r: Row) {
  const s = tidy(r.gqsStatus).toLowerCase();
  return s === "automatically approved" ? "g:auto" : s === "approved by line manager" ? "g:lm" : "g:other";
}
/** The rule that picked, from the copy's method ("Sales Agent (company: …)", "DT New Business priority", "Least busy"). */
export function gqsRule(r: Row) {
  const m = r.legacy?.method ?? "";
  return !r.legacy ? "q:none" : /^Sales Agent/.test(m) ? "q:sa" : /^SA Sub/.test(m) ? "q:sub" : /^DT New Business/.test(m) ? "q:dt" : /^Least busy/.test(m) ? "q:least" : "q:other";
}

const first = (ps: Person[] | undefined, join = ", ") => (ps ?? []).map((p) => p.name).join(join);

function gqsColumns(d: Data, types: FlowNode[], owners: FlowNode[]): FlowColumn[] {
  return [
    { title: "Entry", how: "On New for Back-Office (2338266314), every time it enters", nodes: [
      { id: "g:auto", label: "Automatically approved", short: "Auto-approved", color: ROAD.main, text: "No review needed" },
      { id: "g:lm", label: "Approved by line manager", short: "Line manager", color: ROAD.main, text: "Reviewed, then approved" },
      { id: "g:other", label: "Other status", color: ROAD.fallback, text: "The workflow sets Approved by Line Manager first" },
    ] },
    { title: "Type", how: "The type of request; only DT - New Business has a rule of its own", nodes: types },
    { title: "Rule", how: "In this order; available = the green dot of HubSpot chat", nodes: [
      { id: "q:sa", label: "Sales Agent", color: ROAD.main, text: "The company's Sales Agent, else the contact's - if available, no limit" },
      { id: "q:sub", label: "SA Sub", color: ROAD.main, text: "When the Sales Agent is away or unknown - if available" },
      { id: "q:dt", label: "DT New Business", color: ROAD.special, text: `${first(d.legacy.gqsDt, ", then ")} - missing from HubSpot's list counts as available` },
      { id: "q:least", label: "Least busy", color: ROAD.fallback, text: `Fewest open GQS tickets of the available in ${first(d.legacy.gqsTeam)}` },
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

/* ── the team ── */

type Member = { id: string; name: string; p: PersonRow | null; got: number; copy: number };

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.3 }}>{label}</Typography>
      <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{value}</Typography>
      {note && <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{note}</Typography>}
    </Box>
  );
}

function Team({ d, rows }: { d: Data; rows: Row[] }) {
  const [n, setN] = useState(0);
  const held = useHeld<PeopleData>(`/api/uc/bo-distribution?people=1&n=${n}`, [n]);
  const r = held.result;
  const dt = (d.legacy.gqsDt ?? []).map((p) => p.id), team = (d.legacy.gqsTeam ?? []).map((p) => p.id);
  const inGqs = (keys: string[]) => keys.includes("gqsTeam") || keys.includes("gqsDt");
  let body: React.ReactNode;
  if (r === null) body = <Box sx={{ display: "flex", gap: 1, alignItems: "center", py: 2 }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading everyone&apos;s status and open GQS tickets…</Typography></Box>;
  else if (r.state !== "ok") body = (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", py: 1 }}>
      <Typography sx={{ fontSize: "0.84rem", color: RED }}>Could not read the team: {r.state === "error" ? r.error : "not configured"}</Typography>
      <Button size="small" onClick={() => setN((x) => x + 1)} sx={{ textTransform: "none" }}>Try again</Button>
    </Box>
  );
  else {
    const people = r.data.people ?? [];
    const byId = new Map(people.map((p) => [String(p.id), p]));
    const m = new Map<string, Member>();
    const add = (id: string, name: string | null) => {
      if (!m.has(id)) m.set(id, { id, name: byId.get(id)?.name ?? name ?? id, p: byId.get(id) ?? null, got: 0, copy: 0 });
      return m.get(id)!;
    };
    // the team: the workflow's two GQS lists, and anyone the page's lists put in them
    for (const p of [...(d.legacy.gqsTeam ?? []), ...(d.legacy.gqsDt ?? [])]) add(String(p.id), p.name);
    for (const p of people) if (inGqs(p.lists ?? []) || inGqs(p.inWorkflow ?? [])) add(String(p.id), p.name);
    const inTeam = new Set(m.keys());
    for (const x of rows) {
      const g = x.actual ? gave(x) : null;
      if (g?.id) add(String(g.id), g.name).got++;
      if (x.legacy?.ownerId) add(String(x.legacy.ownerId), x.legacy.ownerName).copy++;
    }
    const rank = (o: Member) => { const i = team.indexOf(o.id); return i < 0 ? 100 : i; };
    const members = [...m.values()].filter((o) => inTeam.has(o.id)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    // outside the team: mostly Sales Agents and SA Subs - one line, not a card each
    const others = [...m.values()].filter((o) => !inTeam.has(o.id) && o.got).sort((a, b) => b.got - a.got || a.name.localeCompare(b.name));
    body = (
      <>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
          {members.map((o) => {
            const p = o.p, di = dt.indexOf(o.id);
            const roles: { t: string; tint: "purple" | "blue" | "amber" | "slate" }[] = [];
            if (di >= 0) roles.push({ t: `DT New Business ${di === 0 ? "1st" : di === 1 ? "2nd" : `${di + 1}th`}`, tint: "purple" });
            if (team.includes(o.id)) roles.push({ t: "GQS team", tint: "blue" });
            const keys = ["gqsTeam", "gqsDt"] as const;
            if (p && keys.some((k) => p.lists.includes(k) && !p.inWorkflow.includes(k))) roles.push({ t: "added on the page", tint: "amber" });
            if (p && keys.some((k) => !p.lists.includes(k) && p.inWorkflow.includes(k))) roles.push({ t: "taken out on the page", tint: "amber" });
            const status = p?.deactivated ? <Chip tint="pink">deactivated</Chip> : p?.chat === "available" ? <Chip tint="green">available</Chip> : <Chip tint="slate">{p ? (p.chat ? CHAT_LABEL[p.chat] ?? p.chat : "no status") : "in no list"}</Chip>;
            const off = p && p.gqsOpen !== null && p.gqsOpenFixed !== null && p.gqsOpen !== p.gqsOpenFixed;
            return (
              <Box key={o.id} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "14px", p: 1.5, bgcolor: "rgba(255,255,255,.6)", display: "grid", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: p?.deactivated ? RED : INK, lineHeight: 1.3 }}>{o.name}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>{roles.map((x) => <Chip key={x.t} tint={x.tint}>{x.t}</Chip>)}</Box>
                  </Box>
                  {status}
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, borderTop: `1px solid ${HAIRLINE}`, pt: 1 }}>
                  <Figure label="Open, as counted" value={p ? full(p.gqsOpen) : "—"} />
                  <Figure label="Open, right stages" value={p ? full(p.gqsOpenFixed) : "—"} note={off ? `${(p.gqsOpenFixed ?? 0) > (p.gqsOpen ?? 0) ? "+" : ""}${full((p.gqsOpenFixed ?? 0) - (p.gqsOpen ?? 0))} not counted` : undefined} />
                  <Figure label="Got, 7 days" value={full(o.got)} note={o.copy !== o.got ? `copy gives ${full(o.copy)}` : undefined} />
                </Box>
              </Box>
            );
          })}
        </Box>
        {!members.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nobody in the GQS lists.</Typography>}
        {!!others.length && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.6 }}>Also got GQS tickets - as Sales Agent, SA Sub or by hand</Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>{others.map((o) => <Chip key={o.id} tint="slate">{o.name} · {full(o.got)}</Chip>)}</Box>
          </Box>
        )}
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1.25, lineHeight: 1.45 }}>
          &quot;As counted&quot; is what the least-busy pick uses: it counts the deleted stage 3279663337 and misses 6078992599 &quot;Waiting on APSO&quot;. &quot;Right stages&quot; counts that one instead - read {when(r.data.at)}.
        </Typography>
      </>
    );
  }
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
      <CardTitle icon={<GroupsOutlinedIcon />} tint="green" title="The GQS team" note="The GQS lists: chat status and open GQS tickets now, tickets got in the last 7 days" />
      {body}
    </GlassCard>
  );
}

/* ── the rules ── */

function Rules({ d, rows }: { d: Data; rows: Row[] }) {
  const n = (rule: string) => rows.filter((r) => gqsRule(r) === rule).length;
  const steps: { title: string; text: React.ReactNode; n?: number }[] = [
    { title: "Enters New for Back-Office", text: <>Stage 2338266314, every time it enters. A status other than &quot;Automatically Approved&quot; is set to &quot;Approved by Line Manager&quot;.</>, n: rows.length },
    { title: "Sales Agent", text: "The company's Sales Agent, else the contact's - if available, with no limit. Missing from HubSpot's list counts as away.", n: n("q:sa") },
    { title: "SA Sub", text: "The same, when the Sales Agent is away or unknown.", n: n("q:sub") },
    { title: "DT - New Business", text: `${first(d.legacy.gqsDt, ", then ")}: the first available. Here a user missing from HubSpot's list counts as available.`, n: n("q:dt") },
    { title: "Least busy of the GQS team", text: `${first(d.legacy.gqsTeam)}: fewest open GQS tickets among the available; nobody available - fewest of all; a failed count is 999.`, n: n("q:least") },
    { title: "Writes", text: <>The owner, stage 2338266316 &quot;Open the GQS Task&quot; and the company when the Sales Agent came from a contact; then the owner gets &quot;NEW GQS TASK&quot; in HubSpot.</> },
  ];
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
      <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How it decides" note="Code step #1 of the workflow, in its order - the first rule that finds someone wins" />
      <Box sx={{ display: "grid", gap: 0 }}>
        {steps.map((s, i) => (
          <Box key={s.title} sx={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", columnGap: 1.25, alignItems: "start", position: "relative", pb: i < steps.length - 1 ? 1.5 : 0 }}>
            {i < steps.length - 1 && <Box sx={{ position: "absolute", left: 13, top: 28, bottom: 2, width: "2px", bgcolor: TINT.purple.bg }} />}
            <Box sx={{ width: 28, height: 28, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: TINT.purple.bg, color: TINT.purple.fg, fontSize: "0.78rem", fontWeight: 800 }}>{i + 1}</Box>
            <Box sx={{ minWidth: 0, pt: 0.25 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{s.title}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.45 }}>{s.text}</Typography>
            </Box>
            {s.n !== undefined && <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: s.n ? INK : FAINT, fontVariantNumeric: "tabular-nums", pt: 0.25 }}>{full(s.n)}</Typography>}
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 2, p: 1.25, borderRadius: "12px", borderLeft: `3px solid ${AMBER}`, bgcolor: TINT.amber.bg }}>
        <Typography sx={{ fontSize: "0.78rem", color: INK, lineHeight: 1.45 }}>
          The workload count is off: it counts 2338266316, 4704538856, 2964068584 and the deleted 3279663337, and misses 6078992599 &quot;Waiting on APSO&quot; - someone with replies waiting looks less busy than they are.
        </Typography>
      </Box>
    </GlassCard>
  );
}

/* ── the tab ── */

export function GqsTab({ d }: { d: Data }) {
  const rows = d.rows.filter((r) => r.pipeline === "gqs");
  const settled = rows.filter((r) => r.legacy?.ownerId && r.actual);
  const live = settled.filter((r) => !r.approx);
  const same = settled.filter(sameOwner).length;
  const dt = rows.filter((r) => gqsRule(r) === "q:dt").length;
  const writes = rows.filter((r) => r.wrote);
  const wrote = writes.filter((r) => r.wrote!.ok).length, failed = writes.filter((r) => r.wrote!.error).length, left = writes.filter((r) => r.wrote!.skipped).length;
  const liveOn = !!d.settings.live?.gqs;

  // the diagram's columns: the types as they come (small ones together), the people who got them
  const typeCounts = count(rows, (r) => tidy(r.gqsType) || null);
  const keepTypes = new Set((typeCounts.length > 7 ? typeCounts.slice(0, 6) : typeCounts).map((x) => x.label));
  const typeId = (r: Row) => { const t = tidy(r.gqsType); return !t ? "t:~none" : keepTypes.has(t) ? `t:${t}` : "t:~others"; };
  const types: FlowNode[] = [
    ...[...keepTypes].map((t) => ({ id: `t:${t}`, label: t, short: t.length > 22 ? `${t.slice(0, 21)}…` : undefined, color: isDt(t) ? ROAD.special : ROAD.main, text: isDt(t) ? `${first(d.legacy.gqsDt, ", then ")}, when no Sales Agent is available` : undefined })),
    { id: "t:~others", label: "Other types", color: ROAD.main, quiet: true, text: `${typeCounts.length - keepTypes.size} more, each with a few` },
    { id: "t:~none", label: "No type", color: ROAD.fallback, quiet: true },
  ];
  const owners = peopleColumn(rows.map(ownerName).filter((x): x is string => !!x));
  const columns = gqsColumns(d, types, owners.nodes);
  const ways: Way[] = rows.map((r) => ({ row: r, way: [gqsEntry(r), typeId(r), gqsRule(r), owners.id(ownerName(r))] }));
  const { sel, pick, clear } = useFlowChoice(columns.length);
  const [narrow, setNarrow] = useState<Narrow>("all");
  const picked = through(ways, sel).map((w) => w.row);
  const chosen = sel.map((s, c) => columns[c].nodes.find((x) => x.id === s)?.label).filter(Boolean);

  const kpis = [
    { label: "GQS tickets, 7 days", value: full(rows.length), note: `Entered New for Back-Office${rows.some((r) => r.approx) ? ` - ${full(rows.filter((r) => r.approx).length)} replayed` : ""}`, icon: <ConfirmationNumberOutlinedIcon />, tint: "purple" as const },
    { label: "Same owner as HubSpot", value: pct(same, settled.length), note: `${full(same)} of ${full(settled.length)} settled${live.length ? `; live ${pct(live.filter(sameOwner).length, live.length)}` : ""}`, icon: <PersonOutlineOutlinedIcon />, tint: "green" as const },
    { label: "By DT New Business", value: full(dt), note: `${first(d.legacy.gqsDt, ", then ")}`, icon: <StarOutlineOutlinedIcon />, tint: "blue" as const },
    { label: "Fixes change the owner", value: full(rows.filter(fixesDiffer).length), note: "Deactivated people, failed counts, unknown users", icon: <CompareArrowsOutlinedIcon />, tint: "amber" as const },
    ...(liveOn || writes.length ? [{ label: "Written by the hub", value: full(wrote), note: liveOn ? `Live for GQS - ${full(left)} left to the workflow${failed ? `, ${full(failed)} failed` : ""}` : "Live mode is off for GQS now", icon: <EditNoteOutlinedIcon />, tint: "pink" as const }] : []),
  ];
  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${kpis.length}, minmax(0, 1fr))` }, gap: 2 }}>
        {kpis.map((k) => <KpiTile key={k.label} icon={k.icon} tint={k.tint} label={k.label} value={k.value} note={k.note} />)}
      </Box>
      <FlowCard
        icon={<AltRouteOutlinedIcon />} tint="purple" title="How the GQS tickets were given out"
        note={`SARCLA | NEW FOR BACK-OFFICE GQS DISTRIBUTION, the last 7 days: from the approval to the owner - ${full(rows.length)} tickets`}
        columns={columns} ways={ways} sel={sel} onPick={pick} onClear={clear} roads={GQS_ROADS}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}><Team d={d} rows={rows} /></Grid>
        <Grid size={{ xs: 12, lg: 5 }}><Rules d={d} rows={rows} /></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="GQS tickets"
          note={chosen.length ? `Through ${chosen.join(" › ")} - click a row for the reasons` : "All of them - click a box of the diagram to narrow down, a row for the reasons"}
          right={<Choice<Narrow> value={narrow} onChange={setNarrow} options={narrowOptions(picked)} />} />
        <TicketTable rows={narrowRows(picked, narrow)} empty="No GQS ticket here." />
      </GlassCard>
    </>
  );
}
