"use client";

/**
 * PROFIT CENTRE - the split and the major centre, taken from order revenue.
 *
 * This tab replaces the HubSpot workflow "SARCLA | UPDATE COMPANY PF SPLIT VIA
 * DEAL (LATER ORDERS)". The gaps table is the part worth keeping: both
 * properties are enumerations, so HubSpot refuses a value that is not already
 * an option, and the workflow reported that only in an output field nobody
 * read. Here a bucket with no option is written broader and COUNTED, so the
 * hole is on the screen instead of in the data.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const ACCENT = "#ed1b2f";
const HAIRLINE = "rgba(21,34,58,.10)";

export type PcGap = { wanted: string; wrote: string; example: string; n: number };
export type PcRun = {
  at?: string; scanned?: number; planned?: number; written?: number; dry?: boolean;
  options_added?: string[];
  years?: number[];
  mode?: "changed" | "all";
  stats?: Record<string, number>;
  gaps?: PcGap[];
} | null;

const num = (n: number | undefined) => (n ?? 0).toLocaleString("de-CH");

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <Box sx={{ minWidth: 128 }}>
      <Typography sx={{ fontSize: 12, color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: 23, fontWeight: 700, color: tone ?? INK, letterSpacing: "-0.02em", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      {note && <Typography sx={{ fontSize: 12, color: FAINT }}>{note}</Typography>}
    </Box>
  );
}

export default function ProfitCentre({
  last, windowYears, running, canRun, onRun,
}: {
  last: PcRun;
  windowYears: number;
  running: boolean;
  canRun: boolean;
  onRun: (dry: boolean) => void;
}) {
  const s = last?.stats ?? {};
  const gaps = last?.gaps ?? [];
  const years = [...(last?.years ?? [])].sort((a, b) => a - b);
  // A list of twelve years is noise; the range says it.
  const span = years.length ? (years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`) : "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Card sx={{ p: 2.5 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: INK, mb: 0.5 }}>
          The split, from orders
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: MUTED, lineHeight: 1.55, maxWidth: "76ch" }}>
          Every company&apos;s <strong>profit_center_split</strong> and <strong>major_profit_center</strong>, decided from
          the revenue its orders actually carry per profit centre — the <code>rev_&lt;year&gt;_pc_monthly</code> figures the
          ERP already writes. {windowYears > 0
            ? `Over the last ${windowYears} years`
            : "Over every year the ERP has"}{span ? ` (${span})` : ""}, so “No sales” means never ordered, not
          “not lately”. Nothing waits for a deal.
        </Typography>

        <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
          <Button size="small" variant="outlined" disabled={running || !canRun} onClick={() => onRun(true)}
            sx={{ fontWeight: 600, borderColor: HAIRLINE, color: INK }}>
            Preview, write nothing
          </Button>
          <Button size="small" variant="contained" disableElevation disabled={running || !canRun} onClick={() => onRun(false)}
            sx={{ fontWeight: 700, bgcolor: INK, "&:hover": { bgcolor: "#0f1a2c" } }}>
            Re-check every company now
          </Button>
          {!canRun && <Typography sx={{ fontSize: 12.5, color: FAINT, alignSelf: "center" }}>Admins only.</Typography>}
        </Box>
        <Typography sx={{ fontSize: 12, color: FAINT, mt: 1 }}>
          Every night after the sweep it re-checks only the companies whose revenue moved since the last pass — a split
          can change for no other reason. The button above re-checks all of them.
        </Typography>
      </Card>

      <Card sx={{ p: 2.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: INK, mb: 1.5 }}>
          Last pass{last?.at ? ` · ${new Date(last.at).toLocaleString("de-CH")}` : ""}{last?.dry ? " · preview" : ""}
          {last?.mode === "changed" ? " · only the companies whose revenue moved" : last?.mode === "all" ? " · every company" : ""}
        </Typography>
        {!last ? (
          <Typography sx={{ fontSize: 13.5, color: MUTED }}>Not run yet. Preview it first — it writes nothing.</Typography>
        ) : (
          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Figure label="Companies read" value={num(last.scanned)} />
            <Figure label="Would change" value={num(last.planned)} note={`${num(s.no_change)} already right`} />
            <Figure label="Written" value={num(last.written)} tone={last.dry ? FAINT : INK} note={last.dry ? "preview — nothing written" : undefined} />
            <Figure label="No sales in the window" value={num(s.no_sales)} />
            <Figure label="Fell back" value={num(s.fell_back)} tone={s.fell_back ? ACCENT : INK}
              note={last.options_added?.length ? `${last.options_added.length} option(s) added, then written exactly` : s.fell_back ? "the property has no such bucket" : "every bucket existed"} />
          </Box>
        )}
      </Card>

      {gaps.length > 0 && (
        <Card sx={{ p: 2.5, borderLeft: `3px solid ${ACCENT}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: INK }}>
            Buckets the property cannot hold
          </Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5, mb: 1.5, lineHeight: 1.55, maxWidth: "76ch" }}>
            These companies&apos; real split had no option on <strong>profit_center_split</strong>. A real pass now ADDS the
            missing option and writes the exact value — only ever one of the 35 shapes five centres can produce, so the
            property cannot grow without bound. A preview adds nothing and shows what it would add.
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 0, fontSize: 13 }}>
            <Box sx={{ py: 0.75, borderBottom: `1px solid ${HAIRLINE}`, color: FAINT, fontSize: 11.5 }}>Their real split</Box>
            <Box sx={{ py: 0.75, borderBottom: `1px solid ${HAIRLINE}`, color: FAINT, fontSize: 11.5 }}>Written instead</Box>
            <Box sx={{ py: 0.75, borderBottom: `1px solid ${HAIRLINE}`, color: FAINT, fontSize: 11.5, textAlign: "right" }}>Companies</Box>
            {gaps.map((g) => (
              <Box key={g.wanted} sx={{ display: "contents" }}>
                <Box sx={{ py: 0.9, borderBottom: `1px solid ${HAIRLINE}`, color: INK, fontWeight: 600 }}>{g.wanted}</Box>
                <Box sx={{ py: 0.9, borderBottom: `1px solid ${HAIRLINE}`, color: MUTED }}>{g.wrote}</Box>
                <Box sx={{ py: 0.9, borderBottom: `1px solid ${HAIRLINE}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(g.n)}</Box>
              </Box>
            ))}
          </Box>
        </Card>
      )}
    </Box>
  );
}
