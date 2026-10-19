"use client";
// THE VISIT PAGE'S GRAPHS, SMALL - for the nutshell's tiles (SARCLA 19.10: "we should find the same
// graph in both levels"): each tile draws what its card on Visit & traffic origin draws - visitors
// new and returning, the channel groups each month, visitors per country, the stores' and pages'
// channels, logins each month and each day - at tile size. And the shop accounts without a company,
// compact, with the way to where they are fixed.

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import LinkOffIcon from "@mui/icons-material/LinkOff";

import { Badge, FAINT, INK, MUTED, glass } from "@/app/uc/report/ui";
import { DEEMPHASIS, SERIES } from "@/app/charts/palette";
import { CHANNEL_GROUPS, groupsByMonth, landingTable, storeChannels, usersAbroad, type VisitData } from "@/lib/marketingKpis/visitCube";
import { MONTHS, MiniBars, useSlow, type KpiView } from "./data";

const n0 = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en"));
/** this page's own names for a KPI, on the page and its tiles alike (the catalogue's elsewhere) */
export const VISIT_NAMES: Record<string, string> = { V04: "Visitors per country" };

/** The Visit page's read (GA4 and HubSpot), shared with the nutshell. */
export const useVisitData = () => useSlow<VisitData>("/api/reporting/marketing-kpis/visit", "visit");

type Part = { label: string; color: string };
/** Months as small stacked columns - this year, the parts in their colours, a legend under them. */
function MonthStack({ rows, parts }: { rows: { m: string; tick?: string; vals: number[] }[]; parts: Part[] }) {
  const max = Math.max(1, ...rows.map((r) => r.vals.reduce((a, b) => a + b, 0)));
  return (
    <Box>
      <Box role="img" aria-label={rows.map((r) => `${r.m}: ${r.vals.map((v, i) => `${parts[i].label} ${n0(v)}`).join(", ")}`).join("; ")}
        sx={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, 1fr)`, gap: "3px", alignItems: "end", height: 78 }}>
        {rows.map((r) => (
          // each part its share of the column, as a height (flex-grow on the parts gave each the full height)
          <Box key={r.m} title={`${r.m}: ${r.vals.map((v, i) => `${parts[i].label} ${n0(v)}`).join(" · ")}`} sx={{ display: "flex", flexDirection: "column-reverse", height: `${(100 * r.vals.reduce((a, b) => a + b, 0)) / max}%`, borderRadius: "3px 3px 0 0", overflow: "hidden" }}>
            {(() => { const t = r.vals.reduce((a, b) => a + b, 0) || 1; return r.vals.map((v, i) => <Box key={i} sx={{ flex: "none", height: `${(100 * v) / t}%`, bgcolor: parts[i].color, borderTop: i ? "1px solid #fff" : 0 }} />); })()}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, 1fr)`, gap: "3px", mt: 0.4 }}>
        {rows.map((r) => <Typography key={r.m} sx={{ fontSize: "0.6rem", color: FAINT, textAlign: "center" }}>{r.tick ?? r.m[0]}</Typography>)}
      </Box>
      <Legend parts={parts} />
    </Box>
  );
}

function Legend({ parts }: { parts: Part[] }) {
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
      {parts.map((p) => (
        <Box key={p.label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: "0.64rem", color: MUTED }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "2px", bgcolor: p.color }} />{p.label}
        </Box>
      ))}
    </Box>
  );
}

/** A few rows, each a bar split in parts - the stores' and pages' channels, the countries (Reach's R09 tile too). */
export function RowBars({ rows, parts }: { rows: { label: string; vals: number[]; py?: number }[]; parts: Part[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.vals.reduce((a, b) => a + b, 0), r.py ?? 0)));
  return (
    <Box>
      <Box sx={{ display: "grid", gap: 0.55 }}>
        {rows.map((r) => {
          const t = r.vals.reduce((a, b) => a + b, 0);
          return (
            <Box key={r.label} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 0.75, rowGap: 0.25, alignItems: "center" }}>
              <Typography title={r.label} sx={{ fontSize: "0.68rem", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</Typography>
              <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{n0(t)}</Typography>
              <Box sx={{ gridColumn: "1 / -1", position: "relative", height: 9 }}>
                {r.py != null && <Box title={`a year earlier ${n0(r.py)}`} sx={{ position: "absolute", left: 0, top: 3, height: 3, width: `${(100 * r.py) / max}%`, bgcolor: "#d3d8e0", borderRadius: 99 }} />}
                <Box sx={{ position: "absolute", left: 0, top: 0, height: 9, width: `${Math.max(1.5, (100 * t) / max)}%`, display: "flex", gap: "1px", borderRadius: 99, overflow: "hidden", opacity: 0.95 }}>
                  {r.vals.map((v, i) => <Box key={i} title={`${parts[i].label}: ${n0(v)}`} sx={{ flex: `${v} 0 0`, bgcolor: parts[i].color }} />)}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      {parts.length > 1 && <Legend parts={parts} />}
    </Box>
  );
}

/** New against returning, one bar a year - as the New vs returning card. */
function ShareBars({ users, fresh, year }: { users: KpiView; fresh: KpiView; year: number }) {
  const rows = ([[String(year), fresh.ytd, users.ytd], [String(year - 1), fresh.pyYtd, users.pyYtd]] as const).filter(([, , u]) => u);
  return (
    <Box sx={{ display: "grid", gap: 0.9 }}>
      {rows.map(([label, n, u]) => {
        const a = (n ?? 0) / (u ?? 1);
        return (
          <Box key={label}>
            <Typography sx={{ fontSize: "0.66rem", color: FAINT, mb: 0.3 }}>{label}</Typography>
            <Box sx={{ display: "flex", height: 16, borderRadius: "6px", overflow: "hidden", gap: "2px" }}>
              <Box sx={{ flex: `${a} 0 0`, bgcolor: SERIES[0], color: "#fff", fontSize: "0.62rem", fontWeight: 700, display: "flex", alignItems: "center", px: 0.6 }}>{a > 0.2 ? `New ${(a * 100).toFixed(0)}%` : ""}</Box>
              <Box sx={{ flex: `${1 - a} 0 0`, bgcolor: SERIES[1], color: "#fff", fontSize: "0.62rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "flex-end", px: 0.6 }}>{1 - a > 0.2 ? `${((1 - a) * 100).toFixed(0)}%` : ""}</Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const top4 = (all: Record<string, number>) => Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, SERIES.length).map(([c]) => c);
const splitBy = (order: string[], channels: Record<string, number>) => [...order.map((c) => channels[c] ?? 0), Object.entries(channels).filter(([c]) => !order.includes(c)).reduce((a, [, v]) => a + v, 0)];
const partsOf = (order: string[], other = "Other") => [...order.map((c, i) => ({ label: c, color: SERIES[i] })), { label: other, color: DEEMPHASIS }];

/**
 * A Visit KPI's graph at tile size, the same as its card on the page; null when there is none (or
 * the read is not in yet) - the tile then draws its months.
 */
export function VisitTileChart({ id, views, d, year }: { id: string; views: Record<string, KpiView>; d: VisitData | null; year: number }): React.ReactNode {
  const done = views.V01?.upTo ?? d?.monthsDone ?? 0;
  const months = Array.from({ length: Math.max(0, done) }, (_, i) => i);
  if (id === "V01" && views.V01 && views.V02N) {
    const rows = months.map((i) => { const u = views.V01.series.months[i] ?? 0, n = views.V02N.series.months[i] ?? 0; return { m: MONTHS[i], vals: [n, Math.max(0, u - n)] }; });
    return rows.length ? <MonthStack rows={rows} parts={[{ label: "New", color: SERIES[0] }, { label: "Returning", color: SERIES[1] }]} /> : null;
  }
  if (id === "V02" && views.V01 && views.V02N) return <ShareBars users={views.V01} fresh={views.V02N} year={year} />;
  if (id === "V06" && views.V06G?.series.months.some((x) => x != null)) return <MiniBars v={views.V06G} />;
  if (!d) return null;
  if (id === "V03") {
    const order = [...CHANNEL_GROUPS];
    const rows = groupsByMonth(d, year, months).map((g) => ({ m: MONTHS[g.month], vals: splitBy(order, g.groups) }));
    return rows.length ? <MonthStack rows={rows} parts={partsOf(order)} /> : null;
  }
  if (id === "V04") {
    const rows = usersAbroad(d, year, months, {}, true).slice(0, 5).map((r) => ({ label: r.label, vals: [r.users], py: r.pyUsers }));
    return rows.length ? <RowBars rows={rows} parts={[{ label: String(year), color: SERIES[0] }]} /> : null;
  }
  if (id === "V05" || id === "V08") {
    const list = id === "V05"
      ? storeChannels(d).slice(0, 4).map((r) => ({ label: r.label, channels: r.channels }))
      : landingTable(d, {}, 4).map((r) => ({ label: r.page, channels: r.channels }));
    const all: Record<string, number> = {};
    for (const r of list) for (const [c, v] of Object.entries(r.channels)) all[c] = (all[c] ?? 0) + v;
    const order = top4(all).slice(0, 3);
    return list.length ? <RowBars rows={list.map((r) => ({ label: r.label, vals: splitBy(order, r.channels) }))} parts={partsOf(order, "Other channels")} /> : null;
  }
  if (id === "V07" && d.liveLogins?.days.length) {
    const rows = d.liveLogins.days.slice(-14).map(([day, p1, , p2]) => ({ m: `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`, tick: String(Number(day.slice(8, 10))), vals: [p1, p2] }));
    return <MonthStack rows={rows} parts={[{ label: "Prio 1", color: SERIES[0] }, { label: "Prio 2", color: SERIES[1] }]} />;
  }
  return null;
}

/** The shop accounts without a company, compact - for the nutshell's Visit panel. */
export function ShopAccountsCompact({ u }: { u: VisitData["unlinked"] }) {
  if (!u) return null;
  return (
    <Box sx={{ ...glass, borderRadius: "20px", p: 2.25, display: "grid", gap: 1, minWidth: 0, height: "100%", alignContent: "start" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, pr: 3 }}>
        <Badge icon={<LinkOffIcon />} tint="amber" size={32} />
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED, lineHeight: 1.25, pt: 0.75 }}>Shop accounts without a company</Typography>
      </Box>
      <Typography sx={{ fontSize: "1.9rem", fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{n0(u.total)}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.45 }}>
        <b style={{ color: INK }}>{n0(u.matched)}</b> to link - {n0(u.withOrders ?? 0)} by their orders · {n0(u.business)} business address, no company · {n0(u.free)} free e-mail
      </Typography>
      <Box>
        <Button component="a" href="/uc/ticket-associations#shop-accounts" size="small" variant="contained" disableElevation sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}>Fix them</Button>
      </Box>
    </Box>
  );
}
