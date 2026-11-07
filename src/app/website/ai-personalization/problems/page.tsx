"use client";

// APSOconvert > PROBLEMS (Website > AI testing & personalization). Pages with a lot of traffic and little buying, down to
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
import Link from "next/link";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, GREEN, GlassCard, KpiTile, MUTED, Notice, RED, TRACK, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Choice, Chip, usePaged } from "@/app/connectors/parts";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { KIND_LABEL, STEP_LABEL, sortProblems, type PageKind, type RankBy, type Step } from "@/lib/convert/model";
import type { PageCustomers, ProblemsData } from "@/lib/convert/problems";
import { Flow, previewHref } from "../Flow";

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

export default function ConvertProblems() {
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const [by, setBy] = useState<RankBy>("missed");
  const [kind, setKind] = useState<PageKind | "all">("all");
  const [flagged, setFlagged] = useState<"flagged" | "all">("flagged");
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

  const view = useMemo(() => {
    const all = d?.pages ?? [];
    const rows = sortProblems(all.filter((p) => (kind === "all" || p.kind === kind) && (flagged === "all" || p.reasons.length > 0)), by) as Row[];
    const flaggedRows = all.filter((p) => p.reasons.length > 0);
    return {
      rows,
      flagged: flaggedRows.length,
      missed: flaggedRows.reduce((s, p) => s + p.missed, 0),
      lost: all.reduce((s, p) => s + (p.shop?.lost ?? 0), 0),
      looked: all.reduce((s, p) => s + (p.shop?.companies ?? 0), 0),
      kinds: (["product", "category", "cms", "home"] as PageKind[]).map((k) => ({ key: k, n: all.filter((p) => p.kind === k && (flagged === "all" || p.reasons.length > 0)).length })),
    };
  }, [d, by, kind, flagged]);
  const { slice, pager, setPage } = usePaged(view.rows, 25);
  useEffect(() => { setPage(0); }, [by, kind, flagged, setPage]);
  const selected = sel ? (d?.pages.find((p) => p.key === sel) ?? null) : null;

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading Google Analytics and the shop's record…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="the hub" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Problems" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
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
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ReportProblemOutlinedIcon />} tint="pink" label="Pages with a problem" value={full(view.flagged)} note={`of ${full(data.pages.length)} with traffic or customers`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<RemoveShoppingCartOutlinedIcon />} tint="amber" label="Add-to-carts missed" value={full(view.missed)} note="on those pages, at the typical rate" /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PersonOffOutlinedIcon />} tint="purple" label="Customers lost" value={full(view.lost)} note={`did not order, of ${full(view.looked)} who opened a product`} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<AddShoppingCartOutlinedIcon />} tint="green" label="Typical cart rate" value={pct(data.typical.product)} note={`product pages · categories ${pct(data.typical.category)}`} /></Grid>
        </Grid>

        <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
          <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1.5 }}>
            <CardTitle icon={<ReportProblemOutlinedIcon />} tint="pink" title={`Pages · ${full(view.rows.length)}`}
              note={`A problem: ${full(data.minViews)}+ views and less than half the typical cart rate, or ${data.minCompanies}+ customers opened it and most did not order`} />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              <Choice<RankBy> value={by} onChange={setBy} options={[{ key: "missed", label: "Most add-to-carts missed" }, { key: "lost", label: "Most customers lost" }]} />
              <Choice<"flagged" | "all"> value={flagged} onChange={setFlagged} options={[{ key: "flagged", label: "Problems", count: view.flagged }, { key: "all", label: "Every page" }]} />
            </Box>
            <Choice<PageKind | "all"> value={kind} onChange={setKind} options={[{ key: "all", label: "Every kind" }, ...view.kinds.filter((k) => k.n > 0).map((k) => ({ key: k.key, label: KIND_LABEL[k.key], count: k.n }))]} />
          </Box>
          <Box sx={{ overflowX: "auto", mt: 1.5 }}>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>{["Page", "Kind", "Views", "Cart rate", "Missed", "Customers", "Most stopped at", "Why"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {slice.length === 0 && <TableRow><TableCell colSpan={8} sx={{ ...bodyCell, fontSize: "0.84rem", color: MUTED }}>No page on this list for this period.</TableCell></TableRow>}
                {slice.map((p) => (
                  <TableRow key={p.key} hover selected={p.key === sel} onClick={() => setSel(p.key === sel ? null : p.key)} sx={{ cursor: "pointer" }}>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem" }}>
                      <Box sx={{ ...clip(300), fontWeight: 600 }} title={p.path}>{p.name || p.path}</Box>
                      <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>
                        {p.kind === "product" ? `${p.product} · ${p.paths.length} ${p.paths.length === 1 ? "language" : "languages"}` : p.path}
                        {" · "}
                        <Box component={Link} href={previewHref("prod", p.path)} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ color: ACCENT, fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>Preview</Box>
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><Chip tint={p.kind === "product" ? "green" : p.kind === "category" ? "blue" : p.kind === "home" ? "purple" : "amber"}>{KIND_LABEL[p.kind]}</Chip></TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.views ? full(p.views) : "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {pct(p.rate)}{p.typical !== null && p.rate !== null && <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}> / {pct(p.typical)}</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontVariantNumeric: "tabular-nums" }}>{p.missed ? full(p.missed) : "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {p.shop ? `${full(p.shop.lost)} of ${full(p.shop.companies)} lost` : "–"}
                    </TableCell>
                    <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}>{p.shop?.topLoss ? <Chip tint={STEP_TINT[p.shop.topLoss]}>{STEP_LABEL[p.shop.topLoss]}</Chip> : "–"}</TableCell>
                    <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}><Box sx={clip(320)} title={p.reasons.join(" · ")}>{p.reasons[0] ?? "–"}</Box></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {pager}
        </GlassCard>

        {selected && <Customers key={selected.key} row={selected} from={data.from} to={data.to} />}
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Problems"
        subtitle="Pages with a lot of traffic and little buying, down to the customers behind them"
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
      <Flow at="problems" />
      {body}
    </Box>
  );
}
