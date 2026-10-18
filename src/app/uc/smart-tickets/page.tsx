"use client";

// SMART SUB-TICKETS (SARCLA 18.10.2026: "where is the smart sub ticket app on the hub?") - a HubSpot app (UC & HubSpot
// Apps > HubSpot apps). Its cards run in HubSpot - since 18.10.2026 in the hub's own HubSpot app, moved from "SARCLA -
// Smart Ticket Creator" - and this page shows what they created: sub-tickets per pipeline, GQS complete or not, who.

import { useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ViewQuiltOutlinedIcon from "@mui/icons-material/ViewQuiltOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import type { SubTicket } from "@/lib/smartTickets/report";
import FormEditor from "./FormEditor";

type Data = {
  totals: { created: number; capped: boolean; gqs: number; gqsComplete: number; hubApp: number; oldApp: number; people: number };
  byPipeline: Record<string, number>; rows: SubTicket[]; from: string; to: string;
};
type View = "overview" | "form" | "cards";
const VIEW_HASH: Record<View, string> = { overview: "#overview", form: "#create-form", cards: "#cards" };

/** The cards, where they sit in HubSpot (all in the app "SARCLA - APSOMarketingHub"). */
const CARDS: [string, string, string][] = [
  ["Smart Sub-Ticket", "Ticket sidebar", "Creates a sub-ticket from the ticket: suggests pipeline, category and sub-category (keyword rules, no AI), takes over contact, company, owner and the articles; the GQS forms per type - Margin % and Target price required."],
  ["NSP Generator", "Ticket tab", "Builds the NSP (new special part) request from the ticket's data."],
  ["SPR Articles", "Ticket tab", "The articles of a Special Prices Request with their target price, quantity and margin; the export for the price file."],
  ["BO: Running Tickets Team", "Ticket tab", "The Back Office team's open tickets, per person."],
  ["GQS: Running Tickets Team", "Ticket tab", "The GQS team's open tickets, per person."],
  ["BO: Team Overview", "Help desk sidebar", "The Back Office team's open tickets while working in the help desk."],
  ["GQS: Team Overview", "Help desk sidebar", "The GQS team's open tickets while working in the help desk."],
  ["Special Prices History", "Company tab", "Every Special Prices Request of the company, with its articles and prices."],
];

function Overview({ d }: { d: Data }) {
  const t = d.totals;
  const { slice, pager } = usePaged(d.rows, 20);
  const pipes = Object.entries(d.byPipeline).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <Grid container spacing={2}>
        {[
          { icon: <CallSplitOutlinedIcon />, tint: "blue" as const, label: "Sub-tickets created", value: t.created, note: pipes.map(([p, n]) => `${p} ${full(n)}`).join(" · ") || "in the period" },
          { icon: <FactCheckOutlinedIcon />, tint: "green" as const, label: "GQS with Margin % and Target price", value: t.gqsComplete, note: `of ${full(t.gqs)} GQS sub-tickets - required since 18.10.2026` },
          { icon: <SwapHorizOutlinedIcon />, tint: "purple" as const, label: "From the hub's app", value: t.hubApp, note: `${full(t.oldApp)} from the old Smart Ticket Creator` },
          { icon: <GroupsOutlinedIcon />, tint: "amber" as const, label: "People", value: t.people, note: "owners of the sub-tickets" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<CallSplitOutlinedIcon />} tint="blue" title="Sub-tickets" note={d.rows.length >= 200 ? `The latest 200 of the period's ${full(t.created)}` : "Every sub-ticket created in the period"} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Sub-ticket", "Pipeline", "From ticket", "Owner", "GQS", "App", "Created"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!d.rows.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No sub-ticket created in this period.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <Box component="a" href={hsTicket(r.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>{r.subject || `Ticket ${r.id}`}</Box>
                  {(r.gqsType || r.category) && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.gqsType || r.category}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.pipeline ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  {r.parentId ? <Box component="a" href={hsTicket(r.parentId)} target="_blank" rel="noopener" sx={{ color: INK, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(240) }}>{r.parentSubject || `Ticket ${r.parentId}`}</Box> : "-"}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.owner ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  {r.gqsComplete === null ? "-" : r.gqsComplete
                    ? <Chip tint="green">{`${r.marginPct ?? "-"} % · ${r.targetPrice === null ? "-" : full(r.targetPrice)}`}</Chip>
                    : <Chip tint="amber">{[r.marginPct === null ? "no Margin %" : null, r.targetPrice === null ? "no Target price" : null].filter(Boolean).join(", ")}</Chip>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.app === "hub" ? <Chip tint="purple">hub</Chip> : <Chip tint="slate">old app</Chip>}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

function Cards() {
  return (
    <>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<ViewQuiltOutlinedIcon />} tint="blue" title="The cards" note={'In HubSpot, app "SARCLA - APSOMarketingHub" (moved from "SARCLA - Smart Ticket Creator" on 18.10.2026)'} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Card", "Where", "What it does"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {CARDS.map(([name, where, what]) => (
              <TableRow key={name}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, whiteSpace: "nowrap" }}>{name}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{where}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{what}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
      <GlassCard>
        <CardTitle icon={<RuleOutlinedIcon />} tint="green" title="Rules" note="What the Smart Sub-Ticket card holds to" />
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.75, fontSize: "0.86rem", color: INK }}>
          <li>Every GQS sub-ticket needs <b>Margin %</b> and <b>Target price</b> - the card does not create it without them, and the app refuses it too (18.10.2026).</li>
          <li>Articles come from the parent ticket&apos;s Article(s) / Articles on the ticket; when those are empty, from its text and e-mail - ten digits in one piece or in groups, or the article in a shop link - and only what Products &amp; Pricing confirms.</li>
          <li>Pipeline, category and sub-category are suggested by keyword rules (no AI), in six languages; the person can change them.</li>
          <li>Contact, company and owner come from the parent ticket; the sub-ticket is linked to it.</li>
        </Box>
      </GlassCard>
    </>
  );
}

export default function SmartTickets() {
  const { window: win } = useReportingWindow();
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  const url = `/api/uc/smart-tickets?from=${win.from}&to=${win.to}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;

  let body: React.ReactNode;
  if (view === "form") body = <Box id="smarttickets-panel-form" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><FormEditor /></Box>;
  else if (view === "cards") body = <Box id="smarttickets-panel-cards" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Cards /></Box>;
  else if (r === null) body = <LoadingPanel label="Reading the sub-tickets…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Smart sub-tickets" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else body = <Box id="smarttickets-panel-overview" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Overview d={r.data} /></Box>;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Smart sub-tickets"
        subtitle="Sub-tickets created from a ticket with the Smart Sub-Ticket card - pipeline, category and form prefilled"
        rightSlot={view === "overview" ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <WindowPicker />
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Read again">
              <IconButton size="small" onClick={() => setN((x) => x + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        ) : undefined}
      />
      <Box>
        <ReportTabs name="smarttickets" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: r?.state === "ok" ? full(r.data.totals.created) : null },
          { id: "form", label: "Create form", count: null },
          { id: "cards", label: "Cards & rules", count: null },
        ]} />
      </Box>
      {body}
    </Box>
  );
}
