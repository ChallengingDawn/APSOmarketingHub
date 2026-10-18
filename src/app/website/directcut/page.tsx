"use client";

// DIRECTCUT — the hub's page on the cut-to-size tool (SARCLA, 16.10.2026: "only migrate what is possible,
// don't break anything; it's also more the dashboard at this point").
//
// This is a READ-ONLY MIRROR of the Railway dashboard's cut-to-size pages. The tool itself cannot move here:
// the shop's anonymous customers have to reach it and this hub answers only on the A+P network, and the
// middleware is single-instance by design — its ledger lives in RAM and two copies would promise the same
// plate twice. The reasons are written out in src/lib/directcut/gateway.ts.
//
// So: nothing on this page reserves, cancels or moves a stage. Acting on a line stays in the dashboard until
// this page has been watched for a while. In the UC apps' kit, like DirectUP, 3D files and DoC.

import { useCallback, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { AMBER, CardTitle, FAINT, GREEN, GlassCard, INK, KpiTile, MUTED, Notice, RED } from "@/app/uc/report/ui";
import { Bars } from "@/app/website/directup/shared";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import KanbanTab from "./KanbanTab";
import ShelfTab from "./ShelfTab";
import ShortagesTab from "./ShortagesTab";
import RegistryTab from "./RegistryTab";
import LeftoversTab from "./LeftoversTab";
import type { Leftovers, SentLog } from "@/lib/directcut/leftovers";
import type { BrokenWithTickets, Holds, Registry } from "./shared";
import { WORK_LABEL, post, when, workOf, type Board, type Line, type Status } from "./shared";

type View = "overview" | "kanban" | "leftovers" | "shortages" | "shelf" | "numbers" | "status";
const VIEW_HASH: Record<View, string> = {
  overview: "#overview", kanban: "#kanban", leftovers: "#leftovers", shortages: "#shortages", shelf: "#shelf", numbers: "#numbers", status: "#status",
};

type BoardPayload = { board: Board; setting: { url: string; by: string | null; at: string | null; fromDefault: boolean }; isAdmin: boolean };

const countWork = (open: Line[]) => {
  const n = { saw: 0, pick: 0, unknown: 0 };
  for (const l of open) n[workOf(l)]++;
  return n;
};

/* ── what needs doing, shown on every tab ─────────────────────────────────── */

function Problems({ s, bro }: { s: Status | null; bro: { broken: BrokenWithTickets } | null }) {
  if (!s) return null;
  const out: React.ReactNode[] = [];

  if (s.feed.down) out.push(<>The machine feed is <b>down</b>{s.feed.downReason ? <> — {s.feed.downReason}</> : null}. The widget is not being served stock.</>);
  else if (s.feed.frozen) out.push(<>The machine feed is <b>frozen</b>{s.feed.frozenReason ? <> — {s.feed.frozenReason}</> : null}.</>);

  const shelfStale = !!s.shelf?.stale;
  if (shelfStale) out.push(<>
    The shelf is <b>too old to promise from</b> — {String(s.shelf?.reason ?? "the File Agent has stopped writing")}.
    Every cut is being answered as production, so no stock is being promised.
  </>);

  /* A SHORTAGE THAT HAS A TICKET IS NOT AN ALERT (SARCLA, 17.10.2026: "this alert we can take out,
     ticket has been raised"). The Back Office has it; repeating it at the top of every tab only teaches
     people to ignore the banner. So this counts the orders with NO ticket, from the same data the
     Shortages tab reads, instead of the middleware's count of what is broken - which cannot know whether
     anybody has been told. */
  const untick = (bro?.broken.orders ?? []).filter((o) => !o.orderNo || !(bro?.broken.ticketed ?? {})[o.orderNo]);
  const broken = untick.length;
  if (broken > 0) out.push(<>
    <b>{full(untick.reduce((n, o) => n + o.pieces, 0))} piece(s)</b> on {broken} order(s) cannot be cut from the
    shelf as it stands and have no Back Office ticket yet
    {untick.some((o) => o.erpNo || o.orderNo)
      ? <> — {untick.map((o) => o.erpNo || o.orderNo).filter(Boolean).join(", ")}</> : null}.
  </>);

  /* THE HEARTBEAT IS NOT WARNED ABOUT ANY MORE (SARCLA, 17.10.2026: "we are not going to install
     heartbeat, it's working from homag agent"). It was never required — the File Agent autostarts with
     Windows and the shelf is dated from its own write stamps. A banner asking for a thing nobody intends
     to install is noise, and noise on this page buries the one line that matters. What it bought is said
     plainly on the Status tab instead, where somebody looking for it will find it. */

  if (!out.length) return null;
  return <>{out.map((n, i) => <Notice key={i} tone={i === 0 && (s.feed.down || shelfStale || broken > 0) ? "bad" : "warn"}>{n}</Notice>)}</>;
}

/* ── overview ─────────────────────────────────────────────────────────────── */

function Overview({ b, s }: { b: Board; s: Status | null }) {
  const work = countWork(b.open);
  const inCart = b.open.filter((l) => l.stage === "reserved").length;
  const offered = b.stock.reduce((a, x) => a + x.offered, 0);
  /* FROM THE PIPELINE VIEW, NOT FROM HEALTH (SARCLA: "A-numbers resolved 0"). health.erpRefs describes
     the SWEEPER — runs, asked, written — and has no coverage figure in it at all, so reading `known` off
     it gave 0 while 1094 of 1095 lines actually carried an A-number. The view counts the lines. */
  /* open work by WHEN it was promised — late, today, this week, later, undated. A board tells you what
     there is; this tells you how much of it is already behind. */
  /* how many open lines are already past the day their customer was promised - the one figure on this
     tab somebody would act on today */
  const late = b.open.filter((l) => l.date && String(l.date).slice(0, 10) < new Date().toISOString().slice(0, 10)).length;
  const due = (() => {
    const t = new Date().toISOString().slice(0, 10);
    const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const fmt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
    const n = { late: 0, today: 0, week: 0, later: 0, none: 0 };
    for (const l of b.open) {
      const d = l.date ? String(l.date).slice(0, 10) : null;
      if (!d) n.none++;
      else if (d < t) n.late++;
      else if (d === t) n.today++;
      else if (d <= week) n.week++;
      else n.later++;
    }
    /* SARCLA, 18.10.2026: "don't understand this graph". Fair — "Past its day / Today / Within a week"
       are only meaningful if you already know the bars count OPEN LINES against the day the customer was
       promised. Each label now says what the bar is and what it means, and the note says what to do with
       the top one. A chart nobody can read is worse than the number it replaced. */
    return [
      { label: "Late", n: n.late, note: "the promised day has already passed", colour: RED },
      { label: "Due today", n: n.today, note: fmt(t), colour: AMBER },
      { label: "Due this week", n: n.week, note: `up to ${fmt(week)}` },
      { label: "Due later", n: n.later, note: `after ${fmt(week)}` },
      { label: "No promised day", n: n.none, note: "nothing was quoted", colour: FAINT },
    ];
  })();

  const refs = b.erpRefs;
  const pctRefs = refs.withOrderNo ? Math.round((100 * refs.known) / refs.withOrderNo) : null;

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<HandymanOutlinedIcon fontSize="small" />} tint="blue" label="Still to cut"
            value={full(b.counts["to-cut"] ?? 0)} note="lines waiting at the saw" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<ContentCutOutlinedIcon fontSize="small" />} tint="slate" label={WORK_LABEL.saw}
            value={full(work.saw)} note={`of ${full(b.open.length)} open · ${full(work.pick)} leftover`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<DoneAllOutlinedIcon fontSize="small" />} tint="green" label="Cut done"
            value={full(b.doneTotal)} note="finished lines in the ledger" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<Inventory2OutlinedIcon fontSize="small" />} tint="purple" label="Plates on offer"
            value={full(offered)} note={`across ${full(b.stock.length)} article(s) with work`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<ShoppingCartOutlinedIcon fontSize="small" />} tint="amber" label="In a cart now"
            value={full(inCart)} note="live 30-minute windows" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<PrecisionManufacturingOutlinedIcon fontSize="small" />} tint="blue" label="Board types on the feed"
            value={s ? full(s.feed.boardTypes) : "—"} note={s?.feed.inventoryChangedAt ? `shelf last moved ${when(s.feed.inventoryChangedAt)}` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<FactCheckOutlinedIcon fontSize="small" />} tint="green" label="Lines with their A-number"
            value={pctRefs === null ? "—" : `${pctRefs}%`} note={refs.withOrderNo ? `${full(refs.known)} of ${full(refs.withOrderNo)}` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile icon={<MonitorHeartOutlinedIcon fontSize="small" />} tint={s?.shelf?.stale ? "amber" : "green"} label="Shelf age"
            value={s?.shelf?.writtenAt ? `${Number(s.shelf.workingDaysSince) || 0} d` : "—"}
            note={s?.shelf?.writtenAt ? `agent last wrote ${when(String(s.shelf.writtenAt))}` : "not dated yet"} />
        </Grid>
      </Grid>

      {/* THE "WHERE THIS COMES FROM" CARD IS GONE (SARCLA, 17.10.2026: "go out completely"). It explained
          why the tool stays on Railway and why this page is read-only — true, and worth knowing once, but
          it is not information about the work and it took the bottom half of the first screen every time.
          It lives in the commit history and in src/lib/directcut/gateway.ts instead. */}

      <Box sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard>
              <CardTitle icon={<HandymanOutlinedIcon fontSize="small" />} tint="blue" title="What the workshop is holding"
                note="open work by what has to be done to it" />
              <Bars rows={[
                { label: "Sent to machine", n: work.saw, note: "cut from a plate" },
                { label: "Leftover", n: work.pick, note: "picked whole off the shelf", colour: GREEN },
              ]} />
            </GlassCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <GlassCard>
              <CardTitle icon={<ContentCutOutlinedIcon fontSize="small" />} tint={late ? "amber" : "slate"}
                title="Is the work on time?"
                note={`every line still to do, counted by the day its customer was promised`
                  + (late ? ` — ${full(late)} of them is already past it` : " — none is late")} />
              <Bars rows={due} />
            </GlassCard>
          </Grid>
        </Grid>
      </Box>

    </>
  );
}

/* ── status ───────────────────────────────────────────────────────────────── */

/** A skip the detector makes because nothing moved — the normal state of a quiet day. */
const idleSkip = (why: unknown) => /inventory unchanged|no change/i.test(String(why ?? ""));

function Fact({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 1.5, py: 0.9, borderBottom: "1px solid rgba(21,34,58,.07)" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.84rem", color: INK }}>{label}</Typography>
        {note && <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>{note}</Typography>}
      </Box>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap",
        color: tone === "bad" ? "#c5221f" : tone === "good" ? GREEN : INK }}>{value}</Typography>
    </Box>
  );
}

function StatusTab({ s, onSaved }: { s: Status; onSaved: () => void }) {
  const [url, setUrl] = useState(s.setting.url);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cd = (s.cutDone ?? {}) as Record<string, unknown>;
  const g = s.guard as Record<string, unknown>;
  const ps = s.promiseSweep as Record<string, unknown>;
  const er = s.erpRefs as Record<string, unknown>;

  const save = async () => {
    setBusy(true); setErr(null);
    const r = await post({ action: "gateway", url });
    setBusy(false);
    if (!r.ok) setErr(r.error ?? "It did not save.");
    else onSaved();
  };

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard>
          <CardTitle icon={<PrecisionManufacturingOutlinedIcon fontSize="small" />} tint="blue" title="The machine feed"
            note="HOMAG materialManager, polled every five minutes" />
          <Fact label="Feed" value={s.feed.down ? "down" : s.feed.frozen ? "frozen" : "live"}
            tone={s.feed.down || s.feed.frozen ? "bad" : "good"} note={s.feed.downReason ?? s.feed.frozenReason ?? undefined} />
          <Fact label="Board types" value={full(s.feed.boardTypes)} />
          <Fact label="Shelf last moved" value={when(s.feed.inventoryChangedAt)} note={`idle ${s.feed.idleWorkingHours.toFixed(1)} working hours`} />
          <Fact label="Polls since boot" value={full(s.feed.runs)} />
          {/* AN UNCHANGED SHELF IS IDLE, NOT BROKEN (SARCLA asked why this said "skipping"). The detector
              decides a cut happened by diffing the inventory before and after a poll. When the shelf has not
              moved there is nothing to diff, so it skips — which is the right thing to do and the normal
              state of a quiet day. Painting that red made a Saturday look like a fault. Only a skip for a
              reason OTHER than an unchanged shelf is worth worrying about. */}
          <Fact label="Cut-done detector"
            value={!cd.skipped ? `${full(Number(cd.checked) || 0)} line(s) judged`
              : idleSkip(cd.skipped) ? "nothing to judge" : "skipping"}
            tone={!cd.skipped ? "good" : idleSkip(cd.skipped) ? undefined : "bad"}
            note={cd.skipped
              ? (idleSkip(cd.skipped) ? "the shelf has not moved since the last poll, so there is no cut to detect" : String(cd.skipped))
              : cd.lastAt ? `last ran ${when(String(cd.lastAt))}` : undefined} />
        </GlassCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard>
          <CardTitle icon={<MonitorHeartOutlinedIcon fontSize="small" />} tint={s.shelf?.stale ? "amber" : "green"}
            title="How old the shelf is" note="From the File Agent's own write stamps, not from whether our poll succeeded" />
          <Fact label="Verdict" value={s.shelf?.stale ? "too old to promise from" : "current"} tone={s.shelf?.stale ? "bad" : "good"}
            note={s.shelf?.reason ? String(s.shelf.reason) : undefined} />
          <Fact label="Agent last wrote" value={s.shelf?.writtenAt ? when(String(s.shelf.writtenAt)) : "not dated yet"}
            note={s.shelf?.workingDaysSince !== null && s.shelf?.workingDaysSince !== undefined
              ? `${Number(s.shelf.workingDaysSince)} working day(s) ago · stale after ${Number(s.shelf.maxWorkingDays) || 3}` : undefined} />
          <Fact label="Decided by" value={String(s.shelf?.from ?? "–")} />
        </GlassCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard>
          <CardTitle icon={<FactCheckOutlinedIcon fontSize="small" />} tint="slate" title="The watchers"
            note="What checks the orders, and what it found" />
          <Fact label="Order guard" value={String(g.mode ?? "–")}
            note={`${full(Number(g.ordersJudged) || 0)} order(s) examined, ${full(Number(g.ordersShort) || 0)} short`} />
          <Fact label="Tickets raised" value={full(Number(g.ticketsRaised) || 0)}
            note={Number(g.heldBack) ? `${full(Number(g.heldBack))} held back` : undefined} />
          <Fact label="Promise re-check" value={`${full(Number(ps.sweeps) || 0)} sweep(s)`}
            note={ps.lastAt ? `last ${when(String(ps.lastAt))}` : undefined} />
          <Fact label="Promises the shelf cannot keep" value={full(Number(ps.piecesBroken) || 0)}
            tone={Number(ps.piecesBroken) ? "bad" : "good"}
            note={`${full(Number(ps.promisesChecked) || 0)} promise(s) across ${full(Number(ps.articlesChecked) || 0)} article(s)`} />
          {/* the SWEEPER's own work. Coverage ("how many lines have one") is a different question and
              lives on the Overview tile, counted from the pipeline view. */}
          <Fact label="A-number sweeper" value={er.running ? "running" : `${full(Number(er.runs) || 0)} run(s)`}
            note={er.lastAt ? `last ${when(String(er.lastAt))} · ${full(Number(er.written) || 0)} written, ${full(Number(er.notFound) || 0)} not in HubSpot`
              : "it has not needed to run yet"} />
        </GlassCard>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <GlassCard>
          <CardTitle icon={<KeyOutlinedIcon fontSize="small" />} tint="purple" title="The gateway"
            note={s.setting.fromDefault ? "The Railway address, until somebody sets another" : `Set by ${s.setting.by ?? "–"}${s.setting.at ? ` on ${when(s.setting.at)}` : ""}`} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TextField size="small" fullWidth value={url} disabled={!s.isAdmin || busy}
              onChange={(e) => setUrl(e.target.value)} sx={{ maxWidth: 420 }}
              helperText={s.isAdmin ? "The service's https address, no path." : "Admins change this."} />
            {s.isAdmin && (
              <Button variant="outlined" size="small" disabled={busy || !url.trim() || url.trim() === s.setting.url} onClick={save}>
                {busy ? "Saving…" : "Save"}
              </Button>
            )}
            <Tooltip title="Open the widget as a customer sees it">
              <IconButton size="small" component="a" href={`${s.setting.url}/widget.html`} target="_blank" rel="noreferrer">
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {err && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", mt: 1 }}>{err}</Typography>}
          <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 2 }}>
            Changing this points the hub at a different middleware. It does not move the tool, and it does not
            change what the shop frames — that address lives in the shop&rsquo;s own snippets.
          </Typography>
        </GlassCard>
      </Grid>
    </Grid>
  );
}

/* ── the page ─────────────────────────────────────────────────────────────── */

export default function DirectCutPage() {
  const [tab, setTab] = useHashTab<View>(VIEW_HASH, "overview");
  const [nonce, setNonce] = useState(0);
  /* how many finished lines to fetch — lifted by the board's "Show more" (SARCLA, 17.10) */
  const [doneShown, setDoneShown] = useState(100);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const boardHeld = useHeld<BoardPayload>(`/api/website/directcut?part=board&done=${doneShown}&n=${nonce}`, [nonce, doneShown]);
  const [regQ, setRegQ] = useState("");
  const regHeld = useHeld<{ registry: Registry; holds: Holds }>(`/api/website/directcut?part=registry&q=${encodeURIComponent(regQ)}&n=${nonce}`, [nonce, regQ]);
  const leftHeld = useHeld<Leftovers & { sent: SentLog; canMail: boolean; isAdmin: boolean }>(`/api/website/directcut?part=leftovers&n=${nonce}`, [nonce]);
  const brokenHeld = useHeld<{ broken: BrokenWithTickets; isAdmin: boolean }>(`/api/website/directcut?part=promises&n=${nonce}`, [nonce]);
  const statusHeld = useHeld<Status>(`/api/website/directcut?part=status&n=${nonce}`, [nonce]);
  const r = boardHeld.result;
  const s = statusHeld.result?.state === "ok" ? statusHeld.result.data : null;
  const bro = brokenHeld.result?.state === "ok" ? brokenHeld.result.data : null;
  const reg = regHeld.result?.state === "ok" ? regHeld.result.data : null;
  const left = leftHeld.result?.state === "ok" ? leftHeld.result.data : null;
  const b = r?.state === "ok" ? r.data.board : null;

  const work = b ? countWork(b.open) : null;
  const tabs = [
    { id: "overview" as View, label: "Overview", count: null },
    /* ONE BOARD, NOT TWO LISTS (SARCLA, 17.10.2026: "Open work and cut done should be only one TAB Cut
       Kanban and where we should see the dates"). */
    { id: "kanban" as View, label: "Cut Kanban", count: b ? String(b.open.length) : null },
    { id: "leftovers" as View, label: "Leftovers to pack", count: left ? String(left.ready) : null },
    { id: "shortages" as View, label: "Shortages", count: bro ? String(bro.broken.orders.length) : null },
    { id: "shelf" as View, label: "The shelf", count: b ? String(b.stock.length) : null },
    { id: "numbers" as View, label: "Articles & holds", count: reg ? String(reg.registry.total) : null },
    { id: "status" as View, label: "Status", count: null },
  ];

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the cut-to-size gateway…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="C2S middleware" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="C2S middleware" error={r.error} status={r.status} onRetry={reload} />;
  else {
    const board = r.data.board;
    body = (
      <>
        <Problems s={s} bro={bro} />
        <ReportTabs name="directcut" tab={tab} onSelect={setTab} tabs={tabs} />
        <Box sx={{ mt: 3 }}>
          {tab === "overview" && <Overview b={board} s={s} />}
          {tab === "kanban" && <KanbanTab open={board.open} done={board.done} doneTotal={board.doneTotal} isAdmin={r.data.isAdmin} onMoved={reload}
            onMore={() => setDoneShown((n) => Math.min(2000, n + 400))} loadingMore={boardHeld.stale} />}
          {tab === "leftovers" && (left
            ? <LeftoversTab data={left} isAdmin={left.isAdmin} onDone={reload} />
            : leftHeld.result?.state === "error"
              ? <UpstreamPanel source="C2S middleware" error={leftHeld.result.error} status={leftHeld.result.status} onRetry={reload} />
              : <LoadingPanel label="Looking for orders that are a leftover on their own…" />)}
          {tab === "shortages" && (bro
            ? <ShortagesTab broken={bro.broken} isAdmin={bro.isAdmin} onDone={reload} />
            : brokenHeld.result?.state === "error"
              ? <UpstreamPanel source="C2S middleware" error={brokenHeld.result.error} status={brokenHeld.result.status} onRetry={reload} />
              : <LoadingPanel label="Asking the shelf what it can no longer cover…" />)}
          {tab === "shelf" && <ShelfTab stock={board.stock} />}
          {tab === "numbers" && (reg
            ? <RegistryTab reg={reg.registry} hold={reg.holds} q={regQ} setQ={setRegQ} />
            : regHeld.result?.state === "error"
              ? <UpstreamPanel source="C2S middleware" error={regHeld.result.error} status={regHeld.result.status} onRetry={reload} />
              : <LoadingPanel label="Reading the registry and the holds…" />)}
          {tab === "status" && (s
            ? <StatusTab s={s} onSaved={reload} />
            : statusHeld.result?.state === "error"
              ? <UpstreamPanel source="C2S middleware" error={statusHeld.result.error} status={statusHeld.result.status} onRetry={reload} />
              : <LoadingPanel label="Asking the gateway how it is…" />)}
        </Box>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 3 }}>
          Read {when(board.at, true)} from {r.data.setting.url}
          {work ? ` · ${work.saw} need the saw, ${work.pick} are pick & ship` : ""}
        </Typography>
      </>
    );
  }

  return (
    <Box sx={{ px: GUTTER, py: { xs: 3, md: 4 } }}>
      <PageHeader
        title="DirectCut"
        subtitle="Cut to size: the open work, the shelf behind it, and the health of the machine feed"
        rightSlot={
          <Tooltip title="Read it again">
            <IconButton onClick={reload} size="small"><RefreshIcon fontSize="small" /></IconButton>
          </Tooltip>
        }
      />
      {body}
    </Box>
  );
}
