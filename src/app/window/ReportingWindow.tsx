"use client";

// ONE reporting window for the whole hub. Analytics, the SEO cockpit and the
// customer view all read it, so every figure on screen describes the same
// slice of time. It lives in localStorage so it survives navigation and
// reloads, and it is always resolved to explicit dates — a preset is just a
// way of choosing them.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";

export type WindowPreset = "7d" | "14d" | "28d" | "90d" | "180d" | "365d" | "mtd" | "lastMonth" | "custom";

export type ReportingWindow = {
  preset: WindowPreset;
  /** Inclusive ISO dates, YYYY-MM-DD. */
  from: string;
  to: string;
};

const STORAGE_KEY = "apsomh:reporting-window";
const MAX_SPAN_DAYS = 365;

export const PRESETS: { id: Exclude<WindowPreset, "custom">; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "28d", label: "Last 28 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "180d", label: "Last 180 days" },
  { id: "365d", label: "Last 365 days" },
  { id: "mtd", label: "This month so far" },
  { id: "lastMonth", label: "Last month" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shiftIso(iso: string, days: number): string {
  const d = parseIso(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Inclusive length in days. */
export function spanDays(from: string, to: string): number {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

export function resolvePreset(preset: Exclude<WindowPreset, "custom">, today = new Date()): { from: string; to: string } {
  const to = isoDate(today);
  if (preset === "mtd") {
    return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  if (preset === "lastMonth") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: isoDate(first), to: isoDate(last) };
  }
  const n = Number(preset.replace("d", ""));
  return { from: shiftIso(to, -(n - 1)), to };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(iso: string, withYear: boolean): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}

export function windowLabel(w: ReportingWindow): string {
  const preset = PRESETS.find((p) => p.id === w.preset);
  if (preset) return preset.label;
  const sameYear = w.from.slice(0, 4) === w.to.slice(0, 4);
  return `${prettyDate(w.from, !sameYear)} – ${prettyDate(w.to, true)}`;
}

/** The equivalent window immediately before — what deltas compare against. */
export function previousWindow(w: ReportingWindow): { from: string; to: string } {
  const len = spanDays(w.from, w.to);
  return { from: shiftIso(w.from, -len), to: shiftIso(w.from, -1) };
}

export function windowQuery(w: ReportingWindow): string {
  return `from=${w.from}&to=${w.to}`;
}

type Ctx = {
  window: ReportingWindow;
  days: number;
  label: string;
  previous: { from: string; to: string };
  setPreset: (id: Exclude<WindowPreset, "custom">) => void;
  setCustom: (from: string, to: string) => string | null;
};

const WindowContext = createContext<Ctx | null>(null);

const DEFAULT: ReportingWindow = { preset: "28d", ...resolvePreset("28d") };

function loadStored(): ReportingWindow {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ReportingWindow>;
    if (parsed.preset && parsed.preset !== "custom") {
      const p = PRESETS.find((x) => x.id === parsed.preset);
      // A relative preset is re-resolved against today, not against the day it was chosen.
      if (p) return { preset: p.id, ...resolvePreset(p.id) };
    }
    if (parsed.preset === "custom" && parsed.from && parsed.to && parseIso(parsed.from) && parseIso(parsed.to)) {
      return { preset: "custom", from: parsed.from, to: parsed.to };
    }
  } catch {
    /* storage unavailable — fall through */
  }
  return DEFAULT;
}

export function ReportingWindowProvider({ children }: { children: ReactNode }) {
  const [win, setWin] = useState<ReportingWindow>(DEFAULT);

  useEffect(() => {
    setWin(loadStored());
  }, []);

  const persist = useCallback((next: ReportingWindow) => {
    setWin(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode — the choice still applies for this page */
    }
  }, []);

  const setPreset = useCallback(
    (id: Exclude<WindowPreset, "custom">) => persist({ preset: id, ...resolvePreset(id) }),
    [persist],
  );

  const setCustom = useCallback(
    (from: string, to: string): string | null => {
      const a = parseIso(from);
      const b = parseIso(to);
      if (!a || !b) return "Both dates are needed.";
      if (a > b) return "The start must be on or before the end.";
      if (b > new Date()) return "The end cannot be in the future.";
      if (spanDays(from, to) > MAX_SPAN_DAYS) return `Keep the range to ${MAX_SPAN_DAYS} days or fewer.`;
      persist({ preset: "custom", from, to });
      return null;
    },
    [persist],
  );

  const value = useMemo<Ctx>(
    () => ({
      window: win,
      days: spanDays(win.from, win.to),
      label: windowLabel(win),
      previous: previousWindow(win),
      setPreset,
      setCustom,
    }),
    [win, setPreset, setCustom],
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

export function useReportingWindow(): Ctx {
  const ctx = useContext(WindowContext);
  if (!ctx) throw new Error("useReportingWindow must be used inside ReportingWindowProvider");
  return ctx;
}

/* ── the picker ─────────────────────────────────────────────────────────── */

export function WindowPicker() {
  const { window: win, label, days, setPreset, setCustom } = useReportingWindow();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [from, setFrom] = useState(win.from);
  const [to, setTo] = useState(win.to);
  const [error, setError] = useState<string | null>(null);

  const open = (e: React.MouseEvent<HTMLElement>) => {
    setFrom(win.from);
    setTo(win.to);
    setError(null);
    setAnchor(e.currentTarget);
  };
  const close = () => setAnchor(null);

  const applyCustom = () => {
    const problem = setCustom(from, to);
    setError(problem);
    if (!problem) close();
  };

  return (
    <>
      <Button
        onClick={open}
        variant="outlined"
        size="small"
        startIcon={<CalendarMonthIcon sx={{ fontSize: 16 }} />}
        endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        sx={{ fontWeight: 600, whiteSpace: "nowrap", bgcolor: "#fff" }}
      >
        {label}
        <Box component="span" sx={{ ml: 0.75, color: "#5b6470", fontWeight: 500 }}>
          · {days}d
        </Box>
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} slotProps={{ paper: { sx: { width: 300 } } }}>
        <Typography sx={{ px: 1.5, pt: 0.5, pb: 0.75, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b6470" }}>
          Reporting window
        </Typography>
        {PRESETS.map((p) => {
          const selected = win.preset === p.id;
          return (
            <MenuItem
              key={p.id}
              selected={selected}
              onClick={() => {
                setPreset(p.id);
                close();
              }}
              sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}
            >
              <span>{p.label}</span>
              {selected && <CheckIcon sx={{ fontSize: 16, color: "#274e64" }} />}
            </MenuItem>
          );
        })}
        <Divider sx={{ my: 0.75 }} />
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b6470", mb: 0.75 }}>
            Custom range
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="From"
              style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #d9dde3", borderRadius: 8, fontSize: 13 }}
            />
            <span style={{ color: "#5b6470" }}>–</span>
            <input
              type="date"
              value={to}
              min={from}
              max={isoDate(new Date())}
              onChange={(e) => setTo(e.target.value)}
              aria-label="To"
              style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #d9dde3", borderRadius: 8, fontSize: 13 }}
            />
          </Box>
          {error && (
            <Typography sx={{ fontSize: "0.74rem", color: "#c5221f", mt: 0.75 }}>{error}</Typography>
          )}
          <Button onClick={applyCustom} variant="contained" size="small" fullWidth sx={{ mt: 1 }}>
            Apply range
          </Button>
        </Box>
      </Menu>
    </>
  );
}
