"use client";

// BACK OFFICE DISTRIBUTION - the Priority tab (SARCLA 19.10.2026: "a new tab, priority settings, to set the priority more
// accurately"). The workflow's priority table (MAIN ROUTING's category router) with the page's changes, and three signals
// the workflow does not have - urgent words, key customers, newsletters - each off until switched on here. Everything is
// worked out on the tickets of the last 7 days before it is saved, with the same rules the hub uses (rules.ts priorityFor).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Info, usePaged, when } from "@/app/connectors/parts";
import { PRIORITIES, SUB, priorityFor, type Priority, type PrioritySettings } from "@/lib/boDistribution/rules";
import type { Row } from "@/lib/boDistribution/engine";
import { pct, type Data } from "./shared";

const TINT: Record<Priority, "slate" | "blue" | "amber" | "pink"> = { LOW: "slate", MEDIUM: "blue", HIGH: "amber", URGENT: "pink" };
const SUBS: Record<string, string> = { "Website Issue": SUB.website, "Product Price": SUB.price, Delivery: SUB.delivery, "Invoicing & Accounting": SUB.invoicing, "Product Information": SUB.product };
const catOf = (r: Row) => r.route?.sets.enquiry_category ?? r.actual?.category ?? null;
const subOf = (r: Row) => { const c = catOf(r); const k = c ? SUBS[c] : undefined; return k ? r.route?.sets[k] ?? r.actual?.subCategory ?? null : null; };
const base = (r: Row) => (r.route?.sets.hs_ticket_priority as Priority | undefined) ?? null;
const lineOf = (r: Row, table: Data["priorityTable"]) => {
  const c = catOf(r), s = subOf(r);
  return table.find((l) => l.category === c && l.sub === s) ?? table.find((l) => l.category === c && l.sub === null) ?? null;
};
const words = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export function PriorityTab({ d, onSaved }: { d: Data; onSaved: () => void }) {
  const [p, setP] = useState<PrioritySettings>(d.settings.priority);
  const [urgent, setUrgent] = useState(d.settings.priority.urgentWords.join(", "));
  const [news, setNews] = useState(d.settings.priority.newsletterWords.join(", "));
  const [keys, setKeys] = useState(d.settings.priority.keyCustomerPriorities.join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const draft: PrioritySettings = { ...p, urgentWords: words(urgent).map((x) => x.toLowerCase()), newsletterWords: words(news).map((x) => x.toLowerCase()), keyCustomerPriorities: words(keys).map((x) => x.toUpperCase()) };
  const rows = d.rows.filter((r) => r.pipeline === "bo" && base(r));
  const results = useMemo(() => rows.map((r) => ({ r, hub: priorityFor(base(r), catOf(r), subOf(r), r.priorityFacts, draft) })), [rows, JSON.stringify(draft)]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = results.filter((x) => x.hub && x.hub.value !== base(x.r));
  const { slice, pager } = usePaged(changed, 10);
  const byPrio = (get: (x: (typeof results)[number]) => Priority | null) => PRIORITIES.map((pr) => ({ label: pr, value: results.filter((x) => get(x) === pr).length }));
  const hit = {
    urgent: rows.filter((r) => r.priorityFacts?.urgentHits.some((w) => draft.urgentWords.includes(w))),
    news: rows.filter((r) => r.priorityFacts?.newsletterHits.some((w) => draft.newsletterWords.includes(w))),
    key: rows.filter((r) => r.priorityFacts?.salesPriority && draft.keyCustomerPriorities.includes(r.priorityFacts.salesPriority)),
  };
  const read = rows.filter((r) => r.priorityFacts).length;
  const [edit, setEdit] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: draft }) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? "Saved - the hub uses these priorities from the next ticket (in shadow mode it only shows them)." : j.error ?? `HTTP ${r.status}`);
      onSaved();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const count = (line: Data["priorityTable"][number]) => rows.filter((r) => lineOf(r, d.priorityTable)?.key === line.key).length;
  const signal = (id: string, on: boolean, set: (v: boolean) => void, title: string, text: string, matches: Row[], why: (r: Row) => string, field: React.ReactNode) => (
    <Box sx={{ border: `1px solid ${on ? "#1b7a55" : HAIRLINE}`, bgcolor: on ? "rgba(27,122,85,.05)" : "transparent", borderRadius: "14px", p: 1.75, display: "grid", gap: 1, height: "100%", alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: INK }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{text}</Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Switch size="small" checked={on} onChange={(e) => set(e.target.checked)} disabled={!d.admin} />
          <Typography sx={{ fontSize: "0.68rem", color: on ? "#1b7a55" : MUTED, fontWeight: 700 }}>{on ? "ON" : "off"}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, color: INK, lineHeight: 1 }}>{full(matches.length)}</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>of {full(read)} tickets in 7 days {on ? "are changed" : "would change"}</Typography>
      </Box>
      {matches.slice(0, 3).map((r) => (
        <Box key={r.key} component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ textDecoration: "none", display: "block", borderTop: `1px solid ${HAIRLINE}`, pt: 0.5 }}>
          <Typography sx={{ fontSize: "0.76rem", color: INK, ...clip(360) }}>{r.subject || r.ticketId}</Typography>
          <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{why(r)}</Typography>
        </Box>
      ))}
      <Box>
        <Button size="small" onClick={() => setEdit(edit === id ? null : id)} sx={{ textTransform: "none", p: 0 }}>{edit === id ? "Close" : "Edit the words"}</Button>
        <Collapse in={edit === id}><Box sx={{ mt: 1 }}>{field}</Box></Collapse>
      </Box>
    </Box>
  );
  return (
    <>
      <Info>
        Priority comes from the ticket&apos;s category alone. Change any line of the table below to give a category another priority, or switch on one of
        the three signals the category cannot see. Every change is tried on the last 7 days&apos; tickets first, so you can see what it would have done
        before you save it - and what you save is what the next ticket gets.
      </Info>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<PriorityHighOutlinedIcon />} tint="blue" label="Tickets with a priority" value={full(rows.length)} note="Back Office tickets of the last 7 days that carry a priority" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="amber" label="Would change" value={full(changed.length)} note={`${pct(changed.length, rows.length)} of them, with the rules as they stand on this page`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<BoltOutlinedIcon />} tint="pink" label="URGENT" value={`${full(results.filter((x) => base(x.r) === "URGENT").length)} → ${full(results.filter((x) => x.hub?.value === "URGENT").length)}`} note="As they stand today → with the rules on this page" /></Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<PriorityHighOutlinedIcon />} tint="slate" title="As it stands today" note="The priorities these tickets carry, last 7 days" /><BarList rows={byPrio((x) => base(x.r))} labelWidth={90} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
        <Grid size={{ xs: 12, md: 6 }}><GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}><CardTitle icon={<PriorityHighOutlinedIcon />} tint="green" title="With the rules on this page" note="The same tickets, if you saved your changes" /><BarList rows={byPrio((x) => x.hub?.value ?? null)} labelWidth={90} format={(v) => full(v ?? 0)} /></GlassCard></Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<TuneOutlinedIcon />} tint="purple" title="By category" note="One line per category - change a line to set another priority for it; 'any other' is the rest of that category" />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Category", "Sub-category", "Tickets", "Today", "If saved"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {d.priorityTable.map((l) => {
                const v = p.overrides[l.key] ?? l.priority;
                return (
                  <TableRow key={l.key}>
                    <TableCell sx={{ ...bodyCell, fontWeight: 700 }}>{l.category}</TableCell>
                    <TableCell sx={{ ...bodyCell, color: l.sub ? INK : MUTED }}>{l.sub ?? "any other"}</TableCell>
                    <TableCell sx={bodyCell}>{count(l) || ""}</TableCell>
                    <TableCell sx={bodyCell}><Chip tint={TINT[l.priority]}>{l.priority}</Chip></TableCell>
                    <TableCell sx={bodyCell}>
                      <TextField select size="small" value={v} disabled={!d.admin} sx={{ minWidth: 130 }}
                        onChange={(e) => setP((x) => { const o = { ...x.overrides }; if (e.target.value === l.priority) delete o[l.key]; else o[l.key] = e.target.value as Priority; return { ...x, overrides: o }; })}>
                        {PRIORITIES.map((pr) => <MenuItem key={pr} value={pr}>{pr}{pr === l.priority ? " (unchanged)" : ""}</MenuItem>)}
                      </TextField>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>Set by e-mail rules, not by this table: C2S problem URGENT; PERFORMIS / AVOR stopped orders HIGH; billing address / ERP export HIGH.</Typography>
      </GlassCard>
      {read < rows.length && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>The signals are read on {full(read)} of {full(rows.length)} tickets so far - the older ones are filled in over the next runs.</Typography>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>{signal("urgent", p.raiseOnUrgentWords, (v) => setP({ ...p, raiseOnUrgentWords: v }), "Urgent words: one level up", "The subject or the e-mail says it is urgent, in any of the six languages.", hit.urgent, (r) => `“${r.priorityFacts!.urgentHits[0]}” · ${base(r)} → one level up`,
          <TextField size="small" multiline minRows={2} value={urgent} onChange={(e) => setUrgent(e.target.value)} disabled={!d.admin} helperText="Comma-separated" />)}</Grid>
        <Grid size={{ xs: 12, md: 4 }}>{signal("key", p.raiseKeyCustomers, (v) => setP({ ...p, raiseKeyCustomers: v }), "Key customers: one level up", "The ticket's company has one of these sales priorities (Smart Segmentation).", hit.key, (r) => `${r.company?.name ?? "company"} · ${r.priorityFacts!.salesPriority}`,
          <TextField size="small" value={keys} onChange={(e) => setKeys(e.target.value)} disabled={!d.admin} helperText="e.g. P1, P2" />)}</Grid>
        <Grid size={{ xs: 12, md: 4 }}>{signal("news", p.lowerNewsletters, (v) => setP({ ...p, lowerNewsletters: v }), "Newsletters and advertising: LOW", "A newsletter, an unsubscribe link or a webinar invitation never needs HIGH.", hit.news, (r) => `“${r.priorityFacts!.newsletterHits[0]}” · ${base(r)} → LOW`,
          <TextField size="small" multiline minRows={2} value={news} onChange={(e) => setNews(e.target.value)} disabled={!d.admin} helperText="Comma-separated" />)}</Grid>
      </Grid>
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CompareArrowsOutlinedIcon />} tint="amber" title="What would change" note={`${full(changed.length)} of ${full(rows.length)} tickets - with the rules on this page, saved or not`} />
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Entered", "Ticket", "Workflow", "Hub", "Why"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map(({ r, hub }) => (
                <TableRow key={r.key}>
                  <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                  <TableCell sx={bodyCell}><Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", display: "block", ...clip(320) }}>{r.subject || r.ticketId}</Box></TableCell>
                  <TableCell sx={bodyCell}><Chip tint={TINT[base(r)!]}>{base(r)}</Chip></TableCell>
                  <TableCell sx={bodyCell}><Chip tint={TINT[hub!.value]}>{hub!.value}</Chip></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED }}>{hub!.why.join("; ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!changed.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing changes - the rules on this page are the ones in use.</Typography>}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1.5 }}>
          <Button variant="contained" size="small" disabled={!d.admin || busy} onClick={() => void save()} sx={{ textTransform: "none" }}>Save the priority rules</Button>
          {busy && <CircularProgress size={14} />}
          {msg && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{msg}</Typography>}
        </Box>
      </GlassCard>
    </>
  );
}
