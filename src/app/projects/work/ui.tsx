"use client";
// The pieces the content pages share (SARCLA 07.11.2026: content as a team's work): faces, the stage and status chips,
// the person picker. Colours come from the UC design kit, so these pages read as the rest of the hub's micro apps.

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";

import { Chip } from "@/app/connectors/parts";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import type { Tint } from "@/app/uc/report/ui";
import { STAGE_LABEL, STATUS_LABEL, type PieceStatus, type Stage } from "@/lib/content/pieceRules";

export const PINK = "#c22c6e";

export const STAGE_TINT: Record<Stage, Tint> = { planned: "slate", making: "blue", review: "amber", approved: "green", live: "purple" };
export const STAGE_DOT: Record<Stage, string> = { planned: "#4a5a70", making: "#2459d1", review: "#c97a10", approved: "#1b7a55", live: "#6a46c9" };
export const STATUS_TINT: Record<PieceStatus, Tint> = { todo: "slate", writing: "blue", review: "amber", changes: "pink", approved: "green", live: "purple" };

export const StageChip = ({ stage }: { stage: Stage }) => <Chip tint={STAGE_TINT[stage]}>{STAGE_LABEL[stage]}</Chip>;
export const StatusChip = ({ status }: { status: PieceStatus }) => <Chip tint={STATUS_TINT[status]}>{STATUS_LABEL[status]}</Chip>;

/** A person's colour: the same for them on every content page, from their username. */
// twelve hues far apart, so two people side by side never read as one
const FACE = ["#2459d1", "#c22c6e", "#1b7a55", "#b0650c", "#6a46c9", "#0e7c8c", "#c5221f", "#4a5a70", "#7a5a00", "#9c27b0", "#2e7d32", "#ad1457"];
export function faceColour(username: string): string {
  let h = 2166136261;
  for (const c of username.toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return FACE[h % FACE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Face({ username, name, size = 28, ring }: { username: string; name: string; size?: number; ring?: boolean }) {
  return (
    <Tooltip title={name}>
      <Box component="span" aria-label={name} sx={{
        width: size, height: size, borderRadius: "50%", display: "inline-grid", placeItems: "center", flexShrink: 0,
        bgcolor: faceColour(username), color: "#fff", fontSize: size * 0.38, fontWeight: 700, border: "2px solid #fff",
        boxSizing: "border-box", boxShadow: ring ? `0 0 0 2px ${PINK}` : undefined,
      }}>{initials(name)}</Box>
    </Tooltip>
  );
}

/** Overlapping faces, the owner ringed. */
export function Faces({ people, names, owner, size = 26, max = 5 }: { people: string[]; names: Record<string, string>; owner?: string | null; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", pl: 0.75 }}>
      {shown.map((u) => <Box key={u} sx={{ ml: -0.75 }}><Face username={u} name={names[u] ?? u} size={size} ring={u === owner} /></Box>)}
      {people.length > max && <Box component="span" sx={{ ml: 0.5, fontSize: "0.75rem", color: "#5d6b85", fontWeight: 600 }}>+{people.length - max}</Box>}
    </Box>
  );
}

export type PersonOpt = { username: string; name: string };

/** One person out of the people who may be in a content project ("Nobody" allowed). */
export function PersonPick({ label, value, onChange, people, disabled, width = 170 }: {
  label: string; value: string | null; onChange: (u: string | null) => void; people: PersonOpt[]; disabled?: boolean; width?: number;
}) {
  return (
    <TextField select size="small" label={label} value={value ?? ""} disabled={disabled} sx={{ ...field, width }}
      onChange={(e) => onChange(e.target.value || null)}>
      <MenuItem value=""><em>Nobody yet</em></MenuItem>
      {people.map((p) => <MenuItem key={p.username} value={p.username}>{p.name}</MenuItem>)}
    </TextField>
  );
}

/** "12 Nov" from "2026-11-12", without a time zone moving the day. */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Today as "YYYY-MM-DD" in the viewer's own day. */
export function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Overdue or due within three days: the date in red. */
export function dueSoon(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date();
  const days = (Date.UTC(y, m - 1, d) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86_400_000;
  return days <= 3;
}

export async function postWork(projectId: number, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const r = await fetch(`/api/content/projects/${projectId}/work`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false, error: `The hub answered ${r.status}.` }));
}
