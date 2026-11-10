"use client";

// DUPLICATES & MERGES > Companies - the groups as a table to work with (SARCLA 10.11.2026: "possible duplicates should be
// much more detailed, with more properties - address, city, customer number, company unique number - really allow to
// filter and to play with the table to decide"). A group = a header row (what they share, why, when it came, the
// decision) and a row per company with its properties; filters, the order, the columns shown, a download of what is
// filtered.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SwipeOutlinedIcon from "@mui/icons-material/SwipeOutlined";
import { full } from "@/app/charts/format";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import type { Company, Group } from "@/lib/companyDuplicates/rules";
import { KIND_LABEL, cap, dmy, kindOf, link, numberText, type Kind } from "./parts";
import { Review } from "./Review";

// The table fits the page (SARCLA 10.11.2026: "tables are still broken" - 14 columns ran past the card's right edge, the
// last order and the group's count cut off): the place in one column (street, postcode and town, country), the customer
// number with the company unique number under it, deals and contacts together; each column a share of the width, the
// text wraps inside it. The download keeps every field in its own column.
const lines = (...xs: (React.ReactNode | null | undefined | false)[]) => (
  <>{xs.filter((x) => x !== null && x !== undefined && x !== false && x !== "").map((x, i) => <Box key={i} component="span" sx={{ display: "block", ...(i ? { fontSize: "0.74rem", color: MUTED } : {}) }}>{x}</Box>)}</>
);
const placeOf = (c: Company) => [c.zip, c.city].filter(Boolean).join(" ");
type Col = { key: string; label: string; cell: (c: Company) => React.ReactNode; on: boolean; weight: number; right?: boolean };
const COLS: Col[] = [
  { key: "address", label: "Address", cell: (c) => lines(c.address || placeOf(c) || "—", c.address ? placeOf(c) : null, cap(c.country)), on: true, weight: 19 },
  { key: "number", label: "Customer number", cell: (c) => lines(c.erp ? <b>{numberText(c)}</b> : <Box component="span" sx={{ color: FAINT }}>{numberText(c)}</Box>, c.unique), on: true, weight: 12 },
  { key: "website", label: "Website", cell: (c) => c.domain ?? "—", on: true, weight: 12 },
  { key: "phone", label: "Phone", cell: (c) => c.phone ?? "—", on: false, weight: 10 },
  { key: "owner", label: "Owner", cell: (c) => c.ownerName ?? (c.owner ? `owner ${c.owner}` : "—"), on: true, weight: 10 },
  { key: "created", label: "Created", cell: (c) => dmy(c.createdate), on: true, weight: 8 },
  { key: "lastOrder", label: "Last order", cell: (c) => (c.lastOrder ? dmy(c.lastOrder) : c.lastYear ? String(c.lastYear) : "—"), on: true, weight: 8 },
  { key: "revenue", label: "Revenue this year", cell: (c) => (c.revenue ? full(c.revenue) : "—"), on: false, weight: 9, right: true },
  { key: "deals", label: "Deals · contacts", cell: (c) => `${full(c.deals)} · ${full(c.contacts)}`, on: true, weight: 8, right: true },
];
const NAME_WEIGHT = 20;
/** The download: every field on its own. */
const EXPORT: { label: string; text: (c: Company) => string }[] = [
  { label: "Address", text: (c) => c.address ?? "" }, { label: "Postcode", text: (c) => c.zip ?? "" }, { label: "City", text: (c) => c.city ?? "" },
  { label: "Country", text: (c) => cap(c.country) }, { label: "Customer number", text: (c) => numberText(c) }, { label: "Company unique number", text: (c) => c.unique ?? "" },
  { label: "Website", text: (c) => c.domain ?? "" }, { label: "Phone", text: (c) => c.phone ?? "" }, { label: "Owner", text: (c) => c.ownerName ?? c.owner ?? "" },
  { label: "Created", text: (c) => dmy(c.createdate) }, { label: "Last order", text: (c) => (c.lastOrder ? dmy(c.lastOrder) : c.lastYear ? String(c.lastYear) : "") },
  { label: "Revenue this year", text: (c) => String(c.revenue || "") }, { label: "Deals", text: (c) => String(c.deals) }, { label: "Contacts", text: (c) => String(c.contacts) },
];
const PAGE = 25;
type Came = "any" | "30" | "90" | "365" | "load";
type Sort = "newest" | "oldest" | "country" | "name" | "deals" | "size";
type Has = "any" | "one" | "none";
const LOAD = (d: string | null) => !!d && (d.startsWith("2026-02-14") || d.startsWith("2026-02-15"));

const sel = (label: string, value: string, onChange: (v: string) => void, options: { v: string; l: string }[], width = 170) => (
  <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: width }}
    slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } } } }}>
    {options.map((o) => <MenuItem key={o.v} value={o.v}>{o.l}</MenuItem>)}
  </TextField>
);

function csv(groups: Group[]) {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const head = ["Group", "Shared", "Why", "Keeps", "Company id", "Company", ...EXPORT.map((c) => c.label)];
  const out = [head.map(q).join(";")];
  groups.forEach((g, i) => { for (const c of g.members) out.push([i + 1, KIND_LABEL[kindOf(g)], g.why, c.id === g.into ? "yes" : "", c.id, c.name, ...EXPORT.map((col) => col.text(c))].map(q).join(";")); });
  return `﻿${out.join("\r\n")}`;
}

export function GroupTable({ title, hint, groups, decide, file, icon, review }: {
  title: string; hint: string; groups: Group[]; file: string; icon: React.ReactNode;
  /** the decision on a group's row - none for what was left alone */
  decide?: (g: Group) => React.ReactNode;
  /** "One by one": the groups as filtered, a group at a time (SARCLA 10.11.2026: "a swipe mode") */
  review?: boolean;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [country, setCountry] = useState("all");
  const [owner, setOwner] = useState("all");
  const [has, setHas] = useState<Has>("any");
  const [size, setSize] = useState<"any" | "2" | "3">("any");
  const [came, setCame] = useState<Came>("any");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(0);
  const [cols, setCols] = useState<Record<string, boolean>>(() => Object.fromEntries(COLS.map((c) => [c.key, c.on])));
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [reviewing, setReviewing] = useState<Group[] | null>(null);

  const kinds = useMemo(() => [...new Set(groups.map(kindOf))], [groups]);
  const countries = useMemo(() => [...new Set(groups.flatMap((g) => g.members.map((c) => cap(c.country))))].filter((x) => x !== "—").sort(), [groups]);
  const owners = useMemo(() => [...new Set(groups.flatMap((g) => g.members.map((c) => c.ownerName ?? "")).filter(Boolean))].sort(), [groups]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const now = Date.now();
    const since = came === "any" || came === "load" ? null : new Date(now - Number(came) * 86400_000).toISOString();
    const out = groups.filter((g) => {
      if (kind !== "all" && kindOf(g) !== kind) return false;
      if (country !== "all" && !g.members.some((c) => cap(c.country) === country)) return false;
      if (owner !== "all" && !g.members.some((c) => c.ownerName === owner)) return false;
      if (has === "one" && !g.members.some((c) => c.erp)) return false;
      if (has === "none" && g.members.some((c) => c.erp)) return false;
      if (size === "2" && g.members.length !== 2) return false;
      if (size === "3" && g.members.length < 3) return false;
      if (since && (g.newest ?? "") < since) return false;
      if (came === "load" && !g.members.some((c) => LOAD(c.createdate))) return false;
      if (words.length) {
        const hay = [g.why, ...g.members.flatMap((c) => [c.name, c.address, c.zip, c.city, c.erp, c.unique, c.domain, c.ownerName, c.id])].filter(Boolean).join(" ").toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const deals = (g: Group) => g.members.reduce((a, c) => a + c.deals, 0);
    const name = (g: Group) => (g.members.find((c) => c.id === g.into) ?? g.members[0]).name.toLowerCase();
    const by: Record<Sort, (a: Group, b: Group) => number> = {
      newest: (a, b) => (b.newest ?? "").localeCompare(a.newest ?? ""),
      oldest: (a, b) => (a.newest ?? "").localeCompare(b.newest ?? ""),
      country: (a, b) => cap(a.members[0].country).localeCompare(cap(b.members[0].country)) || name(a).localeCompare(name(b)),
      name: (a, b) => name(a).localeCompare(name(b)),
      deals: (a, b) => deals(b) - deals(a),
      size: (a, b) => b.members.length - a.members.length || (b.newest ?? "").localeCompare(a.newest ?? ""),
    };
    return [...out].sort(by[sort]);
  }, [groups, q, kind, country, owner, has, size, came, sort]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const at = Math.min(page, pages - 1);
  const slice = shown.slice(at * PAGE, at * PAGE + PAGE);
  const visible = COLS.filter((c) => cols[c.key]);
  const span = visible.length + 1;
  const weights = NAME_WEIGHT + visible.reduce((a, c) => a + c.weight, 0);
  const reset = () => setPage(0);
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv(shown)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${file}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={icon} tint="purple" title={title} note={hint}
        right={
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {review && <Button size="small" variant="contained" disableElevation startIcon={<SwipeOutlinedIcon />} disabled={!shown.length} onClick={() => setReviewing(shown)} sx={{ textTransform: "none" }}>One by one</Button>}
            <Button size="small" variant="outlined" startIcon={<ViewColumnOutlinedIcon />} onClick={(e) => setMenu(e.currentTarget)} sx={{ textTransform: "none" }}>Columns</Button>
            <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} disabled={!shown.length} onClick={download} sx={{ textTransform: "none" }}>Download</Button>
          </Box>
        } />
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {COLS.map((c) => (
          <MenuItem key={c.key} dense onClick={() => setCols((x) => ({ ...x, [c.key]: !x[c.key] }))}>
            <Checkbox size="small" checked={!!cols[c.key]} sx={{ p: 0.5, mr: 1 }} />
            <ListItemText primary={c.label} />
          </MenuItem>
        ))}
      </Menu>

      {kinds.length > 1 && (
        <Box sx={{ mb: 1.5 }}>
          <Choice value={kind} onChange={(k) => { setKind(k); reset(); }} options={[
            { key: "all", label: "All", count: groups.length },
            ...kinds.map((k) => ({ key: k, label: KIND_LABEL[k], count: groups.filter((g) => kindOf(g) === k).length })),
          ]} />
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 1.5 }}>
        <TextField size="small" label="Search" placeholder="Name, street, postcode, number, website, owner…" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} sx={{ minWidth: 280, flex: "1 1 280px" }} />
        {sel("Country", country, (v) => { setCountry(v); reset(); }, [{ v: "all", l: "Every country" }, ...countries.map((c) => ({ v: c, l: c }))], 160)}
        {sel("Owner", owner, (v) => { setOwner(v); reset(); }, [{ v: "all", l: "Every owner" }, ...owners.map((o) => ({ v: o, l: o }))], 170)}
        {sel("Customer number", has, (v) => { setHas(v as Has); reset(); }, [{ v: "any", l: "Any" }, { v: "one", l: "One of them has one" }, { v: "none", l: "None of them has one" }], 190)}
        {sel("Companies", size, (v) => { setSize(v as "any" | "2" | "3"); reset(); }, [{ v: "any", l: "Any number" }, { v: "2", l: "Two" }, { v: "3", l: "Three or more" }], 140)}
        {sel("Came", came, (v) => { setCame(v as Came); reset(); }, [{ v: "any", l: "Any time" }, { v: "30", l: "Last 30 days" }, { v: "90", l: "Last 90 days" }, { v: "365", l: "Last 12 months" }, { v: "load", l: "The load of 14-15.02.2026" }], 190)}
        {sel("Order", sort, (v) => { setSort(v as Sort); reset(); }, [{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }, { v: "country", l: "By country" }, { v: "name", l: "By name" }, { v: "deals", l: "Most deals" }, { v: "size", l: "Most companies" }], 150)}
      </Box>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, mb: 1 }}>
        {full(shown.length)} of {full(groups.length)} groups · {full(shown.reduce((a, g) => a + g.members.length, 0))} companies{shown.length > PAGE ? ` · page ${at + 1} of ${pages}` : ""}
      </Typography>

      <Box sx={{ overflowX: "auto", border: `1px solid ${HAIRLINE}`, borderRadius: "12px" }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 900 }}>
          <colgroup>
            <col style={{ width: `${(NAME_WEIGHT / weights) * 100}%` }} />
            {visible.map((c) => <col key={c.key} style={{ width: `${(c.weight / weights) * 100}%` }} />)}
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headCell, whiteSpace: "normal" }}>Company</TableCell>
              {visible.map((c) => <TableCell key={c.key} sx={{ ...headCell, whiteSpace: "normal", ...(c.right ? { textAlign: "right" } : {}) }}>{c.label}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {!slice.length && <TableRow><TableCell colSpan={span} sx={{ ...bodyCell, color: FAINT, fontSize: "0.82rem" }}>Nothing with these filters.</TableCell></TableRow>}
            {slice.map((g, i) => (
              <GroupRows key={g.key} g={g} n={at * PAGE + i + 1} visible={visible} span={span} decide={decide} />
            ))}
          </TableBody>
        </Table>
      </Box>
      {pages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, mt: 1 }}>
          <Button size="small" startIcon={<ChevronLeftIcon />} disabled={at === 0} onClick={() => setPage(at - 1)} sx={{ textTransform: "none" }}>Previous</Button>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{at + 1} / {pages}</Typography>
          <Button size="small" endIcon={<ChevronRightIcon />} disabled={at >= pages - 1} onClick={() => setPage(at + 1)} sx={{ textTransform: "none" }}>Next</Button>
        </Box>
      )}
      {reviewing && <Review groups={reviewing} onClose={() => setReviewing(null)} />}
    </GlassCard>
  );
}

function GroupRows({ g, n, visible, span, decide }: { g: Group; n: number; visible: Col[]; span: number; decide?: (g: Group) => React.ReactNode }) {
  const merges = g.kind === "erp" || g.kind === "possible";
  return (
    <>
      <TableRow sx={{ bgcolor: "rgba(21,34,58,.035)" }}>
        <TableCell colSpan={span} sx={{ ...bodyCell, py: 0.9 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography component="span" sx={{ fontSize: "0.76rem", fontWeight: 800, color: FAINT, minWidth: 34 }}>#{n}</Typography>
            {decide && decide(g)}
            <Chip tint={g.kind === "erp" ? "green" : g.kind === "possible" ? (g.otherNames ? "amber" : "purple") : "slate"}>{KIND_LABEL[kindOf(g)]}</Chip>
            <Typography component="span" sx={{ fontSize: "0.82rem", color: INK, fontWeight: 600, flex: "1 1 260px", minWidth: 0 }}>{g.why}</Typography>
            <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap" }}>{g.members.length} companies · came {dmy(g.newest)}</Typography>
          </Box>
        </TableCell>
      </TableRow>
      {g.members.map((c) => {
        const keeps = merges && c.id === g.into;
        return (
          <TableRow key={c.id} sx={{ bgcolor: keeps ? "rgba(27,122,85,.05)" : undefined }}>
            <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", pl: 2.5, verticalAlign: "top", overflowWrap: "anywhere" }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0, flexWrap: "wrap" }}>
                {link(c.id, c.name)}
                {keeps && <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, color: TINT.green.fg, bgcolor: TINT.green.bg, px: 0.75, py: 0.1, borderRadius: "6px", whiteSpace: "nowrap" }} title="The others go into this company">keeps</Box>}
              </Box>
            </TableCell>
            {visible.map((col) => <TableCell key={col.key} sx={{ ...bodyCell, fontSize: "0.8rem", color: INK, verticalAlign: "top", overflowWrap: "anywhere", ...(col.right ? { textAlign: "right", fontVariantNumeric: "tabular-nums" } : {}) }}>{col.cell(c)}</TableCell>)}
          </TableRow>
        );
      })}
    </>
  );
}
