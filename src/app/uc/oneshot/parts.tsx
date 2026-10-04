"use client";

// Small pieces the one-shot action boards share.

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import InputBase from "@mui/material/InputBase";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { ACCENT, FAINT, HAIRLINE, INK, MUTED, TINT, TRACK, type Tint } from "@/app/uc/report/ui";

const PORTAL = "26492587";
export const hsCompany = (id: string) => `https://app-eu1.hubspot.com/contacts/${PORTAL}/record/0-2/${id}`;

/** 2026-09-22 -> 22.09.2026 */
export const dmy = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
/** 2026-09-22 -> 22.09 */
export const dm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "—");
/** A share in words; under 1% keeps a decimal so a real 0.4% does not read as nothing. */
export function pctText(a: number, b: number): string {
  if (!(b > 0)) return "—";
  const p = (100 * a) / b;
  return p > 0 && p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

/** A labelled bar: what is done out of what there is. */
export function Meter({ label, value, of, text, color = ACCENT }: {
  label: string; value: number; of: number; text: string; color?: string;
}) {
  const share = of > 0 ? Math.min(1, value / of) : 0;
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.6 }}>
        <Typography sx={{ fontSize: "0.84rem", fontWeight: 600, color: INK }}>{label}</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{text}</Typography>
      </Box>
      <Box sx={{ height: 10, borderRadius: 99, bgcolor: TRACK, overflow: "hidden" }} title={text}>
        <Box sx={{ width: `${share * 100}%`, height: "100%", bgcolor: color, borderRadius: 99 }} />
      </Box>
    </Box>
  );
}

/** One row of filter pills; the selected one is filled. */
export function FilterChips<T extends string>({ value, onChange, options, tint = "blue" }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; tint?: Tint;
}) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Chip key={o.id} size="small" label={o.label} onClick={() => onChange(o.id)} aria-pressed={on}
            sx={{
              height: 26, fontSize: "0.76rem", fontWeight: 600, cursor: "pointer",
              bgcolor: on ? TINT[tint].bg : "rgba(21,34,58,.05)", color: on ? TINT[tint].fg : MUTED,
              border: `1px solid ${on ? TINT[tint].fg + "33" : "transparent"}`,
            }} />
        );
      })}
    </Box>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, height: 32, borderRadius: "10px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", minWidth: 220 }}>
      <SearchIcon sx={{ fontSize: 16, color: FAINT }} />
      <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        inputProps={{ "aria-label": placeholder }} sx={{ fontSize: "0.82rem", flex: 1 }} />
    </Box>
  );
}

export function CompanyLink({ id }: { id: string }) {
  return (
    <Tooltip title="Open the company in HubSpot">
      <IconButton size="small" href={hsCompany(id)} target="_blank" rel="noreferrer" aria-label="Open the company in HubSpot">
        <BusinessOutlinedIcon sx={{ fontSize: 15, color: ACCENT }} />
      </IconButton>
    </Tooltip>
  );
}

/** Says which days the figures cover, and why when the period was cut to the action. */
export function PeriodLine({ from, to, empty, clipped, start, end }: {
  from: string; to: string; empty: boolean; clipped: boolean; start: string; end: string | null;
}) {
  return (
    <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: -0.5 }}>
      {empty
        ? `The period picked falls outside the action (${dmy(start)}${end ? ` to ${dmy(end)}` : " onwards"}), so the period figures are empty.`
        : `Orders counted ${dmy(from)} to ${dmy(to)}${clipped ? ` - the period picked, cut to the action's own days (${dmy(start)}${end ? ` to ${dmy(end)}` : " onwards"})` : ""}.`}
    </Typography>
  );
}
