"use client";

// BACK OFFICE DISTRIBUTION - the Flow tab (SARCLA 19.10.2026: "design on the flow is really not great, rethink it
// again"; GQS has its own tab). The last 7 days' Back Office tickets as one flow diagram, left to right: where a
// ticket came from, the rule of SARCLA | BACK OFFICE MAIN ROUTING that caught it, its category, the step that picked
// the owner, and who got it. Under it the key says how each column decides, in the workflow's own order; a box of the
// diagram or a line of the key narrows the tickets below to the ones that went through it. FlowCard, the key and the
// helpers are shared with the GQS tab.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { full } from "@/app/charts/format";
import { Sankey, type SankeyLink } from "@/app/charts/Sankey";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { ACCENT, CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, type Tint } from "@/app/uc/report/ui";
import { Choice } from "@/app/connectors/parts";
import type { Row } from "@/lib/boDistribution/engine";
import { SALES_SPLIT_SENDERS, type Person } from "@/lib/boDistribution/rules";

import { TicketTable, count, fixesDiffer, gave, sameOwner, type Data } from "./shared";

/* ── the flow card: diagram, key and filter (the GQS tab uses it too) ── */

export type FlowNode = {
  id: string; label: string; color: string; text?: React.ReactNode;
  /** the diagram's label, when the key's is too long for a column (at 1440px a middle column has room for about 13 letters) */
  short?: string;
  /** left out of the key while nobody went through it */
  quiet?: boolean;
};
export type FlowColumn = { title: string; how: string; nodes: FlowNode[] };
/** A ticket and its way through the columns: one node id per column. */
export type Way = { row: Row; way: string[] };

/** Colour = the kind of road, the same in both diagrams (palette.ts, validated). */
export const ROAD = { main: SERIES[0], special: SERIES[1], person: SERIES[2], fallback: SERIES[3], stop: DEEMPHASIS } as const;

/** The ways through every chosen node - one choice per column at most; `skip` leaves a column's choice out (the key's counts). */
export const through = (ways: Way[], sel: (string | null)[], skip = -1) => ways.filter((w) => sel.every((s, c) => c === skip || !s || w.way[c] === s));

/** The owner column: the most frequent people by name, the rest in one "Other people" box. */
export const NOBODY = "p:~nobody", NOT_HERE = "p:~none", OTHERS = "p:~others";
/** "Claudio Gabinato" -> "Claudio G." for the diagram; the key keeps the full name. */
const initial = (name: string) => { const w = name.trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : name; };
export function peopleColumn(names: (string | null)[], keep = 7) {
  const all = count(names, (x) => x);
  const top = new Set((all.length > keep + 1 ? all.slice(0, keep) : all).map((x) => x.label));
  const nodes: FlowNode[] = [...top].map((n) => ({ id: `p:${n}`, label: n, short: initial(n), color: ROAD.person }));
  if (top.size < all.length) nodes.push({ id: OTHERS, label: "Other people", short: "Others", color: ROAD.person, text: `${all.length - top.size} more, each with a few` });
  return { nodes, id: (name: string | null) => (name === null ? NOBODY : top.has(name) ? `p:${name}` : OTHERS) };
}
/** Who the ticket went to: the distribution step's own write in HubSpot, or - not settled yet - the copy's pick. */
export const ownerName = (r: Row) => (r.actual ? gave(r)?.name ?? null : r.legacy?.ownerName ?? null);

/** A priority as the router writes it. */
const PRIO_TINT: Record<"URGENT" | "HIGH" | "MEDIUM" | "LOW", Tint> = { URGENT: "pink", HIGH: "amber", MEDIUM: "blue", LOW: "slate" };
export function Prio({ p }: { p: keyof typeof PRIO_TINT }) {
  const t = TINT[PRIO_TINT[p]];
  return <Box component="span" sx={{ px: 0.5, py: "1px", borderRadius: "5px", bgcolor: t.bg, color: t.fg, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{p}</Box>;
}

const span = (sx: object) => ({ component: "span" as const, sx: { display: "block", ...sx } });

export function FlowCard({ title, note, icon, tint, columns, ways, sel, onPick, onClear, roads }: {
  title: string; note: string; icon: React.ReactNode; tint: Tint;
  columns: FlowColumn[]; ways: Way[]; sel: (string | null)[];
  onPick: (column: number, id: string) => void; onClear: () => void;
  /** what each colour means here */
  roads: { color: string; label: string }[];
}) {
  const shown = through(ways, sel);
  // the bands: each ticket from its node in one column to its node in the next
  const value = new Map<string, number>(), band = new Map<string, SankeyLink>();
  for (const w of shown) {
    w.way.forEach((id, c) => {
      value.set(id, (value.get(id) ?? 0) + 1);
      if (!c) return;
      const k = `${w.way[c - 1]}\u0001${id}`;
      const l = band.get(k) ?? { from: w.way[c - 1], to: id, value: 0 };
      l.value++;
      band.set(k, l);
    });
  }
  const nodes = columns.flatMap((col, c) => col.nodes.map((n) => ({ id: n.id, column: c, label: n.short ?? n.label, color: n.color })));
  // the boxes the diagram draws, top to bottom per column (it leaves out the empty ones, in the order given)
  const drawn = columns.map((col) => col.nodes.filter((n) => (value.get(n.id) ?? 0) > 0));
  const height = Math.max(380, Math.min(640, 90 + Math.max(0, ...drawn.map((x) => x.length)) * 36));
  // the key's counts: every other column's choice applied, so a line says what choosing it would show
  const facet = columns.map((_, c) => {
    const m = new Map<string, number>();
    for (const w of through(ways, sel, c)) m.set(w.way[c], (m.get(w.way[c]) ?? 0) + 1);
    return m;
  });
  const chosen = sel.map((s, c) => (s ? { c, node: columns[c].nodes.find((n) => n.id === s) } : null)).filter((x) => x?.node) as { c: number; node: FlowNode }[];

  // the diagram has no click of its own: a box is known by its column (its x) and its place in the column (its y)
  const click = (e: React.MouseEvent) => {
    const t = e.target as Element;
    if (t.tagName.toLowerCase() !== "rect") return;
    const svg = t.closest("svg");
    if (!svg) return;
    const rects = Array.from(svg.querySelectorAll("rect"));
    const x = (r: Element) => Number(r.getAttribute("x")), y = (r: Element) => Number(r.getAttribute("y"));
    const xs = [...new Set(rects.map(x))].sort((a, b) => a - b);
    const filled = drawn.map((v, c) => ({ v, c })).filter((z) => z.v.length);
    if (xs.length !== filled.length) return;
    const col = filled[xs.indexOf(x(t))];
    const same = rects.filter((r) => x(r) === x(t)).sort((a, b) => y(a) - y(b));
    if (!col || same.length !== col.v.length) return;
    const node = col.v[same.indexOf(t as SVGRectElement)];
    if (node) onPick(col.c, node.id);
  };

  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={icon} tint={tint} title={title} note={note} />
      {!!chosen.length && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{full(shown.length)} of {full(ways.length)} through</Typography>
          {chosen.map(({ c, node }) => (
            <Box key={node.id} component="button" type="button" onClick={() => onPick(c, node.id)} aria-label={`Remove ${node.label}`} sx={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1, pr: 0.6, py: 0.3, borderRadius: "999px",
              border: `1px solid ${ACCENT}`, bgcolor: "rgba(36,89,209,.08)", color: ACCENT, fontSize: "0.78rem", fontWeight: 700,
              "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
            }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: node.color }} />
              {node.label}<CloseIcon sx={{ fontSize: 14 }} />
            </Box>
          ))}
          <Box component="button" type="button" onClick={onClear} sx={{ all: "unset", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: MUTED, px: 0.75, "&:hover": { color: INK }, "&:focus-visible": { outline: `2px solid ${ACCENT}` } }}>Show all</Box>
        </Box>
      )}
      {shown.length ? (
        // the diagram needs its width: on a phone it scrolls inside the card, the page does not
        <Box sx={{ overflowX: "auto", overflowY: "hidden", mx: { xs: -0.5, md: 0 } }}>
          <Box onClick={click} sx={{ minWidth: 1000, "& svg rect": { cursor: "pointer" } }}>
            <Sankey height={height} columns={columns.map((c) => c.title)} nodes={nodes} links={[...band.values()]} format={(n) => full(n)} label={title} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ border: `1px dashed ${HAIRLINE}`, borderRadius: "14px", p: 4, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>{ways.length ? "No ticket went this way - take a choice away." : "No ticket in the last 7 days yet."}</Typography>
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mt: 1, mb: 2 }}>
        {roads.map((r) => (
          <Box key={r.label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: r.color }} />
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{r.label}</Typography>
          </Box>
        ))}
        <Typography sx={{ fontSize: "0.74rem", color: FAINT, ml: { md: "auto" } }}>
          <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Swipe the diagram sideways. </Box>Click a box or a line below to see its tickets.
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: `repeat(${columns.length}, minmax(0, 1fr))` }, gap: { xs: 2, lg: 1.5 }, borderTop: `1px solid ${HAIRLINE}`, pt: 2 }}>
        {columns.map((col, c) => (
          <Box key={col.title} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: "0.08em" }}>{c + 1} · {col.title}</Typography>
            <Typography sx={{ fontSize: "0.74rem", color: MUTED, lineHeight: 1.35, mt: 0.25, mb: 1 }}>{col.how}</Typography>
            <Box sx={{ display: "grid", gap: 0.25 }}>
              {col.nodes.filter((n) => !n.quiet || facet[c].get(n.id) || sel[c] === n.id).map((n) => {
                const k = facet[c].get(n.id) ?? 0, on = sel[c] === n.id;
                return (
                  <Box key={n.id} component="button" type="button" disabled={!k && !on} onClick={() => onPick(c, n.id)} aria-pressed={on} sx={{
                    all: "unset", boxSizing: "border-box", display: "grid", gridTemplateColumns: "10px minmax(0, 1fr) auto", columnGap: 0.9, alignItems: "start",
                    px: 0.9, py: 0.6, borderRadius: "10px", cursor: k || on ? "pointer" : "default", opacity: k || on ? 1 : 0.5,
                    border: `1px solid ${on ? ACCENT : "transparent"}`, bgcolor: on ? "rgba(36,89,209,.07)" : "transparent",
                    "&:hover": k || on ? { bgcolor: on ? "rgba(36,89,209,.1)" : "rgba(21,34,58,.04)" } : {},
                    "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 1 },
                  }}>
                    <Box component="span" sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: n.color, mt: "4px" }} />
                    <Box component="span" sx={{ minWidth: 0 }}>
                      <Box {...span({ fontSize: "0.8rem", fontWeight: 700, color: INK, lineHeight: 1.35 })}>{n.label}</Box>
                      {n.text && <Box {...span({ fontSize: "0.72rem", color: MUTED, lineHeight: 1.45, mt: 0.15 })}>{n.text}</Box>}
                    </Box>
                    <Box {...span({ fontSize: "0.8rem", fontWeight: 700, color: k ? INK : FAINT, fontVariantNumeric: "tabular-nums", lineHeight: 1.35 })}>{full(k)}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </GlassCard>
  );
}

/** One choice per column; choosing it again takes it away. */
export function useFlowChoice(columns: number) {
  const [sel, setSel] = useState<(string | null)[]>(() => Array(columns).fill(null));
  const pick = (c: number, id: string) => setSel((s) => s.map((x, i) => (i === c ? (x === id ? null : id) : x)));
  return { sel, pick, clear: () => setSel(Array(columns).fill(null)) };
}

export type Narrow = "all" | "different" | "fixes";
export const narrowRows = (rows: Row[], n: Narrow) => rows.filter((r) => n === "all" || (n === "different" ? !!r.actual && !!r.legacy && !sameOwner(r) : fixesDiffer(r)));
export const narrowOptions = (rows: Row[]) => [
  { key: "all" as const, label: "All", count: rows.length },
  { key: "different" as const, label: "HubSpot did otherwise", count: narrowRows(rows, "different").length },
  { key: "fixes" as const, label: "Fixes change it", count: narrowRows(rows, "fixes").length },
];

/* ── the Back Office road: path -> node ── */

/** Where a Back Office ticket went, read off the copy's path (its branch names in order), its step and what it sets. */
export type BoWay = { origin: string; rule: string; category: string; step: string };
const ROUTER: [string, string][] = [
  ["Registration/Website issue", "c:website"], ["PRODUCT PRICE", "c:price"], ["DELIVERY", "c:delivery"], ["MICROSOFT EXCLUSION", "c:microsoft"],
  ["INVOICING AND ACCOUNTING", "c:invoicing"], ["ORDER CANCELLATION", "c:cancel"], ["PRODUCT INFORMATION", "c:product"], ["ELSE -> Others", "c:others"],
];
const SET_CATEGORY: Record<string, string> = {
  "Website Issue": "c:website", "Product Price": "c:price", Delivery: "c:delivery", "Invoicing & Accounting": "c:invoicing",
  "Order Cancellation": "c:cancel", "Product Information": "c:product", Others: "c:others",
};
export function boWay(r: Row): BoWay | null {
  const route = r.route;
  if (!route) return null;
  const has = (b: string) => route.path.includes(b);
  // origin: MAIN ROUTING's two entry checks, then the source branch - first match wins
  const origin = has("C2S Problem") ? "o:c2s" : has("ANYSEALS") ? "o:anyseals" : has("CHAT") || has("AI CHAT") ? "o:chat"
    : has("EMAIL") ? "o:email" : has("FORM") ? "o:form" : has("ELSE (API / hub / UI)") ? "o:api" : "o:other";
  // rule: what caught it before (or instead of) the category router
  const rule = origin === "o:c2s" ? "r:c2s" : origin === "o:anyseals" ? "r:anyseals"
    : origin === "o:chat" ? (has("RESENT TO BO BY TSA") ? "r:chat-rose" : has("EXCLUDE SHOP BUG DANIEL") || has("EXCLUDE FORM 3D REQUESTS") ? "r:chat-left" : "r:chat-parked")
    : origin === "o:email" ? (has("GQS EXCLUSION AND MAILS") ? "r:tsr" : has("CHANGES OF ACCOUNT ADDRESS") ? "r:billing" : has("Sales") ? "r:rep"
      : has("STOPPED ORDERS") ? "r:stopped" : has("ESO/TSA PIPELINE REDIRECT") ? "r:back" : has("#22 classifier") ? "r:classifier" : "r:other")
    : has("CERTIFICATES AND MAIL TO CUSTOMER") ? "r:cert" : origin === "o:other" ? "r:other" : "r:given";
  // category: the router's branch; without the router, the category the path writes (billing, ERP export, stopped order)
  const category = ROUTER.find(([b]) => has(b))?.[1] ?? SET_CATEGORY[route.sets.enquiry_category ?? ""] ?? "c:none";
  const step = route.assigner ? `s:${route.assigner}` : route.sets.hubspot_owner_id ? "s:rose" : "s:none";
  return { origin, rule, category, step };
}

const names = (ps: Person[] | undefined, join = ", ") => (ps ?? []).map((p) => p.name.split(" ")[0]).join(join);

function boColumns(d: Data, owners: FlowNode[]): FlowColumn[] {
  const L = d.legacy;
  return [
    { title: "Origin", how: "One minute after entry: two checks, then the source - the first that matches wins", nodes: [
      { id: "o:c2s", label: "C2S problem", color: ROAD.special, text: "Subject has C2S PROBLEM, or a C2S order is set" },
      { id: "o:anyseals", label: "Anyseals file", short: "Anyseals", color: ROAD.stop, text: "Subject has Anyseals Stock" },
      { id: "o:chat", label: "Chat / AI chat", short: "Chat", color: ROAD.stop, text: "Never distributed" },
      { id: "o:email", label: "E-mail", color: ROAD.main, text: "Through the e-mail rules" },
      { id: "o:form", label: "Form", color: ROAD.main, text: "The form's own category" },
      { id: "o:api", label: "API / hub / UI", short: "API / hub", color: ROAD.main, text: "Anything else - like a form" },
      { id: "o:other", label: "Other", color: ROAD.stop, quiet: true },
    ] },
    { title: "Rule", how: "E-mails: these rules in this order, then the classifier; the rest keep their category", nodes: [
      { id: "r:c2s", label: "C2S check", color: ROAD.special, text: <>Delivery, existing order, late, <Prio p="URGENT" /> - then the router</> },
      { id: "r:anyseals", label: "Stock file", color: ROAD.stop, text: "Read by its own step, then resolved" },
      { id: "r:chat-parked", label: "Chat parked", color: ROAD.stop, text: "Moved to New BO Topic" },
      { id: "r:chat-rose", label: "Chat back from TSA", short: "Chat → Rose", color: ROAD.special, text: "Back to Redirected as CHAT REQUEST, owner Rose" },
      { id: "r:chat-left", label: "Chat left alone", short: "Chat left", color: ROAD.stop, text: "Shop bug (Other issue) or 3D request: left, to CAD or resolved" },
      { id: "r:tsr", label: "Task Status Report", short: "Status report", color: ROAD.special, text: "Waits 3 minutes, then merged into its GQS task" },
      { id: "r:billing", label: "Billing / ERP export", short: "Billing / ERP", color: ROAD.special, text: <>Billing address: Website issue / Login; ERP Order Export: Delivery - <Prio p="HIGH" /></> },
      { id: "r:rep", label: "Mail from a sales rep", short: "Sales rep", color: ROAD.special, text: `To sales@ from one of the ${SALES_SPLIT_SENDERS.length} reps: to ESO New with that rep` },
      { id: "r:stopped", label: "Stopped order", color: ROAD.special, text: <>PERFORMIS or AVOR | WSMB in the subject: delivery late, <Prio p="HIGH" /></> },
      { id: "r:back", label: "Back from ESO/TSA", short: "From ESO/TSA", color: ROAD.special, text: "Has been in ESO New or Redirected: Load Balancer, not classified" },
      { id: "r:classifier", label: "Keyword classifier", short: "Classifier", color: ROAD.main, text: "Category and sub-category from the subject and text (also mail to sales@ from anyone else)" },
      { id: "r:given", label: "Category as given", short: "As given", color: ROAD.main, text: "Form / API: the ticket's own category goes to the router" },
      { id: "r:cert", label: "Certificates / mail", short: "Certificates", color: ROAD.stop, text: "API / hub ticket with CERTIFICATES or MAIL TO CUSTOMER: stops" },
      { id: "r:other", label: "Other", color: ROAD.stop, quiet: true },
    ] },
    { title: "Category", how: "The router, in this order: it sets the priority; the step is General Distribution unless said", nodes: [
      { id: "c:website", label: "Website issue", color: ROAD.main, text: <>Login issue <Prio p="HIGH" /> → Assignment System; else <Prio p="MEDIUM" /></> },
      { id: "c:price", label: "Product price", color: ROAD.main, text: <>Request for quotation <Prio p="URGENT" /> → then ESO/TSA; else <Prio p="HIGH" /></> },
      { id: "c:delivery", label: "Delivery", color: ROAD.main, text: <>Existing / previous order <Prio p="URGENT" />, else <Prio p="HIGH" /> - also PERFORMIS / AVOR subjects</> },
      { id: "c:microsoft", label: "Microsoft quarantine", short: "Microsoft", color: ROAD.stop, text: "Subject has MICROSOFT: resolved, nobody assigned" },
      { id: "c:invoicing", label: "Invoicing & accounting", short: "Invoicing", color: ROAD.main, text: <>Invoice not received <Prio p="MEDIUM" />, else <Prio p="LOW" /></> },
      { id: "c:cancel", label: "Order cancellation", short: "Cancellation", color: ROAD.main, text: <><Prio p="URGENT" /></> },
      { id: "c:product", label: "Product information", short: "Product info", color: ROAD.main, text: <>Technical question / MOQ <Prio p="HIGH" /> → then ESO/TSA; data sheet <Prio p="MEDIUM" />, 3D model <Prio p="LOW" />, else <Prio p="HIGH" /></> },
      { id: "c:others", label: "Others (no match)", short: "Others", color: ROAD.fallback, text: <>Nothing recognised: set to Others, <Prio p="MEDIUM" /> → Load Balancer</> },
      { id: "c:none", label: "No category", color: ROAD.stop, text: "The path sets none" },
    ] },
    { title: "Step", how: "The code step that picks the owner; available = the green dot of HubSpot chat", nodes: [
      { id: "s:27", label: "General Distribution", short: "General", color: ROAD.main, text: `Sales Agent if available, then SA Sub, else the least busy available of ${names(L.team27)}` },
      { id: "s:42", label: "General, then ESO/TSA", short: "General → ESO", color: ROAD.main, text: "The same pick, then dispatch Send to ESO/TSA" },
      { id: "s:31", label: "Load Balancer", color: ROAD.main, text: `The same rule, in its own order: ${names(L.team31)}` },
      { id: "s:23", label: "Assignment System", short: "Assignment", color: ROAD.main, text: `${names(L.primary23, ", else ")} if available, else the least busy of ${names(L.team23)}` },
      { id: "s:50", label: "Task Status merge", short: "Status merge", color: ROAD.special, text: `The GQS task's owner (by its O-number); no task: least busy of ${names(L.team50)}` },
      { id: "s:75", label: "Sales split", color: ROAD.special, text: "The forwarding rep, in ESO New" },
      { id: "s:rose", label: "Straight to Rose", short: "To Rose", color: ROAD.special, text: "Set by the chat path" },
      { id: "s:none", label: "No owner step", short: "No step", color: ROAD.stop, text: "Parked, resolved or left alone - nobody assigned" },
    ] },
    { title: "Owner", how: "What the step gave in HubSpot; not settled yet: the copy's pick. Least busy = fewest open Back Office tickets", nodes: [
      ...owners,
      { id: NOBODY, label: "Nobody yet", color: ROAD.stop, text: "The step found nobody, or HubSpot has no owner yet" },
      { id: NOT_HERE, label: "Not assigned here", short: "Not assigned", color: ROAD.stop, text: "No owner step on the path" },
    ] },
  ];
}

const BO_ROADS = [
  { color: ROAD.main, label: "Usual road" }, { color: ROAD.special, label: "Rule of its own" }, { color: ROAD.fallback, label: "Nothing recognised" },
  { color: ROAD.person, label: "Person" }, { color: ROAD.stop, label: "No owner" },
];

export function FlowTab({ d }: { d: Data }) {
  const bo = d.rows.filter((r) => r.pipeline === "bo");
  const read = bo.map((r) => ({ r, w: boWay(r) })).filter((x): x is { r: Row; w: BoWay } => !!x.w);
  const owners = peopleColumn(read.filter((x) => x.w.step !== "s:none").map((x) => ownerName(x.r)).filter((n): n is string => !!n));
  const ways: Way[] = read.map(({ r, w }) => ({ row: r, way: [w.origin, w.rule, w.category, w.step, w.step === "s:none" ? NOT_HERE : owners.id(ownerName(r))] }));
  const columns = boColumns(d, owners.nodes);
  const { sel, pick, clear } = useFlowChoice(columns.length);
  const [narrow, setNarrow] = useState<Narrow>("all");
  const picked = through(ways, sel).map((w) => w.row);
  const replayed = read.filter((x) => x.r.approx).length, unread = bo.length - read.length;
  const chosen = sel.map((s, c) => columns[c].nodes.find((n) => n.id === s)?.label).filter(Boolean);
  return (
    <>
      <FlowCard
        icon={<AltRouteOutlinedIcon />} tint="blue" title="How the Back Office tickets were routed"
        note={`SARCLA | BACK OFFICE MAIN ROUTING, the last 7 days: ${full(read.length)} tickets${replayed ? `, ${full(replayed)} of them replayed (path exact, owner rough)` : ""}${unread ? ` - ${full(unread)} could not be read` : ""}`}
        columns={columns} ways={ways} sel={sel} onPick={pick} onClear={clear} roads={BO_ROADS}
      />
      <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
        <CardTitle icon={<HistoryOutlinedIcon />} tint="slate" title="The tickets"
          note={chosen.length ? `Through ${chosen.join(" › ")} - click a row for its path and reasons` : "All of them - click a box of the diagram to narrow down, a row for its path and reasons"}
          right={<Choice<Narrow> value={narrow} onChange={setNarrow} options={narrowOptions(picked)} />} />
        <TicketTable rows={narrowRows(picked, narrow)} empty="No ticket here." />
      </GlassCard>
    </>
  );
}
