"use client";

// BACK OFFICE DISTRIBUTION - the Detection tab (SARCLA 19.10.2026: "improve the classifier page with the reason why it gets
// classified that way"; "how can we improve the detection of Others?"). The workflow's keyword classifier and the improved
// one (classifierV2.ts) side by side on every e-mail: the category, the keywords that decided it, the fixes that changed it,
// and the category a person set afterwards - the only real measure. Then what the "Others" are, and how to shrink them.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { full } from "@/app/charts/format";
import { BarList } from "@/app/charts/BarList";
import { CardTitle, GlassCard, HAIRLINE, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { Classification } from "@/lib/boDistribution/classifier";
import type { Row } from "@/lib/boDistribution/engine";
import { count, pct, type Data } from "./shared";

type Both = { v1: Classification; v2: Classification & { fixes: string[] } };
const v1cat = (r: Row) => r.route!.classified!.category ?? "Others";
const v2cat = (r: Row) => (r.v2 ? r.v2.category ?? "Others" : null);
const sub = (c: string | null | undefined) => (c ? ` / ${c}` : "");

function Answer({ cat, subCat, words, fixes, d }: { cat: string; subCat?: string | null; words?: string[]; fixes?: string[]; d: Data }) {
  return (
    <Box sx={{ display: "grid", gap: 0.4 }}>
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: cat === "Others" ? MUTED : INK }}>{cat}{sub(subCat)}</Typography>
      {!!fixes?.length && (
        <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap" }}>
          {fixes.map((f) => { const fx = d.fixes.find((x) => x.id === f); return <Tooltip key={f} title={fx?.description ?? f}><span><Chip tint="green">{fx?.title ?? f}</Chip></span></Tooltip>; })}
        </Box>
      )}
      {!!words?.length && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{words.slice(0, 6).join(" · ")}</Typography>}
    </Box>
  );
}

export function DetectionTab({ d }: { d: Data }) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [res, setRes] = useState<Both | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"changed" | "others" | "person" | "all">("changed");
  const [lists, setLists] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/uc/bo-distribution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "classify", subject, content: content.slice(0, 6000) }) });
      const j = (await r.json()) as { ok: boolean; data?: Both };
      setRes(j.ok && j.data ? j.data : null);
    } finally { setBusy(false); }
  };

  const read = d.rows.filter((r) => r.route?.classified);
  const withV2 = read.filter((r) => r.v2);
  const others1 = read.filter((r) => v1cat(r) === "Others");
  const others2 = withV2.filter((r) => v2cat(r) === "Others");
  const corrected = read.filter((r) => r.actual?.catByPerson);
  const right1 = corrected.filter((r) => r.actual!.catByPerson === v1cat(r));
  const right2 = corrected.filter((r) => r.v2 && r.actual!.catByPerson === v2cat(r));
  const changed = withV2.filter((r) => v1cat(r) !== v2cat(r));
  const rows = view === "changed" ? changed : view === "others" ? others1 : view === "person" ? corrected : read;
  const { slice, pager } = usePaged(rows, 12);
  const caught = others1.filter((r) => r.v2 && v2cat(r) !== "Others");

  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<PriorityHighOutlinedIcon />} tint="green" label="Recognised: workflow → improved" value={`${pct(read.length - others1.length, read.length)} → ${pct(withV2.length - others2.length, withV2.length)}`} note={`${full(read.length)} e-mails read by the classifier in 7 days`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<CompareArrowsOutlinedIcon />} tint="blue" label="Right where a person changed it" value={`${pct(right1.length, corrected.length)} → ${pct(right2.length, corrected.length)}`} note={`${full(corrected.length)} tickets a person re-filed. On 30 days: 10% → 26%; the 90 before: 13% → 46%`} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><KpiTile icon={<HelpOutlineOutlinedIcon />} tint="amber" label="Others: workflow → improved" value={`${full(others1.length)} → ${full(others2.length)}`} note="Nothing recognised: the workflow sets Others and the Load Balancer picks" /></Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Why each ticket got its category" note="The keywords each classifier found, the fixes that changed the improved one's answer (hover a fix), and what a person set afterwards" />
        <Box sx={{ mb: 1.5 }}>
          <Choice<"changed" | "others" | "person" | "all"> value={view} onChange={setView} options={[
            { key: "changed", label: "The improved one decides otherwise", count: changed.length },
            { key: "others", label: "Others today", count: others1.length },
            { key: "person", label: "Re-filed by a person", count: corrected.length },
            { key: "all", label: "All", count: read.length },
          ]} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead><TableRow>{["Entered", "Ticket", "Workflow's classifier", "Improved classifier", "A person set"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {slice.map((r) => {
                const person = r.actual?.catByPerson ?? null;
                return (
                  <TableRow key={r.key} sx={{ verticalAlign: "top" }}>
                    <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                    <TableCell sx={bodyCell}>
                      <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", display: "block", ...clip(280) }}>{r.subject || r.ticketId}</Box>
                      <Typography sx={{ fontSize: "0.7rem", color: MUTED }}>{r.fromDomain ?? "sender unknown"}</Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, minWidth: 200 }}><Answer d={d} cat={v1cat(r)} subCat={r.route!.classified!.subCategory} words={(r.route!.classified as Classification).matched} /></TableCell>
                    <TableCell sx={{ ...bodyCell, minWidth: 220 }}>{r.v2 ? <Answer d={d} cat={v2cat(r)!} subCat={r.v2.subCategory} words={r.v2.matched} fixes={r.v2.fixes} /> : <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>read with the next runs</Typography>}</TableCell>
                    <TableCell sx={bodyCell}>{person ? <Chip tint={person === v2cat(r) ? "green" : person === v1cat(r) ? "blue" : "amber"}>{person}</Chip> : <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>—</Typography>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {pager}
        {!rows.length && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None in the last 7 days.</Typography>}
      </GlassCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<HelpOutlineOutlinedIcon />} tint="amber" title={`What the ${full(others1.length)} "Others" are`} note="Where those e-mails came from - suppliers, newsletters, our own mailboxes and customers the keywords missed" />
            <BarList rows={count(others1, (r) => r.fromDomain ?? "sender unknown").slice(0, 14)} labelWidth={200} format={(v) => full(v ?? 0)} />
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <GlassCard sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
            <CardTitle icon={<LightbulbOutlinedIcon />} tint="green" title="How to shrink Others" note="Measured where it can be - each step in shadow first" />
            <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 1 }}>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>The improved classifier</b> - recognises {full(caught.length)} of these {full(others1.length)}: {count(caught, (r) => v2cat(r)).map((x) => `${x.label} ${x.value}`).join(", ") || "none yet"}.</Typography>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>Rules by sender</b> - our own mailboxes, known suppliers and newsletter senders (left) always mean the same thing: a short list per domain files them without reading a word.</Typography>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>The ticket&apos;s own facts</b> - an order number the hub found in the e-mail or a shop link (Ticket/order/article associations) points to Delivery; an article number to Product Information or Price.</Typography>
              <Typography component="li" sx={{ fontSize: "0.82rem", color: INK }}><b>AI for the rest</b> - a small Claude model picks one of the eight categories and its sub-category for what is still left, with a one-line reason; measured against people&apos;s corrections like the rest. The e-mail text goes to Anthropic for that, as the chat filing already does - your decision.</Typography>
            </Box>
          </GlassCard>
        </Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="blue" title="Try it" note="Paste a subject and an e-mail: both classifiers' answers and why (up to 6,000 characters)" />
        <Box sx={{ display: "grid", gap: 1, maxWidth: 900 }}>
          <TextField size="small" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <TextField size="small" label="E-mail text" multiline minRows={4} value={content} onChange={(e) => setContent(e.target.value.slice(0, 6000))} />
          <Box><Button variant="contained" size="small" disabled={busy || (!subject && !content)} onClick={() => void run()} sx={{ textTransform: "none" }}>Classify</Button></Box>
        </Box>
        {res && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {([["The workflow's classifier (today)", res.v1, [] as string[]], ["The improved classifier", res.v2, res.v2.fixes]] as const).map(([title, c, fx]) => (
              <Grid key={title} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, display: "grid", gap: 0.75 }}>
                  <Typography sx={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{title}</Typography>
                  <Answer d={d} cat={c.category ?? "Others"} subCat={c.subCategory} words={c.matched} fixes={fx as string[]} />
                  <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{c.explanation}{c.orderNumber ? ` · order ${c.orderNumber}` : ""}</Typography>
                  <BarList rows={Object.entries(c.scores).map(([label, value]) => ({ label, value })).filter((x) => (x.value ?? 0) > 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))} labelWidth={160} format={(v) => String(v ?? 0)} emptyMessage="No category scored." />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </GlassCard>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="The keyword lists" note="The workflow's: six languages, the subject counts ten times, the highest score wins, then the sub-category"
          right={<Button size="small" onClick={() => setLists((x) => !x)} sx={{ textTransform: "none" }}>{lists ? "Hide" : "Show"}</Button>} />
        <Collapse in={lists}>
          <Grid container spacing={2}>
            {d.classifier.map((c) => (
              <Grid key={c.category} size={{ xs: 12, md: 6, xl: 4 }}>
                <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", p: 1.5, height: "100%" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: INK }}>{c.category} <span style={{ color: MUTED, fontWeight: 500 }}>· {full(c.keywords)} keywords</span></Typography>
                  <Box sx={{ display: "flex", gap: 0.4, flexWrap: "wrap", my: 0.75 }}>{c.sample.map((k) => <Chip key={k} tint="slate">{k}</Chip>)}</Box>
                  {c.subs.map((s) => <Typography key={s.key} sx={{ fontSize: "0.76rem", color: MUTED }}>→ {s.value} <span style={{ color: INK }}>({s.keywords})</span></Typography>)}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Collapse>
      </GlassCard>
    </>
  );
}
