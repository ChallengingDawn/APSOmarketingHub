"use client";

// DUPLICATES & MERGES > Contacts > By e-mail domain (SARCLA 10.11.2026, the DUPS app's workflows into the hub). Replaces the
// workflow "SARCLA | UNASSIGNED CONTACTS -> COMPANIES": a contact without a company is linked to the company of its
// e-mail domain - the only one there, or the one of its country's Mandant. Shadow first: the tab shows what it would link
// until an admin switches it on. Reads /api/uc/contact-link (src/lib/contactLink).

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import AddLinkIcon from "@mui/icons-material/AddLink";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, INK, KpiTile, MUTED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice, Info, usePaged, when } from "@/app/connectors/parts";
import type { Linked, Row, RunInfo, Settings } from "@/lib/contactLink/engine";
import type { LinkKind } from "@/lib/contactLink/rules";
import { hsContact } from "@/app/uc/map-assignment/shared";

const API = "/api/uc/contact-link";
const HS_COMPANY = (id: string) => `https://app-eu1.hubspot.com/contacts/26492587/record/0-2/${id}`;
type Data = {
  settings: Settings; last: RunInfo | null; workflowOn: boolean | null; writing: boolean; admin: boolean;
  at: string | null; total: number; counts: Record<LinkKind, number> | null;
  next: Row[]; nextCount: number; several: Row[]; severalCount: number; links: Linked[]; linked30: number;
};
type View = "next" | "linked" | "several";
const WHY = { one: "the only company on the domain", mandant: "the company of their country's Mandant" } as const;

const link = (href: string, text: string, max = 240) => (
  <Box component="a" href={href} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(max) }}>{text}</Box>
);

export function DomainLinks() {
  const [n, setN] = useState(0);
  const url = `${API}${n ? `?n=${n}` : ""}`;
  const held = useHeld<Data>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  const [view, setView] = useState<View>("next");
  const [q, setQ] = useState("");
  const { next, several, linked } = useMemo(() => {
    const t = q.trim().toLowerCase();
    const match = (s: string) => !t || s.toLowerCase().includes(t);
    return {
      next: (d?.next ?? []).filter((x) => match(`${x.name} ${x.email} ${x.country} ${x.v.company?.name ?? ""}`)),
      several: (d?.several ?? []).filter((x) => match(`${x.name} ${x.email} ${x.country}`)),
      linked: (d?.links ?? []).filter((x) => match(`${x.name} ${x.email} ${x.companyName}`)),
    };
  }, [d, q]);
  const pNext = usePaged(next, 25), pSeveral = usePaged(several, 25), pLinked = usePaged(linked, 25);

  if (r === null) return <LoadingPanel label="Reading the contacts without a company…" />;
  if (!d) return <UpstreamPanel source="By e-mail domain" error={r.state === "error" ? r.error : "not there yet - this tab fills in once the hub is deployed"} status={r.state === "error" ? r.status : null} onRetry={() => setN((x) => x + 1)} />;

  const mode = d.settings.mode;
  const c = d.counts;
  const free = c ? c.free + c.internal + c.noemail : 0;
  const would = mode !== "live" || !d.writing;

  return (
    <>
      {mode === "off" ? (
        <Info>Off - nothing is looked at.</Info>
      ) : mode === "shadow" ? (
        <Info><b>Shadow:</b> the hub works out what it would link and links nothing. An admin switches it on below.</Info>
      ) : !d.writing ? (
        <Info><b>Waiting:</b> the HubSpot workflow “SARCLA | UNASSIGNED CONTACTS -&gt; COMPANIES” is {d.workflowOn ? "still switched on" : "not readable"} - the hub links nothing while it runs.</Info>
      ) : (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Automatic: every 15 minutes each contact without a company is linked to the company of its e-mail domain, when the rule finds exactly one - 250 a run.</Typography>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<LinkOffIcon />} tint="slate" label="Contacts without a company" value={c ? full(d.total) : "—"} note={d.at ? `read ${when(d.at)}` : "read within minutes of the deploy"} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddLinkIcon />} tint="green" label={would ? "It would link" : "To link next"} value={c ? full(d.nextCount) : "—"} note={c ? `${full(c.one)} the only company on the domain · ${full(c.mandant)} by the Mandant` : undefined} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<CallSplitIcon />} tint="amber" label="Several companies on the domain" value={c ? full(d.severalCount) : "—"} note={c ? `${full(c.none)} more: no company on their domain` : undefined} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AlternateEmailIcon />} tint="purple" label="Linked by the hub" value={full(d.linked30)} note={`last 30 days · ${full(free)} without a work address are never matched`} /></Grid>
      </Grid>

      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<RuleOutlinedIcon />} tint="purple" title="How a contact is linked"
          note="A contact without a company, with a work e-mail address (Gmail, Bluewin, GMX and the like and A+P's own are left out): the companies whose domain is the address's. One company: it is linked. Several: the one of the Mandant of the contact's country - Switzerland M100, any other country M110 - when exactly one is left. Otherwise nothing is linked. It becomes the contact's primary company. A domain's companies are looked up again every day, so a company that gets its domain later is found then." />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
          <Choice<View> value={view} onChange={setView} options={[
            { key: "next", label: would ? "It would link" : "To link next", count: d.nextCount },
            { key: "linked", label: "Linked", count: d.links.length },
            { key: "several", label: "Several companies", count: d.severalCount },
          ]} />
          <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a name, e-mail, country or company" sx={{ width: { xs: "100%", sm: 320 } }} />
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          {view === "next" && (
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead><TableRow>{["Contact", "Country", "The company", "Why", "Created"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {pNext.slice.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell sx={bodyCell}>{link(hsContact(x.id), x.name || x.email || x.id)}<Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(240) }}>{x.email}</Box></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: x.country ? INK : FAINT }}>{x.country || "—"}</TableCell>
                    <TableCell sx={bodyCell}>{x.v.company ? link(HS_COMPANY(x.v.company.id), x.v.company.name || x.v.company.id) : "—"}<Box sx={{ fontSize: "0.74rem", color: FAINT }}>{x.v.company?.mandant ?? ""}</Box></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{x.v.kind === "one" || x.v.kind === "mandant" ? WHY[x.v.kind] : ""}{x.v.of > 1 ? ` (${x.v.of} on the domain)` : ""}{x.written?.error ? <Box sx={{ color: "#b4232f" }}>{x.written.error}</Box> : null}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{x.created ? when(x.created) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {view === "linked" && (
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead><TableRow>{["Contact", "Linked to", "Why", "When"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {pLinked.slice.map((x) => (
                  <TableRow key={`${x.contact}-${x.at}`}>
                    <TableCell sx={bodyCell}>{link(hsContact(x.contact), x.name || x.email || x.contact)}<Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(240) }}>{x.email}</Box></TableCell>
                    <TableCell sx={bodyCell}>{link(HS_COMPANY(x.company), x.companyName || x.company)}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{WHY[x.kind]}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(x.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {view === "several" && (
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead><TableRow>{["Contact", "Country", "Companies on the domain", "Created"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {pSeveral.slice.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell sx={bodyCell}>{link(hsContact(x.id), x.name || x.email || x.id)}<Box sx={{ fontSize: "0.74rem", color: MUTED, ...clip(240) }}>{x.email}</Box></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: x.country ? INK : FAINT }}>{x.country || "no country - the Mandant cannot decide"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK }}>{full(x.v.of)}{x.v.mandant ? ` · none or several of ${x.v.mandant}` : ""}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{x.created ? when(x.created) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
        {view === "next" ? pNext.pager : view === "linked" ? pLinked.pager : pSeveral.pager}
        {view === "several" && <Typography sx={{ fontSize: "0.78rem", color: FAINT, mt: 1 }}>These are linked by a person in HubSpot - a shop account among them is also on Shop accounts, with its orders and customer number.</Typography>}
        {d.last?.error && <Typography sx={{ fontSize: "0.78rem", color: "#b4232f", mt: 1 }}>Last run {when(d.last.at)}: {d.last.error}</Typography>}
      </GlassCard>
    </>
  );
}
