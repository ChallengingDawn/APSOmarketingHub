"use client";

// OWNER REDIRECTION - since 19.10.2026 the "Redirections" view of Map assignment (SARCLA: "Owner redirection is now
// a part of Map assignment, so it should be taken out as a sub-app"); /uc/owner-redirection sends there. Only where
// it lives changed: the rules, their API (/api/uc/owner-redirection), the HubSpot function and the 15-minute check
// run as before.
// A company goes to the owner its rule names - by country (France -> Jeremy Borey, until 12.10.2026 its own HubSpot
// app, sarcla-france-owner) or by person (someone left: their companies go to someone else) - and its contacts, open
// tickets and open tasks follow. The rules are edited here and published to HubSpot on every save; the app SARCLA -
// APSOMarketingHub applies them the moment a company's country or owner changes, and the hub checks every 15 minutes.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import HistoryIcon from "@mui/icons-material/History";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { HubRun } from "@/lib/connectors/steps/run";
import type { Rule } from "@/lib/ownerRules/rules";
import type { Correction, StoredRule } from "@/lib/ownerRules/store";
import type { Owner, OwnerChange, PublishState } from "@/lib/ownerRules/hubspot";
import RuleEditor, { EMPTY_DRAFT, draftOf, type Draft } from "./RuleEditor";

type Data = {
  rules: StoredRule[]; owners: Owner[] | null; ownersError: string | null;
  problems: { errors: string[]; warnings: string[] };
  published: PublishState | null; publishError: { at: string; error: string } | null; inSync: boolean;
  live: boolean; run: HubRun | null; preview: HubRun | null;
  running: { mode: string; started: string } | null; otherRunning: boolean; admin: boolean;
  corrections: Correction[];
};
type HubSpotView = {
  hubspot: { ok: true; publishedAt: string; publishedBy: string; rules: number; hash: string; recordId: string; records: number } | { ok: false; error: string };
  changes: OwnerChange[] | null; changesError: string | null;
};
type Counts = { companies: number; contacts: number; tickets: number; tasks: number };
type Example = { company: string; name: string | null; rule: string; from: string | null; to: string; fields: string[]; contacts: number; tickets: number; tasks: number };

const PORTAL = "26492587";
const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;
const RED = "#9e1b18";

function useNames(owners: Owner[] | null) {
  return useMemo(() => {
    const m = new Map((owners ?? []).map((o) => [o.id, o]));
    return {
      name: (id: string | null | undefined) => (id ? m.get(id)?.name ?? `owner ${id}` : "nobody"),
      gone: (id: string) => m.get(id)?.active === false,
    };
  }, [owners]);
}

function Link({ id, children }: { id: string; children: React.ReactNode }) {
  return <a href={hsCompany(id)} target="_blank" rel="noreferrer" style={{ color: "#2459d1", textDecoration: "none" }}>{children}</a>;
}

/* ── how it runs ───────────────────────────────────────────────────────── */

function Status({ d, act, hub }: { d: Data; act: (action: string) => void; hub: HubSpotView | null }) {
  const p = d.published;
  const r = d.run;
  const hubState = hub?.hubspot;
  return (
    <GlassCard>
      <CardTitle icon={<CloudDoneOutlinedIcon />} tint="green" title="How it runs"
        note="In HubSpot the moment a company's country or owner changes - and a check in the hub every 15 minutes" />
      <Box sx={{ display: "grid", gap: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
          <Chip tint={p && d.inSync ? "green" : "amber"}>{p ? (d.inSync ? "Published" : "Not published") : "Never published"}</Chip>
          <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 240 }}>
            {p ? <>HubSpot rules published {when(p.at)} by {p.by} - {p.rules} rule{p.rules === 1 ? "" : "s"} on.</> : <>The rules have not been published to HubSpot yet.</>}
            {hubState && (hubState.ok
              ? <> HubSpot holds {hubState.rules} rule{hubState.rules === 1 ? "" : "s"} from {when(hubState.publishedAt)}{p && hubState.hash !== p.hash ? " - NOT what the hub published last" : ""}.</>
              : <> HubSpot read-back: {hubState.error}.</>)}
            {p && !p.searchable && <> HubSpot&apos;s search did not find the record yet, so the HubSpot app may not see the rules - publish again in a minute.</>}
          </Typography>
          {d.admin && <Button size="small" variant={p ? "outlined" : "contained"} disableElevation onClick={() => act("publish")}>{p ? "Publish again" : "Publish to HubSpot"}</Button>}
        </Box>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
          <Chip tint={d.live ? "green" : "slate"}>{d.live ? "Check on" : "Check: test only"}</Chip>
          <Typography sx={{ fontSize: "0.86rem", color: INK, flex: 1, minWidth: 240 }}>
            {d.live ? "Every 15 minutes the hub corrects what the HubSpot app missed." : "The 15-minute check only reports - it writes nothing until it is switched on."}
            {" "}Last run: {r?.finished ? when(r.finished) : "none yet"}.
          </Typography>
          {d.admin && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button size="small" variant="outlined" disabled={!!d.running || d.otherRunning} onClick={() => act("preview")}>Test run</Button>
              {d.live
                ? <Button size="small" variant="outlined" color="warning" onClick={() => { if (confirm("Switch the 15-minute check off? The HubSpot app keeps working; only the safety net stops.")) act("live-off"); }}>Switch off</Button>
                : <Button size="small" variant="contained" disableElevation onClick={() => { if (confirm("Switch the 15-minute check on? It then corrects every company that differs from the rules, with its contacts, open tickets and open tasks.")) act("live-on"); }}>Switch on</Button>}
            </Box>
          )}
        </Box>
      </Box>
    </GlassCard>
  );
}

/* ── the rules ─────────────────────────────────────────────────────────── */

function RuleText({ r, n }: { r: Rule; n: ReturnType<typeof useNames> }) {
  if (r.kind === "country") {
    return (
      <>
        Country is <b>{r.countries.join(", ") || "—"}</b>
        {r.customCountries.length > 0 && <> or country_custom is <b>{r.customCountries.join(", ")}</b></>}
      </>
    );
  }
  return <>Owned by <b>{n.name(r.fromOwner)}</b>{n.gone(r.fromOwner) && <> <Chip tint="slate">deactivated</Chip></>}</>;
}

function along(r: Rule, n: ReturnType<typeof useNames>): string {
  const parts = [r.cascade.contacts && "contacts", r.cascade.tickets && "open ESO / TSA tickets", r.cascade.tasks && "open tasks"].filter(Boolean) as string[];
  if (!parts.length) return "the company only";
  return r.kind === "country" ? `all ${parts.join(", ")}` : `${n.name(r.fromOwner)}'s ${parts.join(", ")}`;
}

function Rules({ d, n, onEdit, onAdd, onMove, onDelete, onToggle, busy }: {
  d: Data; n: ReturnType<typeof useNames>; busy: boolean;
  onEdit: (r: Rule) => void; onAdd: () => void; onMove: (id: string, dir: "up" | "down") => void; onDelete: (r: Rule) => void; onToggle: (r: Rule) => void;
}) {
  const canEdit = d.admin && !!d.owners;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 }, overflow: "hidden" }}>
      <Box sx={{ px: { xs: 2, md: 2.75 } }}>
        <CardTitle icon={<CompareArrowsIcon />} tint="blue" title="The rules"
          note="Top to bottom - the first rule that matches a company decides. A company no rule matches is left alone."
          right={canEdit ? <Button size="small" variant="contained" disableElevation onClick={onAdd} disabled={busy}>Add a rule</Button> : undefined} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 860 }}>
          <TableHead><TableRow>
            <TableCell sx={{ ...headCell, width: 36 }}>#</TableCell>
            <TableCell sx={headCell}>When</TableCell>
            <TableCell sx={{ ...headCell, width: 190 }}>Goes to</TableCell>
            <TableCell sx={{ ...headCell, width: 230 }}>Taken along</TableCell>
            <TableCell sx={{ ...headCell, width: 70 }}>On</TableCell>
            {canEdit && <TableCell sx={{ ...headCell, width: 150 }} />}
          </TableRow></TableHead>
          <TableBody>
            {d.rules.map((r, i) => (
              <TableRow key={r.id} hover sx={{ opacity: r.enabled ? 1 : 0.55 }}>
                <TableCell sx={{ ...bodyCell, color: MUTED, fontWeight: 700 }}>{i + 1}</TableCell>
                <TableCell sx={bodyCell}>
                  <Typography sx={{ fontSize: "0.86rem", color: INK }}><RuleText r={r} n={n} /></Typography>
                  {r.note && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.25 }}>{r.note}</Typography>}
                  <Typography sx={{ fontSize: "0.7rem", color: MUTED, mt: 0.25 }} title={`rule id ${r.id}`}>changed {when(r.updatedAt)}{r.updatedBy ? ` by ${r.updatedBy}` : ""}</Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.86rem", color: INK }}>
                  {n.name(r.toOwner)}{n.gone(r.toOwner) && <> <Chip tint="pink">deactivated</Chip></>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{along(r, n)}</TableCell>
                <TableCell sx={bodyCell}>
                  {canEdit
                    ? <Switch size="small" checked={r.enabled} disabled={busy} onChange={() => onToggle(r)} inputProps={{ "aria-label": `Rule ${i + 1} on` }} />
                    : <Chip tint={r.enabled ? "green" : "slate"}>{r.enabled ? "on" : "off"}</Chip>}
                </TableCell>
                {canEdit && (
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>
                    <Tooltip title="Earlier"><span><IconButton size="small" disabled={busy || i === 0} onClick={() => onMove(r.id, "up")}><ArrowUpwardIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Later"><span><IconButton size="small" disabled={busy || i === d.rules.length - 1} onClick={() => onMove(r.id, "down")}><ArrowDownwardIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Change"><span><IconButton size="small" disabled={busy} onClick={() => onEdit(r)}><EditOutlinedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Delete"><span><IconButton size="small" disabled={busy} onClick={() => onDelete(r)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!d.rules.length && (
              <TableRow><TableCell colSpan={canEdit ? 6 : 5} sx={{ ...bodyCell, color: MUTED, textAlign: "center", py: 3 }}>No rules - HubSpot changes nobody&apos;s companies.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, px: { xs: 2, md: 2.75 }, py: 1.25 }}>
        Every rule writes the company owner and region_responsibility (the ownership workflow copies one into the other), and only what differs.
        Only open ESO and TSA tickets follow: Back Office, GQS and every other pipeline keep their owner. Closed tickets and completed tasks keep theirs too. Leaving a country does not hand a company back.
      </Typography>
    </GlassCard>
  );
}

/* ── what would change ─────────────────────────────────────────────────── */

function RunView({ run, label, d, n }: { run: HubRun | null; label: string; d: Data; n: ReturnType<typeof useNames> }) {
  const res = (run?.result ?? {}) as Record<string, unknown>;
  const ex = (res.examples as Example[] | undefined) ?? [];
  const { slice, pager } = usePaged(ex, 10);
  const byRule = (res.by_rule as Record<string, Counts> | undefined) ?? {};
  const pos = new Map(d.rules.map((r, i) => [r.id, i + 1]));
  const rows = Object.entries(byRule).sort((a, b) => (pos.get(a[0]) ?? 99) - (pos.get(b[0]) ?? 99));
  if (!run) return <GlassCard><Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No {label} yet{d.admin ? " - press Test run above." : "."}</Typography></GlassCard>;
  const changed = (typeof res.changed === "number" ? res.changed : res.would_change) as number | undefined;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1, display: "grid", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          {run.finished ? `${label[0].toUpperCase()}${label.slice(1)} on ${when(run.finished)}` : `Running since ${when(run.started)}`}
          {run.mode === "preview" ? " - a test run writes nothing; this is what it would change now." : "."}
          {typeof changed === "number" && <> {full(changed)} compan{changed === 1 ? "y" : "ies"} {run.mode === "preview" ? "would change" : "changed"}.</>}
          {typeof res.left_for_next_run === "number" && res.left_for_next_run > 0 && <> {full(res.left_for_next_run)} more wait for the next run.</>}
        </Typography>
        {run.error && <Typography sx={{ fontSize: "0.82rem", color: RED }}>Failed: {run.error}</Typography>}
        {typeof res.failed === "number" && res.failed > 0 && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{res.failed} compan{res.failed === 1 ? "y" : "ies"} could not be written - the next run tries again.</Typography>}
        {typeof res.loops === "number" && res.loops > 0 && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{res.loops} compan{res.loops === 1 ? "y is" : "ies are"} caught between two rules and left alone.</Typography>}
      </Box>
      {rows.length > 0 && (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead><TableRow>
              <TableCell sx={headCell}>Rule</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Companies</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Contacts</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Open tickets</TableCell>
              <TableCell sx={{ ...headCell, textAlign: "right" }}>Open tasks</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.map(([id, c]) => {
                const r = d.rules.find((x) => x.id === id);
                return (
                  <TableRow key={id}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{pos.get(id) ? `${pos.get(id)}. ` : ""}{r ? <RuleText r={r} n={n} /> : `rule ${id} (since deleted)`}</TableCell>
                    {(["companies", "contacts", "tickets", "tasks"] as const).map((k) => (
                      <TableCell key={k} sx={{ ...bodyCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(c[k] ?? 0)}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      {ex.length > 0 ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640, tableLayout: "fixed" }}>
            <TableHead><TableRow>
              <TableCell sx={{ ...headCell, width: "38%" }}>Company</TableCell>
              <TableCell sx={headCell}>From → to</TableCell>
              <TableCell sx={{ ...headCell, width: 190 }}>With it</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {slice.map((e) => (
                <TableRow key={e.company} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Link id={e.company}>{e.name || `Company ${e.company}`}</Link></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>
                    {e.fields.includes("hubspot_owner_id") ? `${n.name(e.from)} → ${n.name(e.to)}` : `region_responsibility → ${n.name(e.to)}`}
                    {pos.get(e.rule) ? ` · rule ${pos.get(e.rule)}` : ""}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{e.contacts} contacts · {e.tickets} tickets · {e.tasks} tasks</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : !run.error && <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 2 }}><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing {run.mode === "preview" ? "would change" : "changed"} - every company is where its rule says.</Typography></Box>}
      {pager}
    </GlassCard>
  );
}

/* ── corrections ───────────────────────────────────────────────────────── */

function Corrections({ d, hub, n }: { d: Data; hub: HubSpotView | null; n: ReturnType<typeof useNames> }) {
  const [view, setView] = useState<"hubspot" | "sweep">("hubspot");
  const changes = hub?.changes ?? [];
  const a = usePaged(changes, 10);
  const b = usePaged(d.corrections, 10);
  const pos = new Map(d.rules.map((r, i) => [r.id, i + 1]));
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.25, display: "grid", gap: 1.25 }}>
        <CardTitle icon={<HistoryIcon />} tint="purple" title="Recent corrections"
          note="Who last gave a company to one of the rules' owners, from HubSpot's own history - and what the 15-minute check corrected" />
        <Choice value={view} onChange={setView} options={[
          { key: "hubspot", label: "In HubSpot, last 7 days", count: hub?.changes ? changes.length : undefined },
          { key: "sweep", label: "By the 15-minute check", count: d.corrections.length },
        ]} />
      </Box>
      {view === "hubspot" ? (
        !hub ? <Box sx={{ p: 2 }}><LoadingPanel label="Reading HubSpot's history…" /></Box>
          : hub.changesError ? <Typography sx={{ px: { xs: 2, md: 2.75 }, pb: 2, fontSize: "0.84rem", color: RED }}>{hub.changesError}</Typography>
            : changes.length ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 680, tableLayout: "fixed" }}>
                  <TableHead><TableRow>
                    <TableCell sx={{ ...headCell, width: 110 }}>When</TableCell>
                    <TableCell sx={{ ...headCell, width: "32%" }}>Company</TableCell>
                    <TableCell sx={headCell}>From → to</TableCell>
                    <TableCell sx={{ ...headCell, width: 220 }}>By</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {a.slice.map((c) => (
                      <TableRow key={`${c.companyId}-${c.at}`} hover>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{when(c.at)}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Link id={c.companyId}>{c.name || `Company ${c.companyId}`}</Link></TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{n.name(c.from)} → {n.name(c.to)}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{c.byThisApp ? <Chip tint="green">{c.by}</Chip> : <span style={{ color: MUTED }}>{c.by}</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : <Typography sx={{ px: { xs: 2, md: 2.75 }, pb: 2, fontSize: "0.84rem", color: MUTED }}>No company was given to one of the rules&apos; owners in the last 7 days.</Typography>
      ) : d.corrections.length ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 680, tableLayout: "fixed" }}>
            <TableHead><TableRow>
              <TableCell sx={{ ...headCell, width: 110 }}>When</TableCell>
              <TableCell sx={{ ...headCell, width: "32%" }}>Company</TableCell>
              <TableCell sx={headCell}>From → to</TableCell>
              <TableCell sx={{ ...headCell, width: 220 }}>With it</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {b.slice.map((c, i) => (
                <TableRow key={`${c.companyId}-${c.at}-${i}`} hover>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{when(c.at)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}><Link id={c.companyId}>{c.companyName || `Company ${c.companyId}`}</Link></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{n.name(c.fromOwner)} → {n.name(c.toOwner)}{pos.get(c.ruleId) ? ` · rule ${pos.get(c.ruleId)}` : ""}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{c.contacts} contacts · {c.tickets} tickets · {c.tasks} tasks</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : <Typography sx={{ px: { xs: 2, md: 2.75 }, pb: 2, fontSize: "0.84rem", color: MUTED }}>The 15-minute check has not corrected anything{d.live ? "" : " - it is in test mode"}.</Typography>}
      {view === "hubspot" ? a.pager : b.pager}
    </GlassCard>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

type Intro = (rules: StoredRule[], name: (id: string) => string) => React.ReactNode;

function Board({ d, hub, reload, intro }: { d: Data; hub: HubSpotView | null; reload: () => void; intro?: Intro }) {
  const n = useNames(d.owners);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [view, setView] = useState<"preview" | "run">("preview");

  const send = useCallback(async (method: string, body: unknown, url = "/api/uc/owner-redirection") => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === null ? undefined : JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      setNote(j?.ok ? j.data?.note ?? "Done." : j?.error ?? `Not done (HTTP ${r.status}).`);
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
      setTimeout(reload, 800);
    }
  }, [reload]);

  const act = (action: string) => void send("POST", { action });
  const save = (r: Rule) => void send("PUT", { rule: r });
  return (
    <>
      {intro?.(d.rules, n.name)}
      {note && <Info>{note}</Info>}
      {d.running && <Info>A {d.running.mode === "preview" ? "test run" : "run"} is going on since {when(d.running.started)}.</Info>}
      {d.publishError && <Notice tone="bad">Publishing to HubSpot failed {when(d.publishError.at)}: {d.publishError.error} HubSpot keeps running the rules it had.</Notice>}
      {!d.inSync && d.published && !d.publishError && <Notice tone="warn">The saved rules differ from what HubSpot runs - press Publish again.</Notice>}
      {d.problems.errors.map((e) => <Notice key={e} tone="bad">{e}</Notice>)}
      {d.problems.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
      {d.ownersError && <Notice tone="warn">HubSpot&apos;s owners could not be read ({d.ownersError}) - the rules show owner ids and cannot be edited until they can.</Notice>}

      <Status d={d} act={act} hub={hub} />
      <Rules d={d} n={n} busy={busy}
        onAdd={() => setEditing({ ...EMPTY_DRAFT })}
        onEdit={(r) => setEditing(draftOf(r))}
        onMove={(id, dir) => void send("PUT", { id, dir })}
        onToggle={(r) => save({ ...r, enabled: !r.enabled })}
        onDelete={(r) => { if (confirm("Delete this rule? HubSpot stops applying it as soon as it is published.")) void send("DELETE", null, `/api/uc/owner-redirection?id=${encodeURIComponent(r.id)}`); }} />

      <Box sx={{ display: "grid", gap: 1.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <FactCheckOutlinedIcon sx={{ color: MUTED, fontSize: 20 }} />
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>What would change now</Typography>
          <Choice value={view} onChange={setView} options={[{ key: "preview", label: "Last test run" }, { key: "run", label: "Last run" }]} />
        </Box>
        {view === "preview" ? <RunView run={d.preview} label="last test run" d={d} n={n} /> : <RunView run={d.run} label="last run" d={d} n={n} />}
      </Box>

      <Corrections d={d} hub={hub} n={n} />

      {editing && d.owners && (
        <RuleEditor open initial={editing} owners={d.owners} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNote(msg); reload(); }} />
      )}
    </>
  );
}

/**
 * Owner redirection's whole board - status, the rules, what would change, corrections - with its own data
 * (/api/uc/owner-redirection), no page frame: Map assignment shows it as its Redirections view. `intro` renders above
 * it, with the rules and the owners' names (Map assignment: the France note).
 */
export function OwnerRedirectionView({ intro }: { intro?: Intro }) {
  const [tick, setTick] = useState(0);
  const url = `/api/uc/owner-redirection?n=${tick}`;
  const held = useHeld<Data>(url, [url]);
  const hubUrl = `/api/uc/owner-redirection/hubspot?n=${tick}`;
  const hubHeld = useHeld<HubSpotView>(hubUrl, [hubUrl]);
  const r = held.result;
  const running = r?.state === "ok" ? r.data.running : null;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setTick((x) => x + 1), 10_000);
    return () => clearTimeout(t);
  }, [running, tick]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  const hub = hubHeld.result?.state === "ok" ? hubHeld.result.data : hubHeld.result?.state === "error"
    ? { hubspot: { ok: false as const, error: hubHeld.result.error }, changes: null, changesError: hubHeld.result.error } : null;
  if (r === null) return <LoadingPanel key="owner-loading" label="Reading the redirection rules…" />;
  if (r.state === "error") return <UpstreamPanel key="owner-error" source="Owner redirection" error={r.error} status={r.status} onRetry={reload} />;
  if (r.state !== "ok") return <UpstreamPanel key="owner-error" source="Owner redirection" error="Not available" status={null} onRetry={reload} />;
  return <Board key="owner-board" d={r.data} hub={hub} reload={reload} intro={intro} />;
}
