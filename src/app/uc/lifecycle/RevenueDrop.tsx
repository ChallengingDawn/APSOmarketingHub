"use client";

// THE UC12 REVENUE DROP TABS - who today's run tickets, and the calendar per person (Diana 30.10.2026: "the predictive
// calendar - how many tickets would be created as of today for each employee"), in two steps: step 1 lost business,
// step 2 revenue drop, both from €10,000 before ("Step 1 fully lost businesses where revenue before was over 10k euro,
// step 2 revenue drop where earlier 12 months 10k euro or more"). Tickets today: four counts from the companies in
// scope to each step, the tickets by owner, every company with the ticket it gets. Calendar: today's first run per
// person, and what each of the 11 monthly runs before it would have added after a first run - the pace to expect
// from here. The step switch shapes both. A company Article erosion has is left to it (Diana 05.11.2026: "only
// trigger UC12 when no erosion on article level is appearing"): counted in the tiles, in no ticket. The floor is
// €10,000 for a Swiss company and €5,000 for any other ("keep the 10k euro for Switzerland but do 5k euro threshold for
// other countries"); the table names each company's. The rules are in
// src/lib/lifecycle/revenueDrop.ts, the read in revenueDropRead.ts. The ticket card shows the ticket as HubSpot gets it,
// with its "Revenue drop" fields, and whether those fields are in HubSpot - an admin creates them there ("yes, you
// should create all the needed properties").

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";
import ApartmentIcon from "@mui/icons-material/Apartment";
import EuroIcon from "@mui/icons-material/Euro";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import HeartBrokenOutlinedIcon from "@mui/icons-material/HeartBrokenOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";

import { CardTitle, GlassCard, INK, KpiTile, MUTED, Notice } from "@/app/uc/report/ui";
import { Choice } from "@/app/connectors/parts";
import { DimChart } from "@/app/reporting/marketing-kpis/DimChart";
import { FullTable, type Col } from "@/app/reporting/eso-benchmark/Figures";
import {
  DROP_LINE, MIN_PREV_CH, MIN_PREV_OTHER, STEP_NAME, draftOf, monthName, spanName, windowOf, type ByStep, type DropData, type DropRow, type PersonRow,
} from "@/lib/lifecycle/revenueDrop";
import { RD_FIELDS, RD_TAG, type FieldPlan } from "@/lib/lifecycle/revenueDropFields";

type State = { computing: boolean; progress: string | null; computedAt: string | null; error: string | null };
type Resp = { ok: boolean; configured?: boolean; missing?: string[]; error?: string; data?: DropData | null; state?: State };

const RED = "#c0392b";
const full = (n: number) => n.toLocaleString("en-US");
const eur = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;
const pct = (x: number | null) => (x == null ? "—" : `${x > 0 ? "+" : ""}${Math.round(x * 100)}%`);
const share = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "—");
/** "€10,000 in Switzerland, €5,000 elsewhere" - each company's floor before. */
const FLOOR_WORDS = `${eur(MIN_PREV_CH)} in Switzerland, ${eur(MIN_PREV_OTHER)} elsewhere`;
const LINE = `${Math.round(DROP_LINE * 100)}%`;

/** Which step the view counts. */
type Sel = "both" | "s1" | "s2";
const of = (b: ByStep, s: Sel) => (s === "s1" ? b[0] : s === "s2" ? b[1] : b[0] + b[1]);
const SEL_WORDS: Record<Sel, string> = { both: "Both steps", s1: `Step 1 · ${STEP_NAME[1]}`, s2: `Step 2 · ${STEP_NAME[2]}` };
const inSel = (step: 1 | 2, s: Sel) => s === "both" || (s === "s1" ? step === 1 : step === 2);
/** In the step and not left to Article erosion: what UC12 tickets. */
const ticketed = (f: DropData["funnel"]): ByStep => [f.found[0] - f.erosion[0], f.found[1] - f.erosion[1]];

function StepChoice({ value, onChange, counts }: { value: Sel; onChange: (s: Sel) => void; counts: ByStep }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Choice value={value} onChange={onChange} options={(["both", "s1", "s2"] as Sel[]).map((k) => ({ key: k, label: SEL_WORDS[k], count: of(counts, k) }))} />
    </Box>
  );
}

/** The read, asked again every 5 seconds while it runs - set into state only when what it says has changed. */
function useDropRead(): Resp | null {
  const [resp, setResp] = useState<Resp | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    const load = () =>
      fetch("/api/uc/lifecycle/revenue-drop", { cache: "no-store" })
        .then(async (r) => {
          const text = await r.text();
          try { return JSON.parse(text) as Resp; } catch { throw new Error(`The hub answered HTTP ${r.status}.`); }
        })
        .then((j) => {
          if (!alive) return;
          const s = j.state;
          const sig = `${j.ok}|${j.error ?? ""}|${j.data?.readAt ?? ""}|${s?.computing}|${s?.progress ?? ""}|${s?.error ?? ""}`;
          if (sig !== last) { last = sig; setResp(j); }
          if (s?.computing) timer = setTimeout(load, 5000);
        })
        .catch((e: unknown) => { if (alive) setResp({ ok: false, error: String((e as Error)?.message ?? e) }); });
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  return resp;
}

function Waiting({ resp }: { resp: Resp | null }) {
  const st = resp?.state;
  const bad = resp && !resp.ok
    ? resp.configured === false ? `HubSpot is not connected on this deployment (${(resp.missing ?? []).join(", ")}).` : `The read failed: ${resp.error ?? "unknown error"}`
    : st?.error ? `HubSpot could not be read: ${st.error}` : null;
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {!bad && <CircularProgress size={18} />}
        <Typography sx={{ fontSize: "0.9rem", color: bad ? RED : MUTED }}>{bad ?? `Reading HubSpot${st?.progress ? ` · ${st.progress}` : ""}…`}</Typography>
      </Box>
    </GlassCard>
  );
}

function Refresh({ state }: { state?: State }) {
  if (state?.computing) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Refreshing in the background - showing the last finished read.</Typography>;
  if (state?.error) return <Typography sx={{ fontSize: "0.8rem", color: RED }}>The last refresh failed ({state.error}) - showing the read before it.</Typography>;
  return null;
}

/** Order intake behind revenue: the window waits for it. */
function Lag({ d }: { d: DropData }) {
  if (!d.end) return <Notice tone="bad">Revenue and order intake are not both loaded for any month - there is no window to compare.</Notice>;
  if (d.revTo && d.oiTo && d.oiTo < d.revTo) {
    return <Notice tone="warn">Order intake per company is loaded to {monthName(d.oiTo)}, revenue to {monthName(d.revTo)}: the 12 months end in {monthName(d.end)} and move on as order intake is loaded.</Notice>;
  }
  return null;
}

function Foot({ d }: { d: DropData }) {
  const when = new Date(d.readAt);
  return (
    <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
      {full(d.read)} companies read from HubSpot (APSOcore or APSOgrowth, Prio 1 or Prio 2) · {full(d.erosionRead.tickets)} article-erosion tickets, on {full(d.erosionRead.companies)} of them · read {when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}, again every 6 hours
    </Typography>
  );
}

const PRIO_WORD = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" } as const;
const STEP_LABEL: Record<string, string> = Object.fromEntries((RD_FIELDS.find((x) => x.name === "revenue_drop_step")?.options ?? []).map((o) => [o.value, o.label]));

/** The ticket's "Revenue drop" fields, label and value, as the ticket's side panel shows them. */
function TicketFields({ props }: { props: Record<string, string | number> }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 220px) minmax(0, 1fr)" }, columnGap: 2, rowGap: 0.5, pt: 1.5, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
      {RD_FIELDS.map((x) => {
        const v = props[x.name];
        const shown = x.name === "revenue_drop_step" ? STEP_LABEL[String(v)] ?? v : typeof v === "number" ? v.toLocaleString("de-CH") : v;
        return [
          <Typography key={`${x.name}-l`} sx={{ fontSize: "0.76rem", lineHeight: "20px", color: MUTED }}>{x.label}</Typography>,
          <Typography key={`${x.name}-v`} sx={{ fontSize: "0.8rem", lineHeight: "20px", color: INK, overflowWrap: "anywhere", mb: { xs: 0.75, sm: 0 } }}>{shown === "" ? "—" : shown}</Typography>,
        ];
      })}
    </Box>
  );
}

type FieldsResp = { ok: boolean; admin?: boolean; plan?: FieldPlan; heldBack?: boolean; error?: string };

/** Are the ticket's fields in HubSpot - and, for an admin, the button that creates what is missing. */
function FieldsInHubspot() {
  const [r, setR] = useState<FieldsResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/uc/lifecycle/revenue-drop/fields", { cache: "no-store" }).then((x) => x.json()).then((j: FieldsResp) => { if (alive) setR(j); })
      .catch((e: unknown) => { if (alive) setR({ ok: false, error: String((e as Error)?.message ?? e) }); });
    return () => { alive = false; };
  }, []);
  const create = () => {
    setBusy(true);
    fetch("/api/uc/lifecycle/revenue-drop/fields", { method: "POST" }).then((x) => x.json()).then((j: FieldsResp) => { setR(j); setHeld(!!j.heldBack); })
      .catch((e: unknown) => setR({ ok: false, error: String((e as Error)?.message ?? e) })).finally(() => setBusy(false));
  };
  if (!r) return <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Checking the ticket fields in HubSpot…</Typography>;
  if (!r.ok || !r.plan) return <Typography sx={{ fontSize: "0.78rem", color: RED }}>The ticket fields could not be checked: {r.error ?? "unknown error"}</Typography>;
  const p = r.plan;
  const missing = [p.group ? "the Revenue drop group" : "", p.create.length ? `${p.create.length} of ${RD_FIELDS.length} fields` : "", p.tag ? `the Tags choice ${RD_TAG.value}` : ""].filter(Boolean);
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, pt: 1.5, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
      <Typography sx={{ fontSize: "0.78rem", lineHeight: "20px", color: p.ok ? MUTED : INK, flex: "1 1 240px" }}>
        {p.ok ? "In HubSpot: the Revenue drop group, its fields and the Tags choice are there."
          : `Not yet in HubSpot: ${missing.join(", ")}.`}
        {p.clash.length ? ` Another type under the same name, left alone: ${p.clash.map((c) => c.name).join(", ")}.` : ""}
        {held ? " This sandbox held the writes back - nothing was created." : ""}
      </Typography>
      {!p.ok && r.admin && <Button size="small" variant="contained" disableElevation onClick={create} disabled={busy} sx={{ textTransform: "none", bgcolor: "#2459d1" }}>{busy ? "Creating…" : "Create in HubSpot"}</Button>}
    </Box>
  );
}

const personOf = (d: DropData, owner: string | null) => (owner ? d.owners[owner] ?? `Owner ${owner}` : "No owner");
const stepWord = (s: 1 | 2) => `${s} · ${STEP_NAME[s]}`;

/* ── Tickets today ─────────────────────────────────────────────────────── */

type CoRow = DropRow & { label: string; person: string };

const CO_COLS: Col<CoRow>[] = [
  { key: "step", head: "Step", tip: `1: nothing in the last 12 months · 2: still buying, ${LINE} or more down`, cell: (r) => stepWord(r.step), sort: (r) => -r.step },
  { key: "person", head: "Owner", tip: "The company owner - the ticket goes to them", cell: (r) => r.person },
  { key: "team", head: "Team", tip: "The owner's roster; on neither roster, no ticket", cell: (r) => r.team ?? "No ticket" },
  { key: "change", head: "Change", tip: "Revenue plus order intake, last 12 months against the 12 before", cell: (r) => <Box component="span" sx={{ color: RED, fontWeight: 700 }}>{pct(r.m.change)}</Box>, sort: (r) => -(r.m.change ?? 0) },
  { key: "last", head: "Last 12 months", tip: "Revenue plus order intake", cell: (r) => eur(r.m.last), sort: (r) => r.m.last },
  { key: "prev", head: "12 months before", tip: "Revenue plus order intake", cell: (r) => eur(r.m.prev), sort: (r) => r.m.prev },
  { key: "lost", head: "Down by", tip: "12 months before minus the last 12 months", cell: (r) => eur(r.m.prev - r.m.last), sort: (r) => r.m.prev - r.m.last },
  { key: "revPrev", head: "Revenue, 12 before", cell: (r) => eur(r.m.revPrev), sort: (r) => r.m.revPrev },
  { key: "oiPrev", head: "Order intake, 12 before", cell: (r) => eur(r.m.oiPrev), sort: (r) => r.m.oiPrev },
  { key: "floor", head: "Floor", tip: FLOOR_WORDS, cell: (r) => eur(r.swiss ? MIN_PREV_CH : MIN_PREV_OTHER), sort: (r) => (r.swiss ? MIN_PREV_CH : MIN_PREV_OTHER) },
  { key: "prio", head: "Priority", cell: (r) => r.prio },
  { key: "segment", head: "Segment", cell: (r) => r.segment },
];

export function Uc12Today() {
  const resp = useDropRead();
  const phone = useMediaQuery("(max-width:599.95px)");
  const d = resp?.data ?? null;
  const [sel, setSel] = useState<Sel>("both");
  const [picked, setPicked] = useState<string | null>(null);

  const all = useMemo<CoRow[]>(() => {
    if (!d) return [];
    const seen = new Set<string>();
    return d.rows.map((r) => {
      const label = seen.has(r.name) ? `${r.name} (${r.id})` : r.name;
      seen.add(r.name);
      return { ...r, label, person: personOf(d, r.owner) };
    });
  }, [d]);
  const rows = useMemo(() => all.filter((r) => inSel(r.step, sel)), [all, sel]);
  const byPerson = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const r of rows) { const x = m.get(r.person) ?? { label: r.person, n: 0 }; x.n++; m.set(r.person, x); }
    return [...m.values()];
  }, [rows]);

  if (!resp?.ok || !d) return <Waiting resp={resp} />;
  const f = d.funnel;
  const t = ticketed(f);
  const w = d.end ? windowOf(d.end) : null;
  const pick = rows.find((r) => r.label === picked) ?? null;
  const draft = pick && w ? draftOf(pick, pick, w) : null;

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <StepChoice value={sel} onChange={setSel} counts={t} />
      <Refresh state={resp.state} />
      <Lag d={d} />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
        <KpiTile icon={<ApartmentIcon />} tint="slate" label="Companies in scope" value={full(f.inScope)} note="APSOcore or APSOgrowth · Prio 1 or Prio 2" />
        <KpiTile icon={<EuroIcon />} tint="blue" label="At their floor before" value={full(f.big)} note={`${FLOOR_WORDS} · ${share(f.big, f.inScope)} of the companies in scope · ${full(f.bought)} bought anything`} />
        <KpiTile icon={<HeartBrokenOutlinedIcon />} tint="pink" label="Step 1 · Lost business" value={full(t[0])} note={`${share(t[0], f.big)} of those · nothing in the last 12 months · ${full(f.erosion[0])} more left to Article erosion · ${full(f.routed[0])} to an ESO or TSA owner`} />
        <KpiTile icon={<TrendingDownIcon />} tint="amber" label="Step 2 · Revenue drop" value={full(t[1])} note={`${share(t[1], f.big)} of those · ${LINE} or more down · ${full(f.erosion[1])} more left to Article erosion · ${full(f.routed[1])} to an ESO or TSA owner`} />
      </Box>

      {w && (
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
          <DimChart key={`owners-${sel}`} title={`Tickets today, by owner · ${SEL_WORDS[sel]}`} rows={byPerson} cur={(r) => r.n} prev={() => 0} curLabel="Companies" prevLabel=""
            fmt={full} single labelWidth={phone ? 110 : 170} />
          <GlassCard>
            <CardTitle icon={<ConfirmationNumberOutlinedIcon />} tint="green" title="The ticket" note={pick ? pick.label : "Pick a company in the table below"} />
            {draft
              ? <Box sx={{ display: "grid", gap: 1.5 }}>
                  <Typography sx={{ fontSize: "0.9rem", lineHeight: "22px", fontWeight: 700, color: INK }}>{draft.subject}</Typography>
                  <Typography sx={{ fontSize: "0.78rem", lineHeight: "20px", color: MUTED }}>To {pick!.person} · {draft.team} pipeline, stage New · priority {PRIO_WORD[draft.priority]} · Tags {RD_TAG.value}</Typography>
                  <Typography component="pre" sx={{ fontFamily: "inherit", fontSize: "0.84rem", lineHeight: "20px", color: INK, whiteSpace: "pre-wrap", overflowWrap: "anywhere", m: 0 }}>{draft.content}</Typography>
                  <TicketFields props={draft.props} />
                </Box>
              : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
                  {pick ? `${pick.person} is on neither the ESO nor the TSA roster: no ticket.` : `Last 12 months ${spanName(w.last)} against ${spanName(w.prev)}, revenue plus order intake.`}
                </Typography>}
            <Box sx={{ mt: 1.5 }}><FieldsInHubspot /></Box>
          </GlassCard>
        </Box>
      )}

      <GlassCard>
        <CardTitle icon={<TrendingDownIcon />} tint="amber" title={`All the companies · ${SEL_WORDS[sel]}`}
          note={w ? `${spanName(w.last)} against ${spanName(w.prev)} · revenue plus order intake · floor ${FLOOR_WORDS}` : undefined} />
        {rows.length
          ? <FullTable key={`companies-${sel}`} first="Company" cols={CO_COLS} rows={rows} initial="lost" find="a company" onPick={setPicked} selected={picked ? [picked] : []} tint="amber" />
          : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No company in scope is in this step.</Typography>}
      </GlassCard>

      <Foot d={d} />
    </Box>
  );
}

/* ── Calendar ──────────────────────────────────────────────────────────── */

type CalRow = PersonRow & { label: string; total?: boolean };

function calCols(ends: string[], sel: Sel): Col<CalRow>[] {
  const today: Col<CalRow>[] = sel === "both"
    ? [
        { key: "s1", head: "Step 1 today", tip: "Lost business in today's first run", cell: (r) => full(r.today[0]), sort: (r) => r.today[0] },
        { key: "s2", head: "Step 2 today", tip: "Revenue drop in today's first run", cell: (r) => full(r.today[1]), sort: (r) => r.today[1] },
        { key: "today", head: "Today's first run", cell: (r) => <b>{full(of(r.today, sel))}</b>, sort: (r) => of(r.today, sel) },
      ]
    : [{ key: "today", head: "Today's first run", cell: (r) => <b>{full(of(r.today, sel))}</b>, sort: (r) => of(r.today, sel) }];
  const erosion: Col<CalRow> = { key: "erosion", head: "Left to Article erosion", tip: "In the step today, with an article-erosion ticket in the last 12 months: no UC12 ticket", cell: (r) => full(of(r.erosion, sel)), sort: (r) => of(r.erosion, sel) };
  return [
    { key: "team", head: "Team", cell: (r) => (r.total ? "" : r.team ?? "No ticket") },
    { key: "inScope", head: "Companies in scope", cell: (r) => full(r.inScope), sort: (r) => r.inScope },
    { key: "big", head: "At their floor before", tip: `Revenue plus order intake in the 12 months before: ${FLOOR_WORDS}`, cell: (r) => full(r.big), sort: (r) => r.big },
    ...today,
    erosion,
    { key: "perMonth", head: "A month after, on average", tip: "What each of the monthly runs below added after a first run", cell: (r) => of(r.perMonth, sel).toFixed(1), sort: (r) => of(r.perMonth, sel) },
    ...ends.map((e, i): Col<CalRow> => ({ key: `m${i}`, head: monthName(e), tip: `The run on the 12 months to ${monthName(e)}: companies new in the step`, cell: (r) => full(of(r.months[i] ?? [0, 0], sel)), sort: (r) => of(r.months[i] ?? [0, 0], sel) })),
  ];
}

export function Uc12Calendar() {
  const resp = useDropRead();
  const phone = useMediaQuery("(max-width:599.95px)");
  const d = resp?.data ?? null;
  const [sel, setSel] = useState<Sel>("both");

  const rows = useMemo<CalRow[]>(() => (d ? d.people.map((p) => ({ ...p, label: personOf(d, p.owner || null) })) : []), [d]);
  const total = useMemo<CalRow | null>(() => {
    if (!d || !rows.length) return null;
    const t: CalRow = { label: "Everyone", total: true, owner: "", team: null, inScope: 0, big: 0, today: [0, 0], erosion: [0, 0], months: d.ends.map((): ByStep => [0, 0]), perMonth: [0, 0] };
    for (const r of rows) {
      t.inScope += r.inScope; t.big += r.big;
      for (const s of [0, 1] as const) { t.today[s] += r.today[s]; t.erosion[s] += r.erosion[s]; t.perMonth[s] += r.perMonth[s]; r.months.forEach((n, i) => (t.months[i][s] += n[s])); }
    }
    return t;
  }, [d, rows]);
  const cols = useMemo(() => calCols(d?.ends ?? [], sel), [d, sel]);

  if (!resp?.ok || !d) return <Waiting resp={resp} />;
  const routed = rows.filter((r) => r.team);
  const top = [...routed].sort((a, b) => of(b.today, sel) - of(a.today, sel))[0] ?? null;
  const avg = d.perRun.length ? d.perRun.reduce((a, r) => a + of(r.tickets, sel), 0) / d.perRun.length : 0;
  const noRoster = rows.filter((r) => !r.team).reduce((a, r) => a + of(r.today, sel), 0);
  const counts = ticketed(d.funnel);

  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <StepChoice value={sel} onChange={setSel} counts={counts} />
      <Refresh state={resp.state} />
      <Lag d={d} />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
        <KpiTile icon={<CalendarMonthOutlinedIcon />} tint="green" label="Today's first run" value={full(of(counts, sel))}
          note={d.end ? `${SEL_WORDS[sel]} · 12 months to ${monthName(d.end)} · ${full(of(d.funnel.erosion, sel))} more left to Article erosion · ${full(of(d.funnel.routed, sel))} to an ESO or TSA owner` : undefined} />
        <KpiTile icon={<EventRepeatOutlinedIcon />} tint="blue" label="Each month after, on average" value={full(Math.round(avg))}
          note={d.perRun.length ? `The ${d.perRun.length} monthly runs to ${monthName(d.perRun[d.perRun.length - 1].end)}, replayed` : "No earlier run to replay"} />
        <KpiTile icon={<PersonOutlineIcon />} tint="purple" label="Most for one person today" value={top ? full(of(top.today, sel)) : "—"} note={top ? top.label : undefined} />
        <KpiTile icon={<BlockOutlinedIcon />} tint="slate" label="Owner on no roster" value={full(noRoster)} note="In the step today, no ticket" />
      </Box>

      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" } }}>
        <DimChart key={`first-${sel}`} title={`Today's first run, by person · ${SEL_WORDS[sel]}`} rows={rows.filter((r) => of(r.today, sel))} cur={(r) => of(r.today, sel)} prev={() => 0}
          curLabel="Tickets" prevLabel="" fmt={full} single labelWidth={phone ? 110 : 170} />
        <DimChart key={`months-${sel}`} title={`Tickets a month after the first run · ${SEL_WORDS[sel]}`} rows={d.perRun.map((r) => ({ label: monthName(r.end), n: of(r.tickets, sel) }))} cur={(r) => r.n} prev={() => 0}
          curLabel="Companies new in the step" prevLabel="" fmt={full} single fixedOrder pageSize={12} labelWidth={phone ? 80 : 100} curColor="#13866a" />
      </Box>

      <GlassCard>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="purple" title={`All the figures, by person · ${SEL_WORDS[sel]}`}
          note="Today's first run, then each month's run as it would have gone after a first run - a company is ticketed once per step in 12 months, unless Article erosion has it" />
        {rows.length
          ? <FullTable key={`people-${sel}`} first="Person" cols={cols} rows={rows} total={total} initial="today" />
          : <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No company in scope.</Typography>}
      </GlassCard>

      <Foot d={d} />
    </Box>
  );
}
