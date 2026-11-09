"use client";

// Website > Journeys > FUNNEL, rebuilt (SARCLA 09.11.2026: "funnels needs to be completely redeveloped"). The shop's real
// path as steps - the way in, a category or the search, a product, the cart, the check-out, the order placed - or the
// person's own (2 to 6 steps: kinds of page or one page, kept in the address so the view can be sent). Each step's
// visitors and the share that goes on; the drop between two steps big and plain, the biggest in red; a drop opens WHERE
// they dropped (the pages that lose the most, each to the Preview and to its page flow). Store view and device; every
// figure against the period before. Two counts, said apart: Google Analytics' own funnel report (visitors who did the
// steps in this order) where it answers, and the funnel chained from its page-to-page steps (visits) always - the pages
// of a drop are always chained. The signed-in customers' own steps (the shop's record) close the page.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import CircularProgress from "@mui/material/CircularProgress";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import PageHeader from "@/app/PageHeader";
import { useHeld } from "@/app/analytics/AnalyticsData";
import { GUTTER, LoadingPanel, NotConnectedPanel, UpstreamPanel } from "@/app/analytics/Shell";
import { full } from "@/app/charts/format";
import { ACCENT, CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, KpiTile, MUTED, Notice, RED, TRACK } from "@/app/uc/report/ui";
import { WindowPicker, useReportingWindow } from "@/app/window/ReportingWindow";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { previewHref } from "@/app/website/ai-personalization/Flow";
import { PageShot } from "@/app/website/ai-personalization/PageShot";
import { journeysBase, useInConvert } from "@/app/website/ai-personalization/base";
import { STEP_LABEL } from "@/lib/convert/model";
import {
  DEVICE_NAME, KIND_COLOR, KIND_NAME, MAX_STEPS, SHOP_PATH, SHOP_STOP, isShopPath, journeyKind, parseSteps, stepName, stepToken,
  type DropPage, type JKind, type StepDef,
} from "@/lib/journeys/model";
import type { FunnelData } from "@/lib/journeys/read";
import { KindTag, StepFunnel, pct } from "../parts";
import { ChoiceBar, PageSearch, jqs, useJQuery, type JQuery } from "../controls";

const linkSx = { color: ACCENT, fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } } as const;
const btnSx = { borderRadius: "6px", textTransform: "none", fontWeight: 700, boxShadow: "none", whiteSpace: "nowrap" } as const;
const SHOP_FROM_WORDS = "2 October 2026";

/** A step's colour: its first kind's, the way in the app's blue. */
const stepColor = (d: StepDef) => (d.type === "in" ? "#6a46c9" : d.type === "page" ? KIND_COLOR[journeyKind(d.path)] : KIND_COLOR[d.kinds[0]]);
/** A change in points of a share: "↑ 1.2 pts", "level" under 0.05 points. */
const pts = (d: number) => (Math.abs(d) < 0.0005 ? "level" : `${d >= 0 ? "↑" : "↓"} ${Math.abs(d * 100).toFixed(1)} pts`);
const LEVEL = 0.0005;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/* ── the steps, chosen ────────────────────────────────────────────────── */

const ADD: { label: string; token: string }[] = [
  { label: "Home page", token: "home" }, { label: "Category", token: "category" }, { label: "Search", token: "search" },
  { label: "Category or search", token: "category.search" }, { label: "Product", token: "product" }, { label: "Content page", token: "cms" },
  { label: "Account", token: "account" }, { label: "Cart", token: "cart" }, { label: "Check-out", token: "checkout" }, { label: "Order placed", token: "order" },
];

function StepsBar({ steps, onChange, suggest, store }: { steps: StepDef[]; onChange: (tokens: string[]) => void; suggest: { path: string; name: string }[]; store: string | null }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [pick, setPick] = useState(false);
  const tokens = steps.map(stepToken);
  const add = (t: string) => { setMenu(null); onChange(t === "in" ? ["in", ...tokens] : [...tokens, t]); };
  const chip = (d: StepDef, i: number) => (
    <Box key={`${i}:${stepToken(d)}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, border: `1px solid ${HAIRLINE}`, borderRadius: "6px", bgcolor: "rgba(255,255,255,.85)", pl: 1, pr: steps.length > 2 ? 0.25 : 1, py: 0.4, minWidth: 0, maxWidth: "100%" }}>
      <Box component="span" sx={{ width: 18, height: 18, borderRadius: "4px", bgcolor: stepColor(d), color: "#fff", fontSize: "0.7rem", fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{i + 1}</Box>
      <Typography component="span" sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK, overflowWrap: "anywhere" }} title={d.type === "page" ? d.path : undefined}>{stepName(d)}</Typography>
      {steps.length > 2 && (
        <IconButton size="small" aria-label={`Take out ${stepName(d)}`} onClick={() => onChange(tokens.filter((_, j) => j !== i))} sx={{ p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 15, color: MUTED }} />
        </IconButton>
      )}
    </Box>
  );
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, rowGap: 1 }}>
      <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em", mr: 0.5 }}>Steps</Typography>
      {steps.map((d, i) => (
        <Box key={i} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0, maxWidth: "100%" }}>
          {i > 0 && <Box component="span" aria-hidden sx={{ color: FAINT }}>→</Box>}
          {chip(d, i)}
        </Box>
      ))}
      {steps.length < MAX_STEPS && (
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={(e) => setMenu(e.currentTarget)} sx={{ ...btnSx, ml: 0.5 }}>Add a step</Button>
      )}
      {steps.length >= MAX_STEPS && <Typography component="span" sx={{ fontSize: "0.76rem", color: MUTED, ml: 0.5 }}>Six steps at most - take one out to add another.</Typography>}
      {!isShopPath(steps) && <Button size="small" onClick={() => onChange(SHOP_PATH)} sx={btnSx}>Back to the shop&apos;s path</Button>}
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { borderRadius: "8px", minWidth: 220 } } }}>
        {steps[0]?.type !== "in" && <MenuItem onClick={() => add("in")} sx={{ fontSize: "0.88rem" }}>Way in (first)</MenuItem>}
        {ADD.map((a) => (
          <MenuItem key={a.token} onClick={() => add(a.token)} disabled={tokens[tokens.length - 1] === a.token} sx={{ fontSize: "0.88rem", gap: 1 }}>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: KIND_COLOR[a.token.split(".")[0] as JKind] }} />{a.label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => { setMenu(null); setPick(true); }} sx={{ fontSize: "0.88rem", fontWeight: 700, color: ACCENT }}>One page…</MenuItem>
      </Menu>
      <Dialog open={pick} onClose={() => setPick(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "14px", p: 2.25, overflow: "visible" } }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 1.5 }}>A page as a step</Typography>
        <PageSearch autoFocus store={store} suggest={suggest} onPick={(p) => { setPick(false); onChange([...tokens, `page:${p}`]); }} />
      </Dialog>
    </Box>
  );
}

/* ── the funnel, drawn ────────────────────────────────────────────────── */

type Figures = { n: (number | null)[]; before: (number | null)[] | null };

/** Of those at step i, the share that did not reach step i+1 (null: no one at step i, or unknown). */
const dropAt = (n: (number | null)[], i: number) => {
  const a = n[i], b = n[i + 1];
  return a !== null && b !== null && a !== undefined && b !== undefined && a > 0 ? Math.max(0, 1 - b / a) : null;
};
function biggestAt(n: (number | null)[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < n.length - 1; i++) {
    const d = dropAt(n, i);
    if (d !== null && (best === null || d > (dropAt(n, best) ?? -1))) best = i;
  }
  return best;
}

function DropButton({ i, f, sel, big, onSel, wide }: { i: number; f: Figures; sel: boolean; big: boolean; onSel: (i: number) => void; wide?: boolean }) {
  const d = dropAt(f.n, i);
  const a = f.n[i], b = f.n[i + 1];
  const lost = a !== null && b !== null ? Math.max(0, a - b) : null;
  const was = f.before ? dropAt(f.before, i) : null;
  const tone = big ? RED : "#7a4a1d";
  return (
    <Box component="button" type="button" onClick={() => onSel(i)} aria-pressed={sel}
      title="See where they dropped" sx={{
        all: "unset", cursor: "pointer", boxSizing: "border-box", width: wide ? "100%" : 88, textAlign: "center", borderRadius: "8px", px: 0.75, py: 0.9,
        border: `1.5px solid ${sel ? tone : big ? "rgba(197,34,31,.35)" : HAIRLINE}`, bgcolor: sel ? (big ? "rgba(197,34,31,.08)" : "rgba(169,106,18,.08)") : "rgba(255,255,255,.85)",
        display: "flex", flexDirection: wide ? "row" : "column", flexWrap: wide ? "wrap" : "nowrap", alignItems: "center", justifyContent: "center", columnGap: wide ? 1.25 : 0, rowGap: 0.2,
        "&:hover": { borderColor: tone }, "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
      }}>
      <Typography component="span" sx={{ fontSize: wide ? "1.05rem" : "1.15rem", fontWeight: 800, color: tone, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{d === null ? "–" : `↓ ${pct(d)}`}</Typography>
      <Typography component="span" sx={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.25 }}>{lost !== null ? `${full(lost)} lost` : "did not go on"}</Typography>
      {was !== null && d !== null && (
        <Typography component="span" sx={{ fontSize: "0.68rem", color: Math.abs(d - was) < LEVEL ? MUTED : d > was ? RED : GREEN, fontWeight: 700, lineHeight: 1.25 }}>{pts(d - was)} vs before</Typography>
      )}
      <Typography component="span" sx={{ fontSize: "0.68rem", color: ACCENT, fontWeight: 700, lineHeight: 1.25 }}>{sel ? "shown below" : "where?"}</Typography>
    </Box>
  );
}

function FunnelChart({ steps, f, unit, sel, onSel, scale }: { steps: StepDef[]; f: Figures; unit: string; sel: number | null; onSel: (i: number) => void; scale: "first" | "prev" }) {
  const first = f.n[0] ?? 0;
  const firstBefore = f.before?.[0] ?? 0;
  const big = biggestAt(f.n);
  const H = 210;
  const of = (i: number) => (first > 0 && f.n[i] !== null ? (f.n[i] as number) / first : null);
  const ofBefore = (i: number) => (f.before && firstBefore > 0 && f.before[i] !== null ? (f.before[i] as number) / firstBefore : null);
  // the bar: of the first step, or of the step before (the later steps of the shop's path are a few % of the first)
  const ratio = (n: (number | null)[] | null, i: number) => {
    if (!n) return null;
    const base = scale === "first" || i === 0 ? n[0] : n[i - 1];
    return base && n[i] !== null ? Math.min(1, (n[i] as number) / base) : null;
  };
  const words = (i: number) => {
    if (i === 0) return unit;
    const r = ratio(f.n, i);
    return r === null ? "–" : scale === "first" ? `${pct(r)} of the first step` : `${pct(r)} of the step before`;
  };
  const change = (i: number): { text: string; up: boolean | null } | null => {
    if (!f.before) return null;
    if (i === 0) {
      const a = f.n[0], b = f.before[0];
      if (a === null || !b) return null;
      return Math.abs(a / b - 1) < LEVEL ? { text: "level", up: null } : { text: `${a >= b ? "↑" : "↓"} ${Math.abs((a / b - 1) * 100).toFixed(1)}%`, up: a >= b };
    }
    const a = of(i), b = ofBefore(i);
    return a !== null && b !== null ? { text: pts(a - b), up: Math.abs(a - b) < LEVEL ? null : a >= b } : null;
  };
  const tone = (up: boolean | null) => (up === null ? MUTED : up ? GREEN : RED);
  const cols = steps.map(() => "minmax(0, 1fr)").join(" 96px ");
  return (
    <>
      {/* wide: the steps side by side, the drop between them */}
      <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, gridTemplateRows: `auto auto ${H}px auto`, columnGap: 0, rowGap: 1 }}>
        {steps.map((d, i) => {
          const col = i * 2 + 1;
          const share = ratio(f.n, i);
          const was = ratio(f.before, i);
          const ch = change(i);
          return [
            <Box key={`h${i}`} sx={{ gridColumn: col, gridRow: 1, display: "flex", gap: 0.75, alignItems: "flex-start", minWidth: 0, px: 0.5 }}>
              <Box component="span" sx={{ width: 20, height: 20, borderRadius: "5px", bgcolor: stepColor(d), color: "#fff", fontSize: "0.72rem", fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0, mt: "1px" }}>{i + 1}</Box>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: INK, lineHeight: 1.3, overflowWrap: "anywhere" }} title={d.type === "page" ? d.path : undefined}>{stepName(d)}</Typography>
            </Box>,
            <Box key={`n${i}`} sx={{ gridColumn: col, gridRow: 2, px: 0.5 }}>
              <Typography sx={{ fontSize: "1.7rem", fontWeight: 750, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{full(f.n[i])}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{words(i)}</Typography>
            </Box>,
            <Box key={`b${i}`} sx={{ gridColumn: col, gridRow: 3, position: "relative", mx: 0.5, bgcolor: TRACK, borderRadius: "6px", overflow: "hidden" }}>
              {was !== null && <Box aria-hidden sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${Math.min(1, was) * 100}%`, borderTop: `2px dashed ${MUTED}`, opacity: 0.55, zIndex: 2 }} />}
              <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${Math.max(share ?? 0, share ? 0.006 : 0) * 100}%`, bgcolor: stepColor(d), opacity: 0.9, borderRadius: "6px 6px 0 0", transition: "height .3s ease" }} />
            </Box>,
            <Box key={`c${i}`} sx={{ gridColumn: col, gridRow: 4, px: 0.5 }}>
              {ch
                ? <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: tone(ch.up) }}>{ch.text} <Box component="span" sx={{ color: FAINT, fontWeight: 500 }}>vs before</Box></Typography>
                : <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>no comparison</Typography>}
            </Box>,
            i < steps.length - 1 && (
              <Box key={`d${i}`} sx={{ gridColumn: col + 1, gridRow: 3, display: "grid", placeItems: "center", px: 0.5 }}>
                <DropButton i={i} f={f} sel={sel === i} big={big === i} onSel={onSel} />
              </Box>
            ),
          ];
        })}
        <Box sx={{ gridColumn: `1 / span ${steps.length * 2 - 1}`, gridRow: 5, display: "flex", gap: 2, alignItems: "center", mt: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box aria-hidden sx={{ width: 18, borderTop: `2px dashed ${MUTED}`, opacity: 0.7 }} />
            <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>the period before</Typography>
          </Box>
        </Box>
      </Box>
      {/* phone: one step under the other, the drop between them */}
      <Box sx={{ display: { xs: "grid", md: "none" }, gap: 1 }}>
        {steps.map((d, i) => {
          const share = ratio(f.n, i);
          const ch = change(i);
          return (
            <Box key={i} sx={{ display: "grid", gap: 0.75 }}>
              <Box sx={{ display: "grid", gap: 0.5 }}>
                <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline", minWidth: 0 }}>
                  <Box component="span" sx={{ width: 18, height: 18, borderRadius: "4px", bgcolor: stepColor(d), color: "#fff", fontSize: "0.7rem", fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0, alignSelf: "center" }}>{i + 1}</Box>
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{stepName(d)}</Typography>
                  <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, fontVariantNumeric: "tabular-nums" }}>{full(f.n[i])}</Typography>
                </Box>
                <Box sx={{ height: 14, borderRadius: "4px", bgcolor: TRACK, overflow: "hidden" }}>
                  <Box sx={{ height: "100%", width: `${Math.max(share ?? 0, share ? 0.006 : 0) * 100}%`, bgcolor: stepColor(d), opacity: 0.9 }} />
                </Box>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                  {words(i)}
                  {ch && <Box component="span" sx={{ color: tone(ch.up), fontWeight: 700 }}> · {ch.text} vs before</Box>}
                </Typography>
              </Box>
              {i < steps.length - 1 && <DropButton i={i} f={f} sel={sel === i} big={big === i} onSel={onSel} wide />}
            </Box>
          );
        })}
      </Box>
    </>
  );
}

/* ── where they dropped ───────────────────────────────────────────────── */

function DropPages({ steps, i, pages, n, jb, q, store }: { steps: StepDef[]; i: number; pages: DropPage[]; n: (number | null)[]; jb: string; q: JQuery; store: string | null }) {
  const from = steps[i], to = steps[i + 1];
  const a = n[i], b = n[i + 1];
  const atIn = from.type === "in";
  const flowLink = (p: string) => `${jb}/page${jqs({ ...q, store }, { path: p })}`;
  const actions = (p: DropPage) => (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      <Button size="small" variant="contained" disableElevation component={Link} href={previewHref("prod", p.path)} sx={btnSx}>Open in Preview</Button>
      <Button size="small" variant="outlined" component={Link} href={flowLink(p.path)} sx={btnSx}>Page flow</Button>
    </Box>
  );
  const stat = (label: string, value: string, tone?: string) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: FAINT, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.95rem", fontWeight: 750, color: tone ?? INK, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
    </Box>
  );
  const top = pages.slice(0, 4), rest = pages.slice(4);
  return (
    <GlassCard>
      <CardTitle icon={<ManageSearchOutlinedIcon />} tint="pink" title={`Where they dropped: ${stepName(from)} → ${stepName(to)}`}
        note="The pages that lose the most on the way to the next step - built from page-to-page steps" />
      <Typography sx={{ fontSize: { xs: "1rem", md: "1.15rem" }, fontWeight: 650, color: INK, mb: 2, lineHeight: 1.4 }}>
        {a !== null && b !== null && a > 0
          ? <>Of the {full(a)} at &quot;{stepName(from)}&quot;, <Box component="span" sx={{ color: RED }}>{pct(1 - b / a)} did not reach &quot;{stepName(to)}&quot;</Box> - {full(a - b)}.</>
          : "No one reached this step in this period."}
      </Typography>
      {pages.length === 0
        ? <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>No page of this step lost visits in this period{store ? ` in ${store}` : ""}.</Typography>
        : (
          <Box sx={{ display: "grid", gap: 2.5 }}>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(4, minmax(0,1fr))" } }}>
              {top.map((p, k) => (
                <Box key={p.path} sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden", bgcolor: "rgba(255,255,255,.7)", display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <Box component={Link} href={previewHref("prod", p.path)} title={`${p.name} - open it in the Preview`} sx={{ display: "block", position: "relative" }}>
                    <PageShot env="prod" path={p.path} ratio={0.6} label={p.name} />
                    <Box sx={{ position: "absolute", left: 8, top: 8, bgcolor: k === 0 ? RED : INK, color: "#fff", fontSize: "0.72rem", fontWeight: 800, px: 0.8, py: 0.2, borderRadius: "4px" }}>#{k + 1}</Box>
                  </Box>
                  <Box sx={{ p: 1.5, display: "grid", gap: 1, flex: 1, alignContent: "start" }}>
                    <Box sx={{ minWidth: 0 }}>
                      <KindTag kind={p.kind} />
                      <Typography sx={{ fontSize: "0.92rem", fontWeight: 700, color: INK, lineHeight: 1.3, mt: 0.4, overflowWrap: "anywhere" }}>{p.name}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflowWrap: "anywhere" }}>{p.path}</Typography>
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                      {stat(atIn ? "Came in on it" : "Views", full(p.views))}
                      {stat("Lost", full(p.lost), RED)}
                      {stat(`Went on to ${stepName(to).toLowerCase()}`, pct(p.on))}
                      {stat("Left the shop here", pct(p.left))}
                    </Box>
                    <Box sx={{ mt: "auto" }}>{actions(p)}</Box>
                  </Box>
                </Box>
              ))}
            </Box>
            {rest.length > 0 && (
              <Box sx={{ display: "grid" }}>
                {rest.map((p, k) => (
                  <Box key={p.path} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "28px minmax(0,1fr) 110px 110px 110px auto" }, columnGap: 2, rowGap: 0.75, alignItems: "center", py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
                    <Typography sx={{ display: { xs: "none", md: "block" }, fontSize: "0.8rem", fontWeight: 700, color: FAINT }}>#{k + 5}</Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "baseline", flexWrap: "wrap" }}>
                        <KindTag kind={p.kind} label="" />
                        <Typography sx={{ fontSize: "0.88rem", fontWeight: 650, color: INK, overflowWrap: "anywhere" }}>{p.name}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: "0.72rem", color: MUTED, overflowWrap: "anywhere" }}>{p.path}</Typography>
                    </Box>
                    <Box sx={{ display: { xs: "flex", md: "contents" }, gap: 2, flexWrap: "wrap" }}>
                      {stat(atIn ? "Came in" : "Views", full(p.views))}
                      {stat("Went on", pct(p.on))}
                      {stat("Lost", full(p.lost), RED)}
                    </Box>
                    {actions(p)}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
    </GlassCard>
  );
}

/* ── desktop and phone side by side ───────────────────────────────────── */

function Devices({ steps, by }: { steps: StepDef[]; by: Record<string, (number | null)[]> }) {
  const shown = (["desktop", "mobile"] as const).filter((d) => by[d]?.[0]);
  const of = (d: string, i: number) => { const v = by[d]; return v?.[0] && v[i] !== null ? (v[i] as number) / v[0] : null; };
  // the step where the phone loses most against the desktop
  let worst: { i: number; gap: number } | null = null;
  if (shown.length === 2) {
    for (let i = 0; i < steps.length - 1; i++) {
      const dd = dropAt(by.desktop, i), dm = dropAt(by.mobile, i);
      if (dd !== null && dm !== null && (!worst || dm - dd > worst.gap)) worst = { i, gap: dm - dd };
    }
  }
  const COLOR = { desktop: "#2459d1", mobile: "#e2672b" } as const;
  return (
    <Box sx={{ display: "grid", gap: 1.75 }}>
      {worst && worst.gap > 0.02 && (
        <Typography sx={{ fontSize: "0.98rem", fontWeight: 650, color: INK }}>
          On a phone, most are lost between &quot;{stepName(steps[worst.i])}&quot; and &quot;{stepName(steps[worst.i + 1])}&quot;:{" "}
          <Box component="span" sx={{ color: RED }}>{pct(dropAt(by.mobile, worst.i))} drop</Box>, against {pct(dropAt(by.desktop, worst.i))} on a desktop.
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 2 }}>
        {shown.map((d) => (
          <Box key={d} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: "3px", bgcolor: COLOR[d] }} />
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: INK }}>{DEVICE_NAME[d]} · {full(by[d][0])} visitors</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 1.25 }}>
        {steps.map((s, i) => (
          <Box key={i} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "220px minmax(0,1fr)" }, columnGap: 2, rowGap: 0.5, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 650, color: INK, overflowWrap: "anywhere" }}>{i + 1}. {stepName(s)}</Typography>
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {shown.map((d) => {
                const v = of(d, i);
                return (
                  <Box key={d} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1, height: 10, borderRadius: "3px", bgcolor: TRACK, overflow: "hidden" }}>
                      <Box sx={{ height: "100%", width: `${Math.max(0, v ?? 0) * 100}%`, bgcolor: COLOR[d], opacity: 0.85 }} />
                    </Box>
                    <Typography sx={{ width: 120, fontSize: "0.78rem", color: MUTED, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                      <Box component="span" sx={{ color: INK, fontWeight: 700 }}>{pct(v)}</Box> · {full(by[d][i])}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── the page ─────────────────────────────────────────────────────────── */

function FunnelInner() {
  const jb = journeysBase(useInConvert());
  const { q, set, sp } = useJQuery();
  const { window: win } = useReportingWindow();
  const [tick, setTick] = useState(0);
  const steps = useMemo(() => parseSteps(sp.getAll("step")), [sp]);
  const tokens = steps.map(stepToken);
  const [count, setCount] = useState<"ga4" | "chained">("ga4");
  const [scale, setScale] = useState<"first" | "prev">("first");
  const [sel, setSel] = useState<number | null>(null);
  const url = `/api/website/journeys/funnel?from=${win.from}&to=${win.to}${q.store ? `&store=${q.store}` : ""}${q.device ? `&device=${q.device}` : ""}${tokens.map((t) => `&step=${encodeURIComponent(t)}`).join("")}&n=${tick}`;
  const held = useHeld<FunnelData>(url, [url]);
  const r = held.result;
  const d = r?.state === "ok" ? r.data : null;
  // the most viewed pages, to offer as a page step
  const sugUrl = `/api/website/journeys?from=${win.from}&to=${win.to}${q.store ? `&store=${q.store}` : ""}${q.device ? `&device=${q.device}` : ""}`;
  const sug = useHeld<{ pages: Record<JKind, { path: string; name: string; views: number }[]> }>(sugUrl, [sugUrl]);
  const suggest = useMemo(() => {
    const p = sug.result?.state === "ok" ? sug.result.data.pages : null;
    return p ? Object.values(p).flat().sort((a, b) => b.views - a.views).slice(0, 12).map((x) => ({ path: x.path, name: x.name, note: `${full(x.views)} views` })) : [];
  }, [sug.result]);

  useEffect(() => { setSel(null); }, [url]);
  // the shop's record still being read: ask again in twenty seconds
  useEffect(() => {
    if (d?.shop.state.state !== "computing") return;
    const t = setTimeout(() => setTick((n) => n + 1), 20_000);
    return () => clearTimeout(t);
  }, [d?.shop.state.state, tick]);

  const changeSteps = (t: string[]) => set({ step: t.join(",") === SHOP_PATH.join(",") ? null : t });

  let body: React.ReactNode;
  if (r === null) body = <LoadingPanel label="Reading the steps from Google Analytics…" />;
  else if (r.state === "not-configured") body = <NotConnectedPanel source="the hub" missing={r.missing} />;
  else if (r.state === "error") body = <UpstreamPanel source="Funnel" error={r.error} status={r.status} onRetry={() => setTick((n) => n + 1)} />;
  else {
    const { ga4, chained, shop } = r.data;
    const useGa4 = ga4.ok && count === "ga4";
    const f: Figures | null = useGa4 ? { n: ga4.now ?? [], before: ga4.before } : chained.ok ? { n: chained.now, before: chained.before } : null;
    const unit = useGa4 ? "visitors" : "visits";
    const big = f ? biggestAt(f.n) : null;
    const shown = sel ?? big;
    const first = f?.n[0] ?? null, last = f?.n[f.n.length - 1] ?? null;
    const conv = first && last !== null ? last / first : null;
    const convBefore = f?.before && f.before[0] && f.before[f.before.length - 1] !== null ? (f.before[f.before.length - 1] as number) / f.before[0] : null;
    const versus = `${day(r.data.before.from)} – ${day(r.data.before.to)}`;
    const stops = Object.fromEntries(Object.entries(SHOP_STOP).map(([k, s]) => [k, STEP_LABEL[s].toLowerCase()]));
    const shopReady = shop.state.state === "ready" && shop.steps.length > 0;
    const pagesSteps = steps.filter((s): s is Extract<StepDef, { type: "page" }> => s.type === "page");
    body = (
      <>
        {!ga4.configured && !chained.ok && <NotConnectedPanel source="Google Analytics" missing={[]} />}
        {ga4.configured && !ga4.ok && chained.ok && (
          <Notice tone="warn">Google Analytics&apos; own funnel report did not answer ({ga4.error}). The figures are chained from its page-to-page steps.</Notice>
        )}
        {chained.ok === false && ga4.configured && <Notice tone="bad">Google Analytics did not give the page-to-page steps: {chained.error}</Notice>}
        {chained.truncated && <Notice tone="warn">Google Analytics gave the most viewed page-to-page steps only - the rarest are missing from the chained funnel.</Notice>}
        {q.store && pagesSteps.some((s) => !s.path.startsWith(`/${q.store}/`) && s.path !== `/${q.store}`) && (
          <Notice tone="warn">A page step is not in {q.store} - with the store view {q.store} chosen, nobody reaches it.</Notice>
        )}

        {f && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiTile icon={<LoginOutlinedIcon />} tint="purple" label={steps[0].type === "in" ? "Came in" : `At "${stepName(steps[0])}"`} value={full(first)} note={unit}
                delta={f.before ? { ratio: first !== null && f.before[0] ? first / f.before[0] - 1 : null, versus } : undefined} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <KpiTile icon={<FlagOutlinedIcon />} tint="green" label={`Reached "${stepName(steps[steps.length - 1])}"`} value={conv === null ? "—" : pct(conv)}
                note={`${full(last)} of the ${full(first)}`}
                delta={f.before ? { ratio: conv !== null && convBefore ? conv / convBefore - 1 : null, versus } : undefined} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{ height: "100%", boxSizing: "border-box", borderRadius: "20px", p: 2.25, bgcolor: "rgba(197,34,31,.06)", border: "1px solid rgba(197,34,31,.18)", display: "grid", alignContent: "center", gap: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TrendingDownOutlinedIcon sx={{ color: RED, fontSize: 22 }} />
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: RED }}>The biggest drop</Typography>
                </Box>
                {big !== null && f.n[big] !== null ? (
                  <>
                    <Typography sx={{ fontSize: { xs: "1.05rem", md: "1.25rem" }, fontWeight: 700, color: INK, lineHeight: 1.3 }}>
                      {stepName(steps[big])} → {stepName(steps[big + 1])}: <Box component="span" sx={{ color: RED }}>{pct(dropAt(f.n, big))} did not go on</Box>
                    </Typography>
                    <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
                      {full((f.n[big] ?? 0) - (f.n[big + 1] ?? 0))} {unit} lost there.{" "}
                      {shown !== big && <Box component="button" type="button" onClick={() => setSel(big)} sx={{ all: "unset", cursor: "pointer", ...linkSx }}>See where</Box>}
                    </Typography>
                  </>
                ) : <Typography sx={{ fontSize: "0.95rem", color: MUTED }}>No drop between the steps in this period.</Typography>}
              </Box>
            </Grid>
          </Grid>
        )}

        {f && (
          <GlassCard>
            <CardTitle icon={<FilterAltOutlinedIcon />} tint="blue" title="Step by step"
              note={useGa4 ? "Google Analytics' own funnel: the visitors who did each step after the one before, in this order" : "Chained from page-to-page steps: the visits, not each visitor followed"}
              right={
                <Box sx={{ display: "flex", gap: 1.5, rowGap: 1, flexWrap: "wrap" }}>
                  {ga4.configured && (
                    <SquareChoice<"ga4" | "chained"> label="Count" value={useGa4 ? "ga4" : "chained"} onChange={setCount}
                      options={[{ key: "ga4", label: "Google Analytics' funnel", disabled: !ga4.ok }, { key: "chained", label: "Chained from the steps", disabled: !chained.ok }]} />
                  )}
                  <SquareChoice<"first" | "prev"> label="Bars" value={scale} onChange={setScale}
                    options={[{ key: "first", label: "Of the first step" }, { key: "prev", label: "Of the step before" }]} />
                </Box>
              } />
            <FunnelChart steps={steps} f={f} unit={unit} sel={shown} onSel={setSel} scale={scale} />
          </GlassCard>
        )}

        {shown !== null && chained.ok && (
          <DropPages steps={steps} i={shown} pages={chained.drops[shown] ?? []} n={f?.n ?? []} jb={jb} q={q} store={q.store} />
        )}

        {f && !q.device && (
          <GlassCard>
            <CardTitle icon={<DevicesOutlinedIcon />} tint="amber" title="Desktop and phone" note="Of each device's visitors, the share that reached each step - Google Analytics' funnel report" />
            {ga4.ok && ga4.byDevice && Object.keys(ga4.byDevice).length > 0
              ? <Devices steps={steps} by={ga4.byDevice} />
              : <Typography sx={{ fontSize: "0.88rem", color: MUTED }}>Side by side needs Google Analytics&apos; funnel report, which did not answer. Pick Desktop or Phone above to see each one.</Typography>}
          </GlassCard>
        )}

        <GlassCard>
          <CardTitle icon={<StorefrontOutlinedIcon />} tint="green" title="Signed-in customers - the shop's own record"
            note={`Every company that opened an article, at the furthest step it reached${shopReady ? ` - ${full(shop.companies)} companies, ${full(shop.looks)} looks` : ""}. All store views and devices.`} />
          {shop.state.state === "computing" && <Notice tone="warn">The shop&apos;s record is being read{shop.state.progress ? ` (${shop.state.progress})` : ""} - this page asks again by itself.</Notice>}
          {shop.state.state === "error" && <Notice tone="bad">The shop&apos;s record could not be read: {shop.state.error}</Notice>}
          {shop.state.state === "none" && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>The shop&apos;s record has no steps yet - they come with its next read.</Typography>}
          {shopReady && (
            <Box sx={{ display: "grid", gap: 1.75 }}>
              {r.data.from < shop.since && <Notice tone="warn">The shop&apos;s record starts on {SHOP_FROM_WORDS} - the days before are not in it.</Notice>}
              {shop.companies === 0
                ? <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>No signed-in customer opened an article in this period.</Typography>
                : <StepFunnel steps={shop.steps} drop={shop.drop} unit="companies" stops={stops} />}
            </Box>
          )}
        </GlassCard>
      </>
    );
  }

  return (
    <Box sx={{ width: "100%", minWidth: 0, px: GUTTER, py: { xs: 2.5, md: 3.5 }, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5 }}>
      <PageHeader
        title="Funnel"
        subtitle="The shop's path step by step: how many go on, where they drop - and on which pages"
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
      <GlassCard sx={{ py: { xs: 1.75, md: 2 }, display: "grid", gap: 1.75 }}>
        <ChoiceBar q={q} set={set} stores={d?.chained.stores ?? null} />
        <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, pt: 1.75 }}>
          <StepsBar steps={steps} onChange={changeSteps} suggest={suggest} store={q.store} />
        </Box>
      </GlassCard>
      {body}
      <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
        See <Box component={Link} href={`${jb}${jqs(q)}`} sx={linkSx}>the main journeys</Box>, or follow one page in <Box component={Link} href={`${jb}/page${jqs(q)}`} sx={linkSx}>Page flow</Box>.
      </Typography>
    </Box>
  );
}

export default function JourneysFunnel() {
  return <Suspense fallback={<LoadingPanel label="Opening the funnel…" />}><FunnelInner /></Suspense>;
}
