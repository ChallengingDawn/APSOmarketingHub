"use client";

// THE REVIEW QUEUE - ERP customers whose revenue arrived but matched no HubSpot
// company. Opening the page checks each one automatically (read-only): most are
// a company that is in HubSpot with its ERP id but without its customer key, and
// "Link" writes that key so the next revenue run finds it. A customer with no
// company in HubSpot stays waiting for a person - nothing is ever created.

import { useCallback, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import LinkIcon from "@mui/icons-material/Link";
import { full } from "@/app/charts/format";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GlassCard, INK, MUTED, Notice, bodyCell, headCell } from "@/app/uc/report/ui";
import type { CheckRow, CheckVerdict } from "@/lib/connectors/reviewRule";
import type { ReviewItem } from "@/lib/connectors/snapshot";
import { Chip, Choice, ConnectorsPage, usePaged, when, type Snapshot } from "../parts";

type Show = "todo" | "linked" | "resolved" | "all";
const cell = { ...bodyCell, fontSize: "0.82rem" };
const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;

function Verdict({ v }: { v: CheckVerdict | undefined }) {
  if (!v) return <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>checking…</Typography>;
  const co = (id: string, name: string) => <a href={hsCompany(id)} target="_blank" rel="noreferrer" style={{ color: "#2459d1" }}>{name}</a>;
  switch (v.kind) {
    case "linked": return <Box><Chip tint="green">Linked</Chip> <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>{co(v.companyId, v.name)} - matches from the next run</Typography></Box>;
    case "can_link": return <Box><Chip tint="blue">Found</Chip> <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>{co(v.companyId, v.name)} - its customer key is missing</Typography></Box>;
    case "conflict": return <Box><Chip tint="amber">Other key</Chip> <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>{co(v.companyId, v.name)} carries {v.holds}</Typography></Box>;
    case "several": return <Box><Chip tint="amber">{v.ids.length} companies</Chip> <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>same ERP id - a person decides</Typography></Box>;
    case "missing": return <Box><Chip tint="pink">Not in HubSpot</Chip> <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED }}>a person creates or merges it</Typography></Box>;
    default: return <Chip tint="slate">Not a customer key</Chip>;
  }
}

function Review({ s }: { s: Snapshot }) {
  const [tick, setTick] = useState(0);
  const url = `/api/connectors/review${tick ? `?refresh=1&n=${tick}` : ""}`;
  const check = useHeld<{ at: string; rows: CheckRow[] }>(url, [url]);
  const verdicts = useMemo(() => {
    const m = new Map<string, CheckVerdict>();
    if (check.result?.state === "ok") for (const r of check.result.data.rows) m.set(r.un, r.verdict);
    return m;
  }, [check.result]);
  const checking = check.result === null || check.stale;
  const [show, setShow] = useState<Show>("todo");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const all: ReviewItem[] = s.review?.items ?? [];
  const isResolved = (i: ReviewItem) => i.status === "resolved";
  const isLinked = (i: ReviewItem) => !isResolved(i) && verdicts.get(i.un ?? "")?.kind === "linked";
  const isTodo = (i: ReviewItem) => !isResolved(i) && !isLinked(i);
  const pass = { todo: isTodo, linked: isLinked, resolved: isResolved, all: () => true }[show];
  const rows = all.filter((i) => pass(i) && (!q || (i.un ?? "").includes(q.trim())));
  const { slice, pager, setPage } = usePaged(rows, 15);
  const linkable = all.filter((i) => isTodo(i) && verdicts.get(i.un ?? "")?.kind === "can_link").map((i) => i.un as string);

  const link = useCallback(async (uns: string[]) => {
    if (!uns.length || !confirm(`Write the customer key on ${uns.length} compan${uns.length === 1 ? "y" : "ies"} in HubSpot?`)) return;
    setBusy(true);
    setNote(null);
    const j = await fetch("/api/connectors/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uns }) })
      .then((r) => r.json()).catch(() => null);
    setBusy(false);
    setNote(j?.ok ? `Linked ${j.data.linked.length}${j.data.skipped.length ? `, ${j.data.skipped.length} no longer linkable` : ""} - their revenue matches from the next run.` : j?.error ?? "Could not link.");
    setTick((n) => n + 1);
  }, []);

  if (!s.review) return <Notice tone="warn">{s.stateError ?? "The review queue cannot be read yet."}</Notice>;
  return (
    <>
      {note && <Notice tone="warn">{note}</Notice>}
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.5, display: "grid", gap: 1.25 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, flex: 1, minWidth: 260 }}>
              Each customer is checked in HubSpot automatically: <b>Found</b> means the company is there but its customer key is missing - Link writes it.
              Nothing is ever created; a customer not in HubSpot waits for a person.
              {check.result?.state === "ok" ? ` Checked ${when(check.result.data.at)}.` : ""}
            </Typography>
            {checking && <CircularProgress size={16} />}
            <Button size="small" variant="contained" disableElevation startIcon={<LinkIcon />} disabled={busy || !linkable.length} onClick={() => link(linkable)}>
              Link all found{linkable.length ? ` (${linkable.length})` : ""}
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
            <Choice value={show} onChange={(k) => { setShow(k); setPage(0); }} options={[
              { key: "todo", label: "To do", count: all.filter(isTodo).length },
              { key: "linked", label: "Linked, matches next run", count: all.filter(isLinked).length },
              { key: "resolved", label: "Resolved before", count: all.filter(isResolved).length },
              { key: "all", label: "All", count: all.length },
            ]} />
            <TextField size="small" placeholder="Customer number" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
              sx={{ ml: { md: "auto" }, minWidth: 200 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }} />
          </Box>
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>
              <TableCell sx={headCell}>Customer number</TableCell>
              <TableCell sx={headCell} align="right">Revenue €</TableCell>
              <TableCell sx={headCell}>Since</TableCell>
              <TableCell sx={headCell}>Automatic check</TableCell>
              <TableCell sx={headCell} />
            </TableRow></TableHead>
            <TableBody>
              {slice.map((i, n) => {
                const v = isResolved(i) ? undefined : verdicts.get(i.un ?? "");
                return (
                  <TableRow key={`${i.type}-${i.un}-${n}`} hover>
                    <TableCell sx={{ ...cell, fontFamily: "monospace", color: INK }}>{i.un}{i.resolved_un && i.resolved_un !== i.un ? ` → ${i.resolved_un}` : ""}</TableCell>
                    <TableCell sx={cell} align="right">{i.revenue_eur !== undefined ? full(Math.round(i.revenue_eur)) : "—"}</TableCell>
                    <TableCell sx={{ ...cell, color: MUTED, whiteSpace: "nowrap" }}>{i.ts ? when(i.ts) : "—"}</TableCell>
                    <TableCell sx={cell}>{isResolved(i) ? <Chip tint="green">Resolved before</Chip> : <Verdict v={v} />}</TableCell>
                    <TableCell sx={bodyCell} align="right">
                      {v?.kind === "can_link" && (
                        <Button size="small" variant="outlined" disabled={busy} onClick={() => link([i.un as string])}>Link</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!slice.length && (
                <TableRow><TableCell colSpan={5} sx={{ ...cell, color: MUTED, py: 3, textAlign: "center" }}>
                  {show === "todo" && !q ? "Nothing to do - every ERP customer with revenue has a company." : "No customer matches."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        {pager}
      </GlassCard>
    </>
  );
}

export default function ReviewQueue() {
  return (
    <ConnectorsPage title="Review queue" subtitle="ERP customers with revenue but no HubSpot company - checked automatically, linked in one click">
      {(s) => <Review s={s} />}
    </ConnectorsPage>
  );
}
