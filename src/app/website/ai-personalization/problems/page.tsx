"use client";

// APSOconvert > INSIGHTS (was Problems; Website > AI testing & personalization). Pages with a lot of traffic and little buying, down to
// the customers behind them (src/lib/convert/problems.ts). Two lenses, side by side because they see different people:
// Google Analytics' views and add-to-carts (consented visitors, every page) and the shop's own record of every signed-in
// customer on a product page - the company, and the step where it stopped. A row opens its customers.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
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
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import RemoveShoppingCartOutlinedIcon from "@mui/icons-material/RemoveShoppingCartOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import TroubleshootOutlinedIcon from "@mui/icons-material/TroubleshootOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "next/link";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, AMBER, CardTitle, GREEN, GlassCard, KpiTile, MUTED, Notice, RED, TRACK, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ago, usePaged } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { KIND_LABEL, STEP_LABEL, classify, sortProblems, type PageKind, type RankBy, type Step } from "@/lib/convert/model";
import type { BoardRow } from "@/lib/convert/studio";

/** What is already being done on a page: its ideas (not dropped) and the versions ready to test. */
type Work = { ideas: number; ready: number; idea: string | null };
/** The ideas board by Insights' page key: a product is one page in every language ("product:12202510"). */
function workByKey(rows: BoardRow[]): Map<string, Work> {
  const out = new Map<string, Work>();
  for (const r of rows) {
    if (r.status === "dropped") continue;
    const c = classify(r.path);
    const key = c.kind === "product" && c.product ? `product:${c.product}` : `page:${r.path}`;
    const w = out.get(key) ?? { ideas: 0, ready: 0, idea: null };
    w.ideas += 1;
    if (r.version?.status === "approved") { w.ready += 1; w.idea = r.id; }
    out.set(key, w);
  }
  return out;
}
import type { PageCustomers, ProblemsData } from "@/lib/convert/problems";
import type { Brief } from "@/lib/convert/brief";
import { convertPost, previewHref } from "../Flow";
import { SquareChoice } from "../SquareChoice";
import { PageShot } from "../PageShot";
import { flowHref } from "../base";

const KIND_PLURAL: Record<PageKind, string> = { product: "Products", category: "Categories", cms: "CMS pages", home: "Home pages", system: "Other" };

const PORTAL = "26492587";
const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;
const hsContact = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-1/${id}`;
const SHOP = "https://www.apsoparts.com";
const SHOP_FROM = "2026-10-02";

const pct = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);
const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const STEP_TINT: Record<Step, "green" | "blue" | "amber" | "pink" | "slate" | "purple"> = {
  won: "green", cart: "purple", price: "amber", moq: "pink", shelf: "pink", looked: "slate",
};

type Row = ProblemsData["pages"][number];

// WHAT STOPS BUYERS - the AI's reading of the period's problem pages, grouped into themes, each with what to test first and
// its pages (src/lib/convert/brief.ts). Asked at a click, kept per period.
function WhatStops({ from, to, rows }: { from: string; to: string; rows: Row[] }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/website/ai-personalization/problems/brief?from=${from}&to=${to}&n=${tick}`;
  const held = useHeld<{ brief: Brief | null; canAsk: boolean; ai: boolean }>(url, [url]);
  const d = held.result?.state === "ok" ? held.result.data : null;
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  if (!d) return null;
  const b = d.brief;
  const ask = async () => {
    setBusy(true);
    setErr(null);
    const r = await convertPost<Brief>("/api/website/ai-personalization/problems/brief", { from, to });
    setBusy(false);
    if (!r.ok) setErr(r.error);
    else setTick((n) => n + 1);
  };
  return (
    <GlassCard>
      <CardTitle icon={<PsychologyOutlinedIcon />} tint="purple" title="What stops buyers"
        note={b ? `The AI's reading of ${b.pages} problem pages · ${ago(Date.parse(b.at) / 1000)}${b.by ? ` · asked by ${b.by}` : ""}` : "The AI groups this period's problem pages into themes, each with what to test first"}
        right={d.canAsk && d.ai ? (
          <Button size="small" variant={b ? "outlined" : "contained"} disableElevation disabled={busy} onClick={() => void ask()} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}
            startIcon={busy ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : <PsychologyOutlinedIcon sx={{ fontSize: 17 }} />}>
            {busy ? "The AI is reading… about half a minute" : b ? "Ask again" : "Ask the AI"}
          </Button>
        ) : undefined} />
      {err && <Box sx={{ mt: 1.5 }}><Notice tone="bad">{err}</Notice></Box>}
      {b && (
        <Box sx={{ mt: 1.5, display: "grid", gap: 1.5 }}>
          {b.headline && <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#15223a" }}>{b.headline}</Typography>}
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))", xl: "repeat(3, minmax(0,1fr))" } }}>
            {b.themes.map((t, i) => (
              <Box key={i} sx={{ p: 1.75, borderRadius: "14px", border: "1px solid rgba(21,34,58,.10)", bgcolor: "rgba(255,255,255,.65)", display: "grid", gap: 0.75, alignContent: "start" }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                  <Box component="span" sx={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "6px", bgcolor: "#6a46c9", color: "#fff", fontSize: "0.76rem", fontWeight: 700, display: "grid", placeItems: "center" }}>{i + 1}</Box>
                  <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#15223a", lineHeight: 1.3 }}>{t.title}</Typography>
                </Box>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{t.why}</Typography>
                <Typography sx={{ fontSize: "0.8rem", color: "#15223a" }}><b>Test first</b> {t.test}</Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
                  {t.keys.map((k) => {
                    const row = byKey.get(k);
                    if (!row) return null;
                    return (
                      <Box key={k} component={Link} href={previewHref("prod", row.path)} title={`${row.path} - open it in Preview`} sx={{
                        px: 0.9, py: 0.25, borderRadius: "6px", border: "1px solid rgba(36,89,209,.25)", bgcolor: "rgba(36,89,209,.06)", color: ACCENT,
                        fontSize: "0.72rem", fontWeight: 600, textDecoration: "none", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        "&:hover": { bgcolor: "rgba(36,89,209,.12)" },
                      }}>{row.name || row.path}{row.missed ? ` · ${full(row.missed)} missed` : ""}</Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      {!b && !d.ai && <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 1 }}>No AI key on this hub.</Typography>}
    </GlassCard>
  );
}

function Funnel({ f }: { f: NonNullable<Row["shop"]> }) {
  const max = Math.max(1, f.companies);
  // furthest step, in the order a customer goes: opened, served, minimum met, priced, cart, ordered
  const order: Step[] = ["looked", "shelf", "moq", "price", "cart", "won"];
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      {order.map((s) => (
        <Box key={s} sx={{ display: "grid", gridTemplateColumns: "190px 1fr 44px", gap: 1, alignItems: "center" }}>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{STEP_LABEL[s]}</Typography>
          <Box sx={{ height: 10, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${(f.furthest[s] / max) * 100}%`, bgcolor: s === "won" ? GREEN : s === f.topLoss ? RED : ACCENT, borderRadius: 99 }} />
          </Box>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(f.furthest[s])}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function Customers({ row, from, to }: { row: Row; from: string; to: string }) {
  const url = `/api/website/ai-personalization/customers?key=${encodeURIComponent(row.key)}&from=${from}&to=${to}`;
  const held = useHeld<PageCustomers>(url, [url]);
  const r = held.result;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [row.key]);
  const rows = r?.state === "ok" && r.data.kind === "product" ? r.data.customers : [];
  const { slice, pager } = usePaged(rows, 15);

  return (
    <Box ref={ref} sx={{ display: "grid", gap: 2.5, scrollMarginTop: 16 }}>
      <GlassCard>
        <CardTitle icon={<TroubleshootOutlinedIcon />} tint="pink" title={row.name || row.path}
          note={row.kind === "product" ? `Product ${row.product} - every language counts as one page` : KIND_LABEL[row.kind]} />
        {row.reasons.length > 0 && (
          <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5, display: "grid", gap: 0.5 }}>
            {row.reasons.map((t) => <Typography component="li" key={t} sx={{ fontSize: "0.86rem" }}>{t}</Typography>)}
          </Box>
        )}
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: row.shop ? 6 : 12 }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>Google Analytics, by address</Typography>
            {row.paths.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No views in Google Analytics in this period.</Typography>}
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {row.paths.slice(0, 8).map((p) => (
                <Box key={p.path} sx={{ display: "flex", gap: 1, alignItems: "center", fontSize: "0.84rem" }}>
                  <Box component="a" href={`${SHOP}${p.path}`} target="_blank" rel="noopener" sx={{ ...clip(360), color: ACCENT, textDecoration: "none" }} title={p.path}>{p.path}</Box>
                  <Typography component="span" sx={{ fontSize: "0.8rem", color: MUTED, ml: "auto", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {full(p.views)} views · {full(p.addToCarts)} to cart
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
          {row.shop && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", mb: 1 }}>
                Signed-in customers, by the furthest step · {full(row.shop.companies)}
              </Typography>
              <Funnel f={row.shop} />
            </Grid>
          )}
        </Grid>
      </GlassCard>

      <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
        <Box sx={{ px: { xs: 2, md: 2.75 } }}>
          <CardTitle icon={<GroupsOutlinedIcon />} tint="blue"
            title={r?.state === "ok" && r.data.kind === "page" ? `Contacts last seen on this page · ${r.data.total === null ? "–" : full(r.data.total)}` : `Customers · ${full(rows.length)}`}
            note={row.kind === "product"
              ? "Every company that opened one of its articles in the period, the ones closest to an order first"
              : "HubSpot keeps one page per contact - the last one - so this lists fewer people than saw the page"} />
        </Box>
        {r === null && <Box sx={{ px: 2.75, pb: 2.5 }}><LoadingPanel label="Reading the customers…" /></Box>}
        {r?.state === "error" && <Box sx={{ px: 2.75, pb: 2.5 }}><Notice tone="bad">{r.error}</Notice></Box>}
        {r?.state === "not-configured" && <Box sx={{ px: 2.75, pb: 2.5 }}><NotConnectedPanel source="HubSpot" missing={r.missing} /></Box>}
        {r?.state === "ok" && r.data.kind === "product" && (
          <>
            {r.data.shop.state !== "ready" && <Box sx={{ px: 2.75, pb: 1.5 }}><Notice tone="warn">The shop&apos;s record is still being read{r.data.shop.progress ? ` (${r.data.shop.progress})` : ""} - ask again in a minute.</Notice></Box>}
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow>{["Company", "Customer no.", "Country", "Stopped at", "Looks", "Articles", "Last look"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
                </TableHead>
                <TableBody>
                  {slice.length === 0 && <TableRow><TableCell colSpan={7} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>No signed-in customer opened it in this period.</TableCell></TableRow>}
                  {slice.map((c) => (
                    <TableRow key={c.companyId} hover>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                        <Box component="a" href={hsCompany(c.companyId)} target="_blank" rel="noopener" sx={{ display: "inline-flex", gap: 0.5, alignItems: "center", color: ACCENT, textDecoration: "none", fontWeight: 600 }}>
                          <Box component="span" sx={clip(260)}>{c.name}</Box><OpenInNewIcon sx={{ fontSize: 13 }} />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{c.customerNumber || "–"}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{c.country || "–"}</TableCell>
                      <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={STEP_TINT[c.step]}>{STEP_LABEL[c.step]}</Chip></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{full(c.looks)}</TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}><Box sx={clip(220)} title={c.articles.join(", ")}>{c.articles.join(", ")}</Box></TableCell>
                      <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{day(c.lastDay)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            {pager}
          </>
        )}
        {r?.state === "ok" && r.data.kind === "page" && (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>{["Contact", "Email", "Lifecycle stage", "Last seen", "Page views"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {r.data.people.length === 0 && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>HubSpot last saw nobody on this page.</TableCell></TableRow>}
                {r.data.people.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                      <Box component="a" href={hsContact(p.id)} target="_blank" rel="noopener" sx={{ display: "inline-flex", gap: 0.5, alignItems: "center", color: ACCENT, textDecoration: "none", fontWeight: 600 }}>
                        {p.name}<OpenInNewIcon sx={{ fontSize: 13 }} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{p.email ?? "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>{p.lifecycle ?? "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap" }}>{p.lastSeen ? day(p.lastSeen) : "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.pageViews === null ? "–" : full(p.pageViews)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </GlassCard>
    </Box>
  );
}

// THE PAGES, SHOWN (SARCLA 08.11.2026: "we should really show the pages, please improve a lot this multiple tabs with
// logic"): each page a card with its picture, the one reason it is on the list, three numbers, and where its
// customers stopped; one row of choices - which pages (by kind, with counts), the order, problems only - that never
// offers an empty choice; the table stays one click away for the long list.
type Sort = "missed" | "lost" | "views";
type Mode = "cards" | "table";
const KIND_TINT: Record<PageKind, "green" | "blue" | "purple" | "amber" | "slate"> = { product: "green", category: "blue", home: "purple", cms: "amber", system: "slate" };
const STEP_COLOR: Record<Step, string> = { looked: "#9aa6b8", shelf: "#d64b7a", moq: "#e07a9a", price: "#d99a2b", cart: "#7c4dff", won: "#1b7a55" };
const STEP_ORDER: Step[] = ["looked", "shelf", "moq", "price", "cart", "won"];
const PAGE_SIZE = 12;

function Stat({ k, v, sub, color }: { k: string; v: string; sub?: string; color?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{k}</Typography>
      <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: color ?? "#15223a", fontVariantNumeric: "tabular-nums", lineHeight: 1.3 }}>{v}</Typography>
      {sub && <Typography sx={{ fontSize: "0.7rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</Typography>}
    </Box>
  );
}

/** Where the signed-in customers of a product got to, as one bar: each colour a furthest step. */
function StepBar({ f }: { f: NonNullable<Row["shop"]> }) {
  const total = Math.max(1, f.companies);
  return (
    <Tooltip title={STEP_ORDER.filter((s) => f.furthest[s] > 0).map((s) => `${STEP_LABEL[s]}: ${f.furthest[s]}`).join(" · ")}>
      <Box sx={{ display: "flex", height: 8, borderRadius: "2px", overflow: "hidden", bgcolor: TRACK }}>
        {STEP_ORDER.map((s) => f.furthest[s] > 0 && <Box key={s} sx={{ width: `${(f.furthest[s] / total) * 100}%`, bgcolor: STEP_COLOR[s] }} />)}
      </Box>
    </Tooltip>
  );
}

function PageCard({ p, selected, onSelect, work }: { p: Row; selected: boolean; onSelect: () => void; work: Work | null }) {
  const low = p.rate !== null && p.typical ? p.rate < p.typical / 2 : false;
  const rateColor = p.rate === null || !p.typical ? undefined : low ? RED : p.rate < p.typical ? AMBER : GREEN;
  return (
    <Box sx={{
      display: "flex", flexDirection: "column", minWidth: 0, borderRadius: "14px", overflow: "hidden", bgcolor: "rgba(255,255,255,.92)",
      border: `1px solid ${selected ? ACCENT : "rgba(21,34,58,.10)"}`, boxShadow: selected ? `0 0 0 2px ${ACCENT}` : "0 6px 18px rgba(21,34,58,.06)",
      transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: selected ? `0 0 0 2px ${ACCENT}` : "0 10px 26px rgba(21,34,58,.12)", transform: "translateY(-1px)" },
    }}>
      <Box component={Link} href={previewHref("prod", p.path)} title="Open it in Preview" sx={{ position: "relative", display: "block", "&:hover .apx-open": { opacity: 1 } }}>
        <PageShot env="prod" path={p.path} label={p.name || p.path} />
        <Box sx={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 0.5 }}>
          <Chip tint={KIND_TINT[p.kind]}>{KIND_LABEL[p.kind]}</Chip>
          {p.kind === "product" && p.paths.length > 1 && <Chip tint="slate">{p.paths.length} languages</Chip>}
        </Box>
        {work && (
          <Box sx={{ position: "absolute", top: 8, right: 8 }}>
            <Chip tint={work.ready ? "green" : "purple"}>{work.ready ? `${work.ready} ready to test` : `In work · ${work.ideas} ${work.ideas === 1 ? "idea" : "ideas"}`}</Chip>
          </Box>
        )}
        <Box className="apx-open" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(21,34,58,.38)", opacity: 0, transition: "opacity .15s" }}>
          <Box sx={{ px: 1.5, py: 0.6, borderRadius: "6px", bgcolor: "#fff", color: ACCENT, fontSize: "0.82rem", fontWeight: 700 }}>Open in Preview</Box>
        </Box>
      </Box>
      <Box sx={{ p: 1.5, display: "grid", gap: 1.1, flex: 1, alignContent: "start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: "#15223a", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={p.name || p.path}>{p.name || p.path}</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: MUTED, ...clip(9999) }} title={p.path}>{p.kind === "product" ? `Product ${p.product}` : p.path}</Typography>
        </Box>
        {p.reasons[0]
          ? <Box sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
              <ReportProblemOutlinedIcon sx={{ fontSize: 16, color: RED, mt: "2px", flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.8rem", color: "#15223a", lineHeight: 1.35 }}>{p.reasons[0]}</Typography>
            </Box>
          : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Not on the problem list in this period.</Typography>}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1 }}>
          <Stat k="Views" v={p.views ? full(p.views) : "–"} />
          <Stat k="Cart rate" v={pct(p.rate)} sub={p.typical !== null ? `typical ${pct(p.typical)}` : undefined} color={rateColor} />
          {p.shop
            ? <Stat k="Lost" v={`${full(p.shop.lost)} of ${full(p.shop.companies)}`} sub={p.shop.topLoss ? STEP_LABEL[p.shop.topLoss] : undefined} color={p.shop.lost ? RED : undefined} />
            : <Stat k="Carts missed" v={p.missed ? full(p.missed) : "–"} color={p.missed ? RED : undefined} />}
        </Box>
        {p.shop && p.shop.companies > 0 && <StepBar f={p.shop} />}
        <Box sx={{ display: "flex", gap: 0.25, alignItems: "center", flexWrap: "nowrap", mt: "auto", pt: 0.25, "& .MuiButton-root": { minWidth: 0, whiteSpace: "nowrap" } }}>
          <Button size="small" variant="contained" disableElevation component={Link} href={work ? previewHref("prod", p.path, work.idea ?? undefined) : `${previewHref("prod", p.path)}&ask=1`} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 700, mr: 0.5 }}>{work ? "Continue" : "Find ideas"}</Button>
          <Button size="small" component={Link} href={flowHref(true, p.path)} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>Journeys</Button>
          <Button size="small" onClick={onSelect} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600, ml: "auto", color: selected ? ACCENT : MUTED }}>
            {selected ? "Hide customers" : p.kind === "product" ? "Customers" : "Contacts"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function PagesTable({ rows, sel, onSelect }: { rows: Row[]; sel: string | null; onSelect: (k: string) => void }) {
  const { slice, pager } = usePaged(rows, 25);
  return (
    <>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>{["Page", "Kind", "Views", "Cart rate", "Missed", "Customers", "Most stopped at", "Why"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {slice.map((p) => (
              <TableRow key={p.key} hover selected={p.key === sel} onClick={() => onSelect(p.key)} sx={{ cursor: "pointer" }}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                  <Box sx={{ ...clip(300), fontWeight: 600 }} title={p.path}>{p.name || p.path}</Box>
                  <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
                    {p.kind === "product" ? `${p.product} · ${p.paths.length} ${p.paths.length === 1 ? "language" : "languages"}` : p.path}
                    {" · "}
                    <Box component={Link} href={previewHref("prod", p.path)} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>Preview</Box>
                    {" · "}
                    <Box component={Link} href={flowHref(true, p.path)} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>Journeys</Box>
                  </Typography>
                </TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={KIND_TINT[p.kind]}>{KIND_LABEL[p.kind]}</Chip></TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.views ? full(p.views) : "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {pct(p.rate)}{p.typical !== null && p.rate !== null && <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}> / {pct(p.typical)}</Typography>}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.missed ? full(p.missed) : "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{p.shop ? `${full(p.shop.lost)} of ${full(p.shop.companies)} lost` : "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{p.shop?.topLoss ? <Chip tint={STEP_TINT[p.shop.topLoss]}>{STEP_LABEL[p.shop.topLoss]}</Chip> : "–"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}><Box sx={clip(320)} title={p.reasons.join(" · ")}>{p.reasons[0] ?? "–"}</Box></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {pager}
    </>
  );
}

export default function ConvertProblems() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [sort, setSort] = useState<Sort>("missed");
  const [kind, setKind] = useState<PageKind | "all">("all");
  const [only, setOnly] = useState(true);
  const [mode, setMode] = useState<Mode>("cards");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [sel, setSel] = useState<string | null>(null);
  const url = `/api/website/ai-personalization/problems?from=${win.from}&to=${win.to}&n=${tick}`;
  const held = useHeld<ProblemsData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;

  // the shop's record still being read: ask again in twenty seconds
  useEffect(() => {
    if (d?.shop.state !== "computing") return;
    const t = setTimeout(() => setTick((n) => n + 1), 20_000);
    return () => clearTimeout(t);
  }, [d?.shop.state, tick]);

  const board = useHeld<{ ideas: BoardRow[] }>("/api/website/ai-personalization/ideas", []);
  const work = useMemo(() => workByKey(board.result?.state === "ok" ? board.result.data.ideas : []), [board.result]);
  const view = useMemo(() => {
    const all = (d?.pages ?? []) as Row[];
    const problems = all.filter((p) => p.reasons.length > 0);
    // no page crosses the problem line: the most viewed pages, said so, instead of an empty list
    const onlyProblems = only && problems.length > 0;
    const pool = onlyProblems ? problems : all;
    const kinds = (["product", "category", "cms", "home"] as PageKind[]).map((k) => ({ key: k, n: pool.filter((p) => p.kind === k).length })).filter((k) => k.n > 0);
    const k: PageKind | "all" = kind !== "all" && kinds.some((x) => x.key === kind) ? kind : "all";
    const inKind = pool.filter((p) => k === "all" || p.kind === k);
    const withShop = inKind.some((p) => p.shop && p.shop.companies > 0);
    const s: Sort = sort === "lost" && !withShop ? "missed" : sort;
    const rows = s === "views" ? [...inKind].sort((a, b) => b.views - a.views) : (sortProblems(inKind, s) as Row[]);
    return {
      rows, k, s, kinds, withShop, onlyProblems, noProblems: only && problems.length === 0 && all.length > 0, pool: pool.length,
      flagged: problems.length,
      missed: problems.reduce((sum, p) => sum + p.missed, 0),
      lost: all.reduce((sum, p) => sum + (p.shop?.lost ?? 0), 0),
      looked: all.reduce((sum, p) => sum + (p.shop?.companies ?? 0), 0),
    };
  }, [d, sort, kind, only]);
  useEffect(() => { setShown(PAGE_SIZE); }, [view.k, view.s, only]);
  const selected = sel ? (d?.pages.find((p) => p.key === sel) ?? null) : null;
  const pick = (k: string) => setSel((cur) => (cur === k ? null : k));

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading Google Analytics and the shop's record…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="the hub" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Insights" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else {
    const data = r.data;
    body = (
      <>
        {!data.ga4.configured && <Notice tone="warn">Google Analytics is not connected on this hub - the views and add-to-carts are missing.</Notice>}
        {data.ga4.error && <Notice tone="bad">Google Analytics did not answer: {data.ga4.error}</Notice>}
        {data.ga4.truncated && <Notice tone="warn">Google Analytics gave the {full(data.ga4.addresses)} most viewed addresses only - the least viewed are missing.</Notice>}
        {data.shop.state === "computing" && <Notice tone="warn">The shop&apos;s record is being read{data.shop.progress ? ` (${data.shop.progress})` : ""} - the customers appear when it is done; this page asks again by itself.</Notice>}
        {data.shop.state === "error" && <Notice tone="bad">The shop&apos;s record could not be read: {data.shop.error}</Notice>}
        {data.from < SHOP_FROM && <Notice tone="warn">The shop&apos;s record of customers starts on 2 October 2026 - before that, Google Analytics only.</Notice>}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ReportProblemOutlinedIcon />} tint="pink" label="Pages losing buyers" value={full(view.flagged)} note={`of ${full(data.pages.length)} with traffic or customers`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<RemoveShoppingCartOutlinedIcon />} tint="amber" label="Add-to-carts missed" value={full(view.missed)} note="on those pages, at the typical rate" /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PersonOffOutlinedIcon />} tint="purple" label="Customers lost" value={full(view.lost)} note={`did not order, of ${full(view.looked)} who opened a product`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddShoppingCartOutlinedIcon />} tint="green" label="Typical cart rate" value={pct(data.typical.product)} note={`product pages · categories ${pct(data.typical.category)}`} /></Grid>
        </Grid>

        <GlassCard sx={{ p: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: "flex", gap: 1.5, rowGap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
            <SquareChoice<PageKind | "all"> label="Pages" value={view.k} onChange={setKind}
              options={[{ key: "all", label: "All", count: view.pool }, ...view.kinds.map((x) => ({ key: x.key, label: KIND_PLURAL[x.key], count: x.n }))]} />
            <Box sx={{ flex: 1 }} />
            <SquareChoice<Sort> label="Order" value={view.s} onChange={setSort}
              options={[{ key: "missed", label: "Carts missed" }, { key: "lost", label: "Customers lost", disabled: !view.withShop }, { key: "views", label: "Views" }]} />
            <FormControlLabel sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: "0.8rem", fontWeight: 600, color: "#15223a" } }}
              control={<Switch size="small" checked={only && view.flagged > 0} disabled={view.flagged === 0} onChange={(e) => setOnly(e.target.checked)} />}
              label={`Only problems · ${full(view.flagged)}`} />
            <SquareChoice<Mode> value={mode} onChange={setMode} options={[{ key: "cards", label: "Pages" }, { key: "table", label: "Table" }]} />
          </Box>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>
            {view.noProblems
              ? `No page crosses the problem line in this period - the pages with the most views instead.`
              : `A problem: ${full(data.minViews)}+ views and less than half the typical cart rate, or ${data.minCompanies}+ customers opened it and most did not order.`}
          </Typography>
        </GlassCard>

        {view.rows.length === 0 && <Notice tone="warn">No page with traffic or customers in this period.</Notice>}
        {mode === "cards" && view.rows.length > 0 && (
          <>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
              {view.rows.slice(0, shown).map((p) => <PageCard key={p.key} p={p} selected={p.key === sel} onSelect={() => pick(p.key)} work={work.get(p.key) ?? null} />)}
            </Box>
            {view.rows.length > shown && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Button variant="outlined" onClick={() => setShown((n) => n + PAGE_SIZE)} sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>
                  Show {Math.min(PAGE_SIZE, view.rows.length - shown)} more · {full(view.rows.length - shown)} left
                </Button>
              </Box>
            )}
          </>
        )}
        {mode === "table" && view.rows.length > 0 && (
          <GlassCard sx={{ p: 0, pt: 1 }}><PagesTable rows={view.rows} sel={sel} onSelect={pick} /></GlassCard>
        )}

        {selected && <Customers key={selected.key} row={selected} from={data.from} to={data.to} />}

        {view.flagged > 0 && <WhatStops from={data.from} to={data.to} rows={data.pages as Row[]} />}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Problem pages"
        subtitle="The pages that lose buyers, as they look - with their numbers and the customers behind them"
        rightSlot={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <WindowPicker />
            {(r === null || held.stale) && <CircularProgress size={14} sx={{ color: MUTED }} />}
            <Tooltip title="Ask again">
              <IconButton size="small" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><RefreshIcon sx={{ fontSize: 18, color: MUTED }} /></IconButton>
            </Tooltip>
          </Box>
        }
      />
      {body}
    </Box>
  );
}
