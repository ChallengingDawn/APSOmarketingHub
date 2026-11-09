"use client";

// The pages losing buyers, as cards - shared by Insights (which took in Problem pages, SARCLA 09.11.2026: "merge Insights
// and Problem pages") - and a page's customers down to the company. Moved from problems/page.tsx as it was.

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import TroubleshootOutlinedIcon from "@mui/icons-material/TroubleshootOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import Link from "next/link";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { LoadingPanel, NotConnectedPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, AMBER, CardTitle, GREEN, GlassCard, MUTED, Notice, RED, TRACK, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { ago, usePaged } from "@/app/connectors/parts";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { KIND_LABEL, STEP_LABEL, classify, type PageKind, type Step } from "@/lib/convert/model";
import type { BoardRow } from "@/lib/convert/studio";
import type { PageCustomers, ProblemsData } from "@/lib/convert/problems";
import type { Brief } from "@/lib/convert/brief";
import { convertPost, previewHref } from "../Flow";
import { PageShot } from "../PageShot";
import { flowHref } from "../base";
import { AiButton } from "../AiButton";
import { Stat, WideCard } from "./Lenses";


/** What is already being done on a page: its ideas (not dropped) and the versions ready to test. */
export type Work = { ideas: number; ready: number; idea: string | null };
/** The ideas board by Insights' page key: a product is one page in every language ("product:12202510"). */
export function workByKey(rows: BoardRow[]): Map<string, Work> {
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
const PORTAL = "26492587";
const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;
const hsContact = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-1/${id}`;
const SHOP = "https://www.apsoparts.com";
export const SHOP_FROM = "2026-10-02";

export const pct = (r: number | null) => (r === null ? "–" : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`);
const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const STEP_TINT: Record<Step, "green" | "blue" | "amber" | "pink" | "slate" | "purple"> = {
  won: "green", cart: "purple", price: "amber", moq: "pink", shelf: "pink", looked: "slate",
};


export type Row = ProblemsData["pages"][number];

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

export function Customers({ row, from, to }: { row: Row; from: string; to: string }) {
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

export type Sort = "missed" | "lost" | "views";
export type Mode = "cards" | "table";
export const KIND_TINT: Record<PageKind, "green" | "blue" | "purple" | "amber" | "slate"> = { product: "green", category: "blue", home: "purple", cms: "amber", system: "slate" };
const STEP_COLOR: Record<Step, string> = { looked: "#9aa6b8", shelf: "#d64b7a", moq: "#e07a9a", price: "#d99a2b", cart: "#7c4dff", won: "#1b7a55" };
const STEP_ORDER: Step[] = ["looked", "shelf", "moq", "price", "cart", "won"];
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

export function PageCard({ p, selected, onSelect, work }: { p: Row; selected: boolean; onSelect: () => void; work: Work | null }) {
  const low = p.rate !== null && p.typical ? p.rate < p.typical / 2 : false;
  const rateColor = p.rate === null || !p.typical ? undefined : low ? RED : p.rate < p.typical ? AMBER : GREEN;
  const btn = { borderRadius: "6px", textTransform: "none", fontWeight: 600 } as const;
  return (
    <WideCard selected={selected}
      picture={
        <Box component={Link} href={previewHref("prod", p.path)} title="Open it in Preview" sx={{ position: "relative", display: "block", height: "100%", "&:hover .apx-open": { opacity: 1 } }}>
          <PageShot env="prod" path={p.path} ratio={1.3} label={p.name || p.path} />
          <Box className="apx-open" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(21,34,58,.38)", opacity: 0, transition: "opacity .15s" }}>
            <Box sx={{ px: 1.5, py: 0.6, borderRadius: "6px", bgcolor: "#fff", color: ACCENT, fontSize: "0.82rem", fontWeight: 700 }}>Open in Preview</Box>
          </Box>
        </Box>
      }
      chips={<>
        <Chip tint={KIND_TINT[p.kind]}>{KIND_LABEL[p.kind]}</Chip>
        {p.kind === "product" && p.paths.length > 1 && <Chip tint="slate">{p.paths.length} languages</Chip>}
      </>}
      corner={work ? <Chip tint={work.ready ? "green" : "purple"}>{work.ready ? `${work.ready} ready to test` : `In work · ${work.ideas} ${work.ideas === 1 ? "optimization" : "optimizations"}`}</Chip> : undefined}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#15223a", lineHeight: 1.3, overflowWrap: "anywhere" }}>{p.name || p.path}</Typography>
        <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflowWrap: "anywhere" }}>{p.kind === "product" ? `Product ${p.product}` : p.path}</Typography>
      </Box>
      {p.reasons.length
        ? p.reasons.map((t) => (
            <Box key={t} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
              <ReportProblemOutlinedIcon sx={{ fontSize: 16, color: RED, mt: "2px", flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.8rem", color: "#15223a", lineHeight: 1.35 }}>{t}</Typography>
            </Box>
          ))
        : <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Not on the problem list in this period.</Typography>}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1 }}>
        <Stat k="Views" v={p.views ? full(p.views) : "–"} />
        <Stat k="Cart rate" v={pct(p.rate)} sub={p.typical !== null ? `typical ${pct(p.typical)}` : undefined} color={rateColor} />
        {p.shop
          ? <Stat k="Lost" v={`${full(p.shop.lost)} of ${full(p.shop.companies)}`} sub={p.shop.topLoss ? STEP_LABEL[p.shop.topLoss] : undefined} color={p.shop.lost ? RED : undefined} />
          : <Stat k="Carts missed" v={p.missed ? full(p.missed) : "–"} color={p.missed ? RED : undefined} />}
      </Box>
      {p.shop && p.shop.companies > 0 && <StepBar f={p.shop} />}
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "wrap", mt: 0.25 }}>
        {work
          ? <Button size="small" variant="contained" disableElevation component={Link} href={previewHref("prod", p.path, work.idea ?? undefined)} sx={btn}>Continue</Button>
          : <AiButton size="small" href={`${previewHref("prod", p.path)}&ask=1`}>Find optimizations</AiButton>}
        <Button size="small" component={Link} href={flowHref(true, p.path)} sx={btn}>Journeys</Button>
        <Button size="small" onClick={onSelect} sx={{ ...btn, ml: "auto", color: selected ? ACCENT : MUTED }}>
          {selected ? "Hide customers" : p.kind === "product" ? "Customers" : "Contacts"}
        </Button>
      </Box>
    </WideCard>
  );
}

// WHAT STOPS BUYERS - the AI's reading of the period's problem pages, grouped into themes, each with what to test first and
// its pages (src/lib/convert/brief.ts). Asked at a click, kept per period.
export function WhatStops({ from, to, rows }: { from: string; to: string; rows: Row[] }) {
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
          <AiButton size="small" busy={busy} onClick={() => void ask()}>{busy ? "The AI is reading… about half a minute" : b ? "Ask again" : "Ask the AI"}</AiButton>
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
