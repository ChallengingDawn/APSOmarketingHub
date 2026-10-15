"use client";

// SHOP ORDERS - ERP NUMBERS (SARCLA 15.10.2026). Web orders get their A-number from the shop
// itself (the magento_link step): how many wait right now, the last run's figures, the orders
// it stamped, and - for admins - a test run, a run now and the live switch.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import RefreshIcon from "@mui/icons-material/Refresh";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import TagIcon from "@mui/icons-material/Tag";
import ScheduleIcon from "@mui/icons-material/Schedule";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PageHeader from "@/app/PageHeader";
import { GUTTER, LoadingPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, GlassCard, KpiTile, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Info, when } from "../../parts";

type Result = Record<string, unknown> & {
  waiting?: number; asked_orders?: number; found?: number; stamped?: number; not_transferred?: number;
  left_for_next_run?: number; lookups?: number; shop_no_answer?: number; unreadable?: number; skipped_a_number_taken?: number;
  stamp_failed?: number; seconds?: number; skipped?: string; twins_merged?: number; twin_merge_failed?: number;
  examples?: { order: string; inc: string; a_number: string; name: string }[];
  a_number_taken?: { order: string; inc: string; a_number: string; already_on: string[]; reason?: string }[];
  twins?: { web_order: string; inc: string; a_number: string; into: string; kind?: "erp_copy" | "repeat"; carried?: string[]; contacts?: number; companies?: number; note?: string }[];
  errors?: string[];
};
type Run = { started: string; finished?: string; by: string; error?: string; result?: Result };
type Data = { live: boolean; admin: boolean; waiting: number | null; preview: Run | null; run: Run | null };

const KEY = "magento_link";
const hubspotOrder = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-123/${id}`;
const n = (v: unknown) => (typeof v === "number" ? full(v) : "—");

export default function ErpNumbers() {
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/connectors/magento/erp-numbers?n=${tick}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.ok) { setData(j.data); setError(null); } else setError(j.error ?? "could not be read"); })
      .catch((e) => { if (alive) setError(String(e?.message ?? e)); });
    const t = setTimeout(refresh, 30_000);
    return () => { alive = false; clearTimeout(t); };
  }, [tick, refresh]);

  const act = async (action: string) => {
    setBusy(true);
    setNote(null);
    const j = await fetch("/api/connectors/steps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: KEY, action }) })
      .then((x) => x.json()).catch(() => null);
    setNote(j?.data?.note ?? (j?.ok ? (action === "preview" ? "Test run started - it reads only. The figures below update when it is done." : "Started.") : j?.error ?? "Could not do that."));
    setBusy(false);
    setTimeout(refresh, 1500);
  };

  // the newer of the last live run and the last test run
  const runs = [data?.run ? { ...data.run, kind: "live" as const } : null, data?.preview ? { ...data.preview, kind: "test" as const } : null]
    .filter((x): x is Run & { kind: "live" | "test" } => !!x)
    .sort((a, b) => b.started.localeCompare(a.started));
  const last = runs[0] ?? null;
  const r = last?.result ?? {};
  const running = !!last && !last.finished;
  const test = last?.kind === "test";

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <Box>
        <PageHeader
          title="ERP numbers"
          subtitle="Each web order gets its A-number from the shop itself, as soon as the shop has transferred it to the ERP"
          rightSlot={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {data && (data.live ? <Chip tint="green">Live</Chip> : <Chip tint="amber">Test runs only</Chip>)}
              {data?.admin && (
                <>
                  <Button size="small" variant="outlined" disabled={busy || running} onClick={() => void act("preview")}>Test run</Button>
                  {data.live && <Button size="small" variant="outlined" disabled={busy || running} onClick={() => void act("run")}>Run now</Button>}
                  <Button size="small" variant="contained" disableElevation disabled={busy} color={data.live ? "inherit" : "primary"}
                    onClick={() => {
                      if (confirm(data.live ? "Switch the ERP-number lookup off? Web orders then wait for export.xml again." : "Switch the ERP-number lookup on? It then stamps web orders in HubSpot every 15 minutes.")) void act(data.live ? "live-off" : "live-on");
                    }}>
                    {data.live ? "Switch off" : "Switch on"}
                  </Button>
                </>
              )}
              {(data === null || running) && <CircularProgress size={14} sx={{ color: MUTED }} />}
              <Tooltip title="Read again"><IconButton size="small" onClick={refresh} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton></Tooltip>
            </Box>
          }
        />
        {data && (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: -1.5 }}>
            Every 15 minutes, never during an ERP chain · last live run {when(data.run?.finished ?? data.run?.started)} · last test run {when(data.preview?.finished ?? data.preview?.started)}
          </Typography>
        )}
      </Box>

      {error && <Notice tone="bad">{error}</Notice>}
      {data === null && !error && <LoadingPanel label="Reading the step…" />}

      {data && (
        <>
          {note && <Info>{note}</Info>}

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
            <KpiTile icon={<HourglassEmptyIcon />} tint="amber" label="Waiting for their A-number" value={n(data.waiting)} note="web orders in HubSpot right now" />
            <KpiTile icon={<TagIcon />} tint="blue" label={test ? "Found in the test run" : "Found in the last run"} value={n(r.found)}
              note={last ? `of ${n(r.asked_orders)} asked · ${n(r.not_transferred)} not transferred yet` : "no run yet"} />
            <KpiTile icon={<TaskAltIcon />} tint="green" label={test ? "Would be stamped" : "Stamped"} value={n(r.stamped)}
              note={[r.twins_merged ? `${n(r.twins_merged)} duplicate${r.twins_merged === 1 ? "" : "s"} ${test ? "would be " : ""}merged into the ERP order` : "",
                r.skipped_a_number_taken ? `${n(r.skipped_a_number_taken)} left for you` : ""].filter(Boolean).join(" · ") || "order_order_number, name, erp_linked"} />
            <KpiTile icon={<ScheduleIcon />} tint="slate" label="Left for the next run" value={n(r.left_for_next_run)}
              note={last ? `${n(r.lookups)} lookups in ${n(r.seconds)} s` : ""} />
          </Box>

          {last?.error && <Notice tone="bad">The last {last.kind} run failed: {last.error}</Notice>}
          {r.skipped && <Info>The last run waited: {r.skipped}</Info>}
          {(r.shop_no_answer ?? 0) > 0 && <Notice tone="warn">{n(r.shop_no_answer)} orders got no answer from the shop - the next run asks again.</Notice>}
          {(r.errors ?? []).length > 0 && <Notice tone="warn">{(r.errors ?? []).join(" · ")}</Notice>}

          {(r.twin_merge_failed ?? 0) > 0 && <Notice tone="warn">{n(r.twin_merge_failed)} duplicates could not be merged - the next run tries again.</Notice>}

          {(r.twins ?? []).length > 0 && (
            <GlassCard>
              <CardTitle icon={<TaskAltIcon />} tint="green" title={test ? "Duplicates the test run would merge" : "Duplicates merged into the ERP order"}
                note="The copy archived; its person (and company, when the other order had none) and its web fields moved over · the first 10" />
              <Table size="small">
                <TableHead><TableRow>{["Web order", "A-number", "What it was", "Moved over", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {(r.twins ?? []).map((t) => (
                    <TableRow key={t.web_order} hover>
                      <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{t.inc}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{t.a_number}</TableCell>
                      <TableCell sx={bodyCell}>{t.kind === "repeat" ? "A repeat of an order the ERP took as one" : "A copy of the ERP's own order"}</TableCell>
                      <TableCell sx={bodyCell}>{[`${t.contacts ?? 0} person`, t.companies ? `${t.companies} company` : "", ...(t.carried ?? [])].filter(Boolean).join(" · ")}{t.note ? ` - ${t.note}` : ""}</TableCell>
                      <TableCell sx={{ ...bodyCell, p: 0.25 }}>
                        <Tooltip title="Open the ERP order in HubSpot">
                          <IconButton size="small" href={hubspotOrder(t.into)} target="_blank" rel="noreferrer" aria-label="Open in HubSpot">
                            <OpenInNewIcon sx={{ fontSize: 15, color: ACCENT }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          )}

          {(r.a_number_taken ?? []).length > 0 && (
            <GlassCard>
              <CardTitle icon={<TagIcon />} tint="amber" title="A-number already on another order" note="Not stamped, not merged - to check by hand" />
              <Table size="small">
                <TableHead><TableRow>{["Web order", "A-number", "Also on", "Why not merged"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                  {(r.a_number_taken ?? []).map((t) => (
                    <TableRow key={t.order}>
                      <TableCell sx={bodyCell}>{t.inc}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{t.a_number}</TableCell>
                      <TableCell sx={bodyCell}>{t.already_on.join(", ")}</TableCell>
                      <TableCell sx={bodyCell}>{t.reason ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GlassCard>
          )}

          <GlassCard>
            <CardTitle icon={<TaskAltIcon />} tint="green" title={test ? "What the test run would stamp" : "Stamped in the last run"}
              note={last ? `${last.kind === "live" ? "Live" : "Test"} run of ${when(last.finished ?? last.started)} · the first 10` : "No run yet"} />
            {(r.examples ?? []).length === 0 ? (
              <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{last ? "Nothing to stamp in that run." : "Start a test run to see what it finds."}</Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead><TableRow>{["Web order", "A-number", "Order name in HubSpot", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
                  <TableBody>
                    {(r.examples ?? []).map((e) => (
                      <TableRow key={e.order} hover>
                        <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{e.inc}</TableCell>
                        <TableCell sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{e.a_number}</TableCell>
                        <TableCell sx={bodyCell}>{e.name}</TableCell>
                        <TableCell sx={{ ...bodyCell, p: 0.25 }}>
                          <Tooltip title="Open in HubSpot">
                            <IconButton size="small" href={hubspotOrder(e.order)} target="_blank" rel="noreferrer" aria-label="Open in HubSpot">
                              <OpenInNewIcon sx={{ fontSize: 15, color: ACCENT }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </GlassCard>

          <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
            The shop keeps each order&apos;s A-number but does not show it; it answers yes/no questions about it, about 23 per order. export.xml stays as a backup.
          </Typography>
        </>
      )}
    </Box>
  );
}
