"use client";

// TICKET/ORDER/ARTICLE ASSOCIATIONS (SARCLA 17.10.2026: the name) - a HubSpot app (UC & HubSpot Apps > HubSpot apps). Back Office, ESO and
// TSA tickets linked to the orders and Products & Pricing articles they name, empty reference
// fields filled, cut-to-size flagged - every 3 minutes, by the hub, in place of the HubSpot
// workflow that ran on the Tickets app (SARCLA, 17.10.2026: "migrate the workflow here").
// Same kit as the other UC apps: the period on top, Overview and Settings as UC tabs.

import { useEffect, useState } from "react";
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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PinOutlinedIcon from "@mui/icons-material/PinOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, GlassCard, INK, KpiTile, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { ReportTabs, useHashTab } from "@/app/uc/report/Tabs";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { Chip, Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Backfill, LastRun, Mode, Settings } from "@/lib/ticketAssoc/run";
import type { AlertMode, AlertRow, AlertRun } from "@/lib/ticketAssoc/orderAlerts";
import type { ContactRow, ContactTotals, ContactsMode, ContactsRun } from "@/lib/ticketAssoc/contacts";
import { ShopAccountsTab } from "./ShopAccounts";

type Row = {
  ticket_id: string; at: string; pipeline: string | null; why: string; subject: string | null; orders: string[]; articles: string[];
  offer_orders: string[]; new_orders: number; new_articles: number; filled: string[]; c2s: boolean; ok: boolean; error: string | null; sources: string[];
};
type Pipe = { pipeline: string | null; tickets: number; orders: number; articles: number; filled: number; c2s: number; failed: number };
type OrderRow = { ticket_id: string; at: string; pipeline: string | null; why: string; subject: string | null; orders: string[]; offer_orders: string[]; new_orders: number; filled: string[]; ok: boolean };
type ArtRow = { ticket_id: string; at: string; pipeline: string | null; subject: string | null; articles: string[]; rejected: string[]; products: string[]; filled: string[]; orders: string[]; sources: string[] };
/** Where the hub found an order or article beyond the ticket's own fields. */
const SOURCE: Record<string, string> = { email: "in an e-mail", shop: "via a shop link" };
const Sources = ({ s }: { s: string[] }) => <>{s.map((k) => <Chip key={k} tint="slate">{SOURCE[k] ?? k}</Chip>)}</>;
type Data = {
  settings: Settings; mode: "preview" | "live"; pipeline: string | null; backfill: Backfill; byPipeline: Pipe[]; recent: Row[]; nothingFound: number; from: string; to: string;
  articles: ArtRow[]; orderRows: OrderRow[]; alerts: AlertRow[];
  totals: { order_tickets: number; named: number; offer: number; new_links: number; order_number: number; article_tickets: number; distinct_articles: number; rejected_tickets: number; article_filled: number }; lastAlerts: AlertRun | null; alertsEveryMinutes: number;
  contacts: { rows: ContactRow[]; totals: ContactTotals }; lastContacts: ContactsRun | null;
  last: { preview: LastRun | null; live: LastRun | null }; everyMinutes: number; admin: boolean;
};
type View = "overview" | "articles" | "orders" | "contacts" | "shop" | "alerts" | "settings";
const VIEW_HASH: Record<View, string> = { overview: "#overview", articles: "#articles", orders: "#orders", contacts: "#contacts", shop: "#shop-accounts", alerts: "#alerts", settings: "#settings" };
const PIPE: Record<string, string> = { BO: "Back Office", ESO: "ESO", TSA: "TSA", SPR: "Special Prices", PM: "Product Management" };
const WHY: Record<string, string> = { new: "new", stage: "moved stage", retry: "asked again" };
const FIELD: Record<string, string> = { order_number: "order number", articles_on_the_ticket: "articles", c2s_ticket: "C2S" };

function ModeLine({ d }: { d: Data }) {
  const m = d.settings.mode;
  if (m === "off") return <Info>Off - the hub links no tickets. The HubSpot workflow, while it runs, still does.</Info>;
  if (m === "preview") {
    return (
      <Info>
        Preview - every {d.everyMinutes} minutes the hub reads the changed tickets and records what it <b>would</b> write, without writing.
        The HubSpot workflow still writes meanwhile, so a ticket it already handled shows nothing new here - that is the two agreeing.
        When this looks right: Settings &gt; Live, then switch the workflow off in HubSpot.
      </Info>
    );
  }
  return null;
}

function Overview({ d }: { d: Data }) {
  const would = d.mode === "preview";
  const sum = (k: keyof Pipe) => d.byPipeline.reduce((a, p) => a + Number(p[k] ?? 0), 0);
  const { slice, pager } = usePaged(d.recent, 15);
  return (
    <>
      <ModeLine d={d} />
      <Grid container spacing={2}>
        {[
          { icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const, label: "Tickets handled", value: sum("tickets"), note: "new, or moved stage" },
          { icon: <ReceiptLongOutlinedIcon />, tint: "purple" as const, label: would ? "Order links to write" : "Order links written", value: sum("orders"), note: "the orders the ticket names" },
          { icon: <Inventory2OutlinedIcon />, tint: "green" as const, label: would ? "Article links to write" : "Article links written", value: sum("articles"), note: "checked against Products & Pricing" },
          { icon: <EditNoteOutlinedIcon />, tint: "amber" as const, label: would ? "Fields to fill" : "Fields filled", value: sum("filled"), note: "only when empty" },
          { icon: <ContentCutOutlinedIcon />, tint: "pink" as const, label: would ? "C2S to flag" : "C2S flagged", value: sum("c2s"), note: "cut-to-size order or text" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 2.4 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="By pipeline" note="Tickets the hub processed in the period" />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Pipeline", "Tickets", "Order links", "Article links", "Fields", "C2S", "Failed"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!d.byPipeline.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No ticket processed in this period yet.</TableCell></TableRow>}
            {d.byPipeline.map((p) => (
              <TableRow key={p.pipeline ?? "-"} hover>
                <TableCell sx={{ ...bodyCell, fontWeight: 600 }}>{PIPE[p.pipeline ?? ""] ?? p.pipeline ?? "-"}</TableCell>
                {[p.tickets, p.orders, p.articles, p.filled, p.c2s].map((n, i) => <TableCell key={i} sx={{ ...bodyCell, fontVariantNumeric: "tabular-nums" }}>{full(n)}</TableCell>)}
                <TableCell sx={{ ...bodyCell, color: p.failed ? RED : MUTED, fontVariantNumeric: "tabular-nums" }}>{full(p.failed)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="Latest tickets" note={`${would ? "What the hub would write - nothing is written in preview" : "What the hub wrote"}. ${full(d.nothingFound)} tickets in the period named no order and no article (a newsletter, an invoice) - counted, not listed.`} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Pipeline", "Why", "Orders", "Articles", "Filled", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!d.recent.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No ticket in this period named an order or an article yet.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticket_id}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <Box component="a" href={hsTicket(r.ticket_id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(320) }}>
                    {r.subject || `Ticket ${r.ticket_id}`}
                  </Box>
                  {!r.ok && <Typography sx={{ fontSize: "0.74rem", color: RED }}>{r.error ?? "failed - asked again next run"}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PIPE[r.pipeline ?? ""] ?? r.pipeline ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{WHY[r.why] ?? r.why}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.orders.length ? `${r.orders.join(", ")}${r.new_orders ? ` (+${r.new_orders})` : ""}` : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.articles.length ? `${r.articles.slice(0, 3).join(", ")}${r.articles.length > 3 ? ` +${r.articles.length - 3}` : ""}${r.new_articles ? ` (+${r.new_articles})` : ""}` : "-"} <Sources s={r.sources ?? []} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{[...r.filled.map((f) => FIELD[f] ?? f), ...(r.c2s && !r.filled.includes("c2s_ticket") ? ["C2S"] : [])].join(", ") || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

function TicketCell({ id, subject }: { id: string; subject: string | null }) {
  return (
    <Box component="a" href={hsTicket(id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>
      {subject || `Ticket ${id}`}
    </Box>
  );
}

/**
 * ARTICLES (SARCLA 17.10.2026: "the detection is also not very good, we should put a new tab for it"):
 * what the detection saw on each ticket - the articles Products & Pricing confirmed, the numbers that
 * looked like articles but the catalogue does not know, and eight-digit numbers (often a product page).
 */
function ArticlesTab({ d }: { d: Data }) {
  const rows = d.articles;
  const { slice, pager } = usePaged(rows, 15);
  const t = d.totals;
  const withArt = t.article_tickets;
  const distinct = t.distinct_articles;
  const rejected = t.rejected_tickets;
  const filledArt = t.article_filled;
  return (
    <>
      <Grid container spacing={2}>
        {[
          { icon: <Inventory2OutlinedIcon />, tint: "green" as const, label: "Tickets with an article", value: withArt, note: "confirmed by Products & Pricing" },
          { icon: <PinOutlinedIcon />, tint: "blue" as const, label: "Different articles", value: distinct, note: "across those tickets" },
          { icon: <ReportProblemOutlinedIcon />, tint: "amber" as const, label: "Tickets with unknown numbers", value: rejected, note: "looked like an article, are not" },
          { icon: <EditNoteOutlinedIcon />, tint: "purple" as const, label: d.mode === "preview" ? "Article(s) to fill" : "Article(s) filled", value: filledArt, note: "only when it was empty" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<Inventory2OutlinedIcon />} tint="green" title="What the detection saw" note={rows.length >= 200 ? "The latest 200 tickets of the period that named a number" : "Every processed ticket in the period that named a number"} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Pipeline", "Articles found", "Order linked", "Not in the catalogue", "8-digit numbers", "Article(s)", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={8} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No ticket in this period named a number.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticket_id}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketCell id={r.ticket_id} subject={r.subject} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PIPE[r.pipeline ?? ""] ?? r.pipeline ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.articles.length ? <><Chip tint="green">article found</Chip> {r.articles.join(", ")} <Sources s={r.sources ?? []} /></> : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.orders.length ? <><Chip tint="purple">order linked</Chip> {r.orders.join(", ")}</> : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: r.rejected.length ? "#a96a12" : MUTED }}>{r.rejected.join(", ") || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: MUTED }}>{r.products.join(", ") || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.filled.includes("article") ? <Chip tint="green">filled</Chip> : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

/**
 * ORDERS (SARCLA 17.10.2026: "I don't see the order association to the ticket, only the alerts"):
 * every processed ticket that is linked to an order - an A-number named in the ticket, or (with
 * the extended evidence) the order that followed an ESO / TSA offer. "new" = the link the hub wrote;
 * the rest the ticket already carried. Orders found later, on open tickets, are on Order alerts.
 */
function OrdersTab({ d }: { d: Data }) {
  const rows = d.orderRows;
  const { slice, pager } = usePaged(rows, 15);
  const t = d.totals;
  return (
    <>
      <Info>
        A ticket is linked to every order whose A-number it names (A26.123456 covers its .000 / .001 / .002 deliveries) - and, with the extended
        evidence (Settings), an ESO / TSA ticket also to the order of the same company that followed its offer. The order number goes into
        <b> Order Number</b> while that is empty. An order placed later on an open ticket is on <b>Order alerts</b>.
      </Info>
      <Grid container spacing={2}>
        {[
          { icon: <ReceiptLongOutlinedIcon />, tint: "purple" as const, label: "Tickets linked to an order", value: t.order_tickets, note: "in the period, each ticket once" },
          { icon: <AltRouteOutlinedIcon />, tint: "blue" as const, label: d.mode === "preview" ? "New links to write" : "New links written", value: t.new_links, note: "order links the ticket did not have" },
          { icon: <PinOutlinedIcon />, tint: "green" as const, label: "Found by A-number", value: t.named, note: `${full(t.offer)} by offer → order (a ticket can be both)` },
          { icon: <EditNoteOutlinedIcon />, tint: "amber" as const, label: d.mode === "preview" ? "Order Number to fill" : "Order Number filled", value: t.order_number, note: "only when it was empty" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<ReceiptLongOutlinedIcon />} tint="purple" title="Tickets linked to orders" note={rows.length >= 200 ? `The latest 200 of the period's ${full(t.order_tickets)}` : "Every processed ticket in the period with an order"} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Pipeline", "Order", "How", "Link", "Order Number", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No ticket in this period was linked to an order.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticket_id}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketCell id={r.ticket_id} subject={r.subject} /></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PIPE[r.pipeline ?? ""] ?? r.pipeline ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{[...new Set([...r.orders, ...r.offer_orders])].join(", ")}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  {r.orders.length ? <Chip tint="purple">named in the ticket</Chip> : null}{r.orders.length && r.offer_orders.length ? " " : null}
                  {r.offer_orders.length ? <Chip tint="green">offer to order</Chip> : null}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.new_orders ? <Chip tint="blue">{`${r.new_orders} new`}</Chip> : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>already linked</Typography>}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.filled.includes("order_number") ? <Chip tint="amber">filled</Chip> : "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

/**
 * The watcher sees orders as they get their A-number; this makes the next checks read the last 14
 * days' orders again (SARCLA 17.10.2026: "still only 2 alerts"). Alerts already made are never made
 * twice; in mail mode every new match mails its ticket's owner.
 */
function LookBack({ admin, mode }: { admin: boolean; mode: AlertMode }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  if (!admin) return null;
  const go = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/uc/ticket-associations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertsLookBack: 14 }) });
      setState(res.ok ? "done" : "idle");
    } catch { setState("idle"); }
  };
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
      <Button size="small" variant="outlined" onClick={() => void go()} disabled={state !== "idle"} sx={{ borderRadius: "999px", textTransform: "none" }}>
        {state === "busy" ? <CircularProgress size={14} /> : state === "done" ? "Looking back - the next checks read 14 days" : "Look back 14 days"}
      </Button>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        Reads the last 14 days&apos; orders again, 300 every 3 minutes until it has caught up.
        {mode === "mail" ? " Every new match mails its ticket's owner." : ""}
      </Typography>
    </Box>
  );
}

/**
 * CONTACTS & COMPANIES (SARCLA 18.10.2026: "this could be a new tab on ticket associations so then I can
 * turn down the workflow"): the contacts of each ticket's e-mails - a forwarded customer included - and
 * their company, linked by the hub in place of the workflow "SARCLA | TICKET ASSOCIATION FIX".
 */
function ContactsTab({ d }: { d: Data }) {
  const { rows, totals: t } = d.contacts;
  const { slice, pager } = usePaged(rows, 15);
  const would = d.settings.contacts !== "live";
  const lr = d.lastContacts;
  return (
    <>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
        {d.settings.contacts === "off" ? "Off - nothing is read." : would ? "Preview - what the hub would link; the HubSpot workflow still does the linking." : "Live - the hub links them; the workflow \"SARCLA | TICKET ASSOCIATION FIX\" can be switched off."}
        {lr ? ` Last look ${when(lr.at)}: ${full(lr.read)} changed tickets read, ${full(lr.processed)} checked${lr.error ? ` - ${lr.error}` : ""}.` : ""}
      </Typography>
      <Grid container spacing={2}>
        {[
          { icon: <ConfirmationNumberOutlinedIcon />, tint: "blue" as const, label: "Tickets checked", value: t.tickets, note: `${full(t.with_contact)} with a contact in HubSpot` },
          { icon: <PersonOutlineOutlinedIcon />, tint: "purple" as const, label: would ? "Contacts to link" : "Contacts linked", value: t.new_contacts, note: "the ticket did not have them yet" },
          { icon: <BusinessOutlinedIcon />, tint: "green" as const, label: would ? "Companies to link" : "Companies linked", value: t.new_companies, note: "each contact's primary company" },
          { icon: <ReportProblemOutlinedIcon />, tint: "amber" as const, label: "Not in HubSpot", value: t.not_found_tickets, note: `tickets with an address no contact has - ${full(t.forwarded_tickets)} from a forwarded mail` },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<PersonOutlineOutlinedIcon />} tint="purple" title="Tickets and their contacts" note={rows.length >= 200 ? `The latest 200 of the period's ${full(t.with_contact + t.not_found_tickets)}` : "Every ticket in the period with a contact, or an address HubSpot does not know"} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Pipeline", "Contacts", "Companies", "Not in HubSpot", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={6} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No ticket checked in this period yet.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticket_id}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <TicketCell id={r.ticket_id} subject={r.subject} />
                  {!r.ok && <Typography sx={{ fontSize: "0.74rem", color: RED }}>{r.error ?? "failed - asked again next run"}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{PIPE[r.pipeline ?? ""] ?? r.pipeline ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  {r.contacts.join(", ") || "-"} {r.new_contacts ? <Chip tint="purple">{`${r.new_contacts} new`}</Chip> : null}
                  {r.forwarded.some((a) => r.contacts.includes(a)) ? <> <Chip tint="slate">from a forwarded mail</Chip></> : null}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.companies.join(", ") || "-"} {r.new_companies ? <Chip tint="green">{`${r.new_companies} new`}</Chip> : null}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: r.not_found.length ? "#a96a12" : MUTED }}>{r.not_found.join(", ") || "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

/** "Check a ticket": the contacts and companies it would get. */
function CheckContacts({ c }: { c: unknown }) {
  if (!c || typeof c !== "object") return null;
  const p = c as { error?: string; contacts?: { email: string; isNew: boolean }[]; companies?: { name: string | null; id: string; isNew: boolean }[]; notFound?: string[] };
  if (p.error) return <Typography sx={{ fontSize: "0.84rem", color: RED }}>Contacts: {p.error}</Typography>;
  const cs = p.contacts ?? [], cos = p.companies ?? [];
  return (
    <>
      <Typography sx={{ fontSize: "0.84rem" }}>Contacts: {cs.map((x) => x.email).join(", ") || "none"} - {cs.filter((x) => x.isNew).length} not linked yet</Typography>
      <Typography sx={{ fontSize: "0.84rem" }}>Companies: {cos.map((x) => x.name ?? x.id).join(", ") || "none"} - {cos.filter((x) => x.isNew).length} not linked yet</Typography>
      {(p.notFound ?? []).length ? <Typography sx={{ fontSize: "0.84rem", color: "#a96a12" }}>Not in HubSpot: {(p.notFound ?? []).join(", ")}</Typography> : null}
    </>
  );
}

const ALERT_MODE: Record<AlertMode, string> = { off: "Off", preview: "Preview - list only", link: "Link the order", mail: "Link and mail the owner" };

/**
 * ORDER ALERTS (SARCLA 17.10.2026): an open ESO / TSA ticket names an article, the customer then orders
 * it - the order is linked to the ticket and the owner gets "please check your ticket" with a Review
 * button (Settings > Mail shows the mail). Every 15 minutes, from the orders that got their A-number.
 */
function AlertsTab({ d }: { d: Data }) {
  const rows = d.alerts;
  const { slice, pager } = usePaged(rows, 15);
  const a = d.settings.alerts;
  const la = d.lastAlerts;
  return (
    <>
      {a === "off" && <Info>Order alerts are off. Settings &gt; Order alerts turns them on.</Info>}
      {a === "preview" && <Info>Preview - every {d.alertsEveryMinutes} minutes the hub matches the orders that just got their A-number to open ESO / TSA tickets of the same customer that name one of the order&apos;s articles, and lists them here. Nothing is linked and nobody is mailed until Settings &gt; Order alerts says so.</Info>}
      {a === "link" && <Info>Linking - a matched order is linked to the ticket; nobody is mailed.</Info>}
      {a !== "off" && <LookBack admin={d.admin} mode={a} />}
      <Grid container spacing={2}>
        {[
          { icon: <NotificationsActiveOutlinedIcon />, tint: "blue" as const, label: a === "preview" ? "Alerts it would send" : "Alerts", value: rows.length, note: "one per ticket and order" },
          { icon: <ReceiptLongOutlinedIcon />, tint: "purple" as const, label: "Orders linked", value: rows.filter((r) => r.linked).length, note: "to the ticket" },
          { icon: <MarkEmailReadOutlinedIcon />, tint: "green" as const, label: "Owners mailed", value: rows.filter((r) => r.mailed_at).length, note: "“please check your ticket”" },
          { icon: <ReportProblemOutlinedIcon />, tint: "pink" as const, label: "Problems", value: rows.filter((r) => r.error).length, note: "no owner, no mail address, a failed link" },
        ].map((k) => (
          <Grid key={k.label} size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={k.icon} tint={k.tint} label={k.label} value={full(k.value)} note={k.note} /></Grid>
        ))}
      </Grid>
      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<NotificationsActiveOutlinedIcon />} tint="blue" title="Orders on open tickets" note={la ? `Last check ${when(la.at)}: ${full(la.read)} orders read, ${full(la.matched)} matched${la.error ? ` - ${la.error}` : ""}` : "Not checked yet"} />
        </Box>
        <Table size="small">
          <TableHead><TableRow>{["Ticket", "Customer", "Order", "Article", "Owner", "What happened", "When"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>No order matched an open ticket in this period.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticket_id}-${r.order_id}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}><TicketCell id={r.ticket_id} subject={r.ticket_subject} /><Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{PIPE[r.pipeline ?? ""] ?? r.pipeline}</Typography></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", ...clip(180) }}>{r.company ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{r.order_number ?? r.order_id}<Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.order_date ?? ""}</Typography></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>{r.articles.join(", ")}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", ...clip(200) }}>{r.owner_email ?? "-"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  {r.mailed_at ? <Chip tint="green">mailed</Chip> : r.linked ? <Chip tint="purple">linked</Chip> : <Chip tint="slate">listed</Chip>}
                  {r.error && <Typography sx={{ fontSize: "0.74rem", color: RED }}>{r.error}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
      </GlassCard>
    </>
  );
}

/**
 * Older tickets (SARCLA 17.10.2026: "these tickets are old, it is not running"): a re-check with
 * today's detection - links, empty fields, Article(s) - 100 a run, newest first, down to the chosen day.
 * The one-time copy of Articles on the ticket into Article(s) finished on 17.10 and is gone (18.10).
 */
function BackfillCard({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const b = d.backfill;
  const running = !!b.from && !b.done;
  const [from, setFrom] = useState(b.from ?? "2026-01-01");
  const [busy, setBusy] = useState(false);
  const send = async (value: string | null) => {
    setBusy(true);
    try {
      await fetch("/api/uc/ticket-associations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backfill: { from: value } }) });
      onChanged();
    } finally { setBusy(false); }
  };
  const at = b.cursor ? new Date(b.cursor).toISOString().slice(0, 10) : null;
  return (
    <GlassCard>
      <CardTitle icon={<HistoryOutlinedIcon />} tint="amber" title="Older tickets"
        note="A re-check of tickets the hub never processed, with today's detection - e-mails and shop links included (100 a run, newest first)." />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!d.admin || running} inputProps={{ "aria-label": "Re-check tickets created since" }} />
        {d.admin && (running
          ? <Button size="small" variant="outlined" onClick={() => void send(null)} disabled={busy} sx={{ borderRadius: "999px", textTransform: "none" }}>Stop</Button>
          : <Button size="small" variant="contained" disableElevation onClick={() => void send(from)} disabled={busy || !from || d.settings.mode !== "live"} sx={{ borderRadius: "999px", textTransform: "none" }}>Re-check from this day</Button>)}
      </Box>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 1 }}>
        {b.from
          ? `${running ? "Running" : "Done"}: ${full(b.processed)} tickets re-checked since ${b.from}${at ? `, now at tickets created ${at}` : ""}${b.startedAt ? ` (started ${when(b.startedAt)})` : ""}.`
          : "Not started."}
        {d.settings.mode !== "live" && " Runs only while the mode is Live."}
      </Typography>
    </GlassCard>
  );
}

function LastRunLine({ label, r }: { label: string; r: LastRun | null }) {
  if (!r) return <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{label}: has not run yet.</Typography>;
  return (
    <Typography sx={{ fontSize: "0.84rem", color: r.error ? RED : INK }}>
      {label}: {when(r.at)} - {full(r.read)} changed tickets read, {full(r.processed)} processed ({full(r.skipped)} left alone), {full(r.newOrders)} order and {full(r.newArticles)} article links, {full(r.filled)} fields, {full(r.c2s)} C2S{r.failed ? `, ${full(r.failed)} failed` : ""} - {r.seconds} s
      {r.error ? ` - ${r.error}` : ""}
    </Typography>
  );
}

function SettingsTab({ d, onChanged }: { d: Data; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tid, setTid] = useState("");
  const [check, setCheck] = useState<Record<string, unknown> | null>(null);

  const save = async (change: { mode?: Mode; extended?: boolean; alerts?: AlertMode; contacts?: ContactsMode }) => {
    setBusy("save"); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-associations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? { ok: true, text: "Saved - the next run (within 3 minutes) works this way." } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      if (j.ok) onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const runNow = async () => {
    setBusy("run"); setMsg(null);
    try {
      const r = await fetch("/api/uc/ticket-associations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "run" }) });
      const j = (await r.json()) as { ok: boolean; data?: LastRun & { skipped?: string }; error?: string };
      setMsg(j.ok ? { ok: true, text: j.data?.skipped ? `Not run: ${j.data.skipped}.` : `Ran: ${j.data?.processed ?? 0} tickets processed.` } : { ok: false, text: j.error ?? `HTTP ${r.status}` });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: String((e as Error).message) }); } finally { setBusy(null); }
  };
  const doCheck = async () => {
    setBusy("check"); setCheck(null);
    try {
      const r = await fetch(`/api/uc/ticket-associations?ticket=${encodeURIComponent(tid)}`);
      const j = (await r.json()) as { ok: boolean; data?: Record<string, unknown>; error?: string };
      setCheck(j.ok ? j.data ?? {} : { error: j.error ?? `HTTP ${r.status}` });
    } catch (e) { setCheck({ error: String((e as Error).message) }); } finally { setBusy(null); }
  };

  return (
    <>
      <GlassCard>
        <CardTitle icon={<TuneOutlinedIcon />} tint="blue" title="How it runs" note={`Every ${d.everyMinutes} minutes, on Back Office, ESO and TSA tickets that are new or moved stage`} />
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Mode</Typography>
            {d.admin ? (
              <Choice<Mode> value={d.settings.mode} onChange={(m) => void save({ mode: m })} options={[
                { key: "off", label: "Off" }, { key: "preview", label: "Preview - writes nothing" }, { key: "live", label: "Live - writes to HubSpot" },
              ]} />
            ) : <Chip tint={d.settings.mode === "live" ? "green" : "slate"}>{d.settings.mode}</Chip>}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Evidence</Typography>
            {d.admin ? (
              <Choice<"fields" | "extended"> value={d.settings.extended ? "extended" : "fields"} onChange={(v) => void save({ extended: v === "extended" })} options={[
                { key: "fields", label: "The ticket, its e-mails and shop links" },
                { key: "extended", label: "Also ESO / TSA offers to the order that followed" },
              ]} />
            ) : <Chip tint="slate">{d.settings.extended ? "extended" : "the ticket, its e-mails and shop links"}</Chip>}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Order alerts - an order with a ticket&apos;s article, on an open ESO / TSA ticket (every {d.alertsEveryMinutes} minutes)</Typography>
            {d.admin ? (
              <Choice<AlertMode> value={d.settings.alerts} onChange={(v) => void save({ alerts: v })} options={(Object.keys(ALERT_MODE) as AlertMode[]).map((k) => ({ key: k, label: ALERT_MODE[k] }))} />
            ) : <Chip tint="slate">{ALERT_MODE[d.settings.alerts]}</Chip>}
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>Contacts &amp; companies - the contacts of the ticket&apos;s e-mails and their company (replaces the workflow &quot;SARCLA | TICKET ASSOCIATION FIX&quot;)</Typography>
            {d.admin ? (
              <Choice<ContactsMode> value={d.settings.contacts} onChange={(v) => void save({ contacts: v })} options={[
                { key: "off", label: "Off" }, { key: "preview", label: "Preview - writes nothing" }, { key: "live", label: "Live - links them" },
              ]} />
            ) : <Chip tint="slate">{d.settings.contacts}</Chip>}
          </Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
            {d.settings.by ? `Set by ${d.settings.by}, ${when(d.settings.at)}.` : "Not set yet - preview, the ticket's fields."}
            {!d.admin && " Only an admin can change it."}
          </Typography>
          <LastRunLine label="Last live run" r={d.last.live} />
          <LastRunLine label="Last preview" r={d.last.preview} />
          {d.admin && (
            <Box>
              <Button variant="outlined" size="small" onClick={() => void runNow()} disabled={!!busy || d.settings.mode === "off"} sx={{ borderRadius: "999px", textTransform: "none" }}>
                {busy === "run" ? <CircularProgress size={14} /> : "Run now"}
              </Button>
            </Box>
          )}
          {msg && <Typography sx={{ fontSize: "0.84rem", color: msg.ok ? INK : RED }}>{msg.text}</Typography>}
        </Box>
      </GlassCard>

      <BackfillCard d={d} onChanged={onChanged} />

      <GlassCard>
        <CardTitle icon={<ManageSearchOutlinedIcon />} tint="purple" title="Check a ticket" note="Read and planned, never written - what the hub finds on it and would write now" />
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (tid.trim() && !busy) void doCheck(); }}
          sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField size="small" value={tid} onChange={(e) => setTid(e.target.value)} placeholder="Ticket id, e.g. 412345678901" inputProps={{ "aria-label": "Ticket id" }} sx={{ minWidth: 260 }} />
          <Button type="submit" variant="contained" disableElevation size="small" disabled={!tid.trim() || !!busy} sx={{ borderRadius: "999px", textTransform: "none" }}>
            {busy === "check" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Check"}
          </Button>
        </Box>
        {check && (
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.5 }}>
            {"error" in check && check.error ? <Typography sx={{ fontSize: "0.84rem", color: RED }}>{String(check.error)}</Typography> : (
              <>
                {check.note ? <Typography sx={{ fontSize: "0.84rem" }}>{String(check.note)}</Typography> : null}
                {check.pipeline ? (
                  <>
                    <Typography sx={{ fontSize: "0.84rem" }}><b>{String(check.subject ?? "")}</b> ({PIPE[String(check.pipeline)] ?? String(check.pipeline)})</Typography>
                    <Typography sx={{ fontSize: "0.84rem" }}>Orders named: {(check.orders as string[]).join(", ") || "none"} - {String(check.newOrders)} not linked yet</Typography>
                    <Typography sx={{ fontSize: "0.84rem" }}>Articles confirmed: {(check.articles as string[]).join(", ") || "none"} - {String(check.newArticles)} not linked yet</Typography>
                    {(check.offerOrders as string[]).length ? <Typography sx={{ fontSize: "0.84rem" }}>Offer to order: {(check.offerOrders as string[]).join(", ")}</Typography> : null}
                    <Typography sx={{ fontSize: "0.84rem" }}>Would fill: {Object.keys(check.fill as object).map((f) => FIELD[f] ?? f).join(", ") || "nothing"}</Typography>
                  </>
                ) : null}
                <CheckContacts c={check.contacts} />
                {check.ticket ? <Box component="a" href={hsTicket(String(check.ticket))} target="_blank" rel="noopener" sx={{ fontSize: "0.82rem" }}>Open in HubSpot</Box> : null}
              </>
            )}
          </Box>
        )}
      </GlassCard>
    </>
  );
}

export default function TicketAssociations() {
  const { window: win } = useReportingWindow();
  const [view, setView] = useHashTab<View>(VIEW_HASH, "overview");
  const [n, setN] = useState(0);
  // the pipeline filter (SARCLA 17.10.2026): all, or Back Office / ESO / TSA
  const [pipe, setPipe] = useState<"all" | "BO" | "ESO" | "TSA">("all");
  const url = `/api/uc/ticket-associations?from=${win.from}&to=${win.to}${pipe !== "all" ? `&pipeline=${pipe}` : ""}${n ? `&n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;

  let body: React.ReactNode;
  // the shop accounts have their own read - not the period's tickets (SARCLA 19.10)
  if (view === "shop") body = <Box id="ticketassoc-panel-shop" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><ShopAccountsTab /></Box>;
  else if (r === null) body = <LoadingPanel label="Reading the tickets the hub linked…" />;
  else if (r.state !== "ok") body = <UpstreamPanel source="Ticket/order/article associations" error={r.state === "error" ? r.error : "not configured"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;
  else if (view === "settings") body = <Box id="ticketassoc-panel-settings" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><SettingsTab d={r.data} onChanged={() => setN((x) => x + 1)} /></Box>;
  else if (view === "articles") body = <Box id="ticketassoc-panel-articles" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><ArticlesTab d={r.data} /></Box>;
  else if (view === "orders") body = <Box id="ticketassoc-panel-orders" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><OrdersTab d={r.data} /></Box>;
  else if (view === "contacts") body = <Box id="ticketassoc-panel-contacts" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><ContactsTab d={r.data} /></Box>;
  else if (view === "alerts") body = <Box id="ticketassoc-panel-alerts" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><AlertsTab d={r.data} /></Box>;
  else body = <Box id="ticketassoc-panel-overview" role="tabpanel" sx={{ display: "grid", gap: 2.5, minWidth: 0 }}><Overview d={r.data} /></Box>;

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Ticket/order/article associations"
        subtitle="Tickets linked to the orders and articles they name - by the hub, every 3 minutes"
        rightSlot={view !== "settings" && view !== "shop" ? (
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
        <ReportTabs name="ticketassoc" tab={view} onSelect={setView} tabs={[
          { id: "overview", label: "Overview", count: null },
          { id: "articles", label: "Articles", count: null },
          { id: "orders", label: "Orders", count: r?.state === "ok" && r.data.totals.order_tickets ? full(r.data.totals.order_tickets) : null },
          { id: "contacts", label: "Contacts & companies", count: r?.state === "ok" && r.data.contacts.totals.with_contact ? full(r.data.contacts.totals.with_contact) : null },
          { id: "shop", label: "Contacts without a company", count: null },
          { id: "alerts", label: "Order alerts", count: r?.state === "ok" && r.data.alerts.length ? full(r.data.alerts.length) : null },
          { id: "settings", label: "Settings", count: null },
        ]} />
      </Box>
      {view !== "settings" && view !== "shop" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Pipeline</Typography>
          <Choice<"all" | "BO" | "ESO" | "TSA"> value={pipe} onChange={setPipe} options={[
            { key: "all", label: "All" }, { key: "BO", label: "Back Office" }, { key: "ESO", label: "ESO" }, { key: "TSA", label: "TSA" },
          ]} />
        </Box>
      )}
      {body}
    </Box>
  );
}
