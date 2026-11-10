"use client";

// DUPLICATES & MERGES > Companies - a person's decision on a group (Merge / Not duplicates), shared by the table's rows
// and the one-by-one review. What was decided shows at once; the next read confirms.

import { createContext, useContext, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { FAINT, RED } from "@/app/uc/report/ui";
import type { Group } from "@/lib/companyDuplicates/rules";
import { numberText, place } from "./parts";

export type Action = "merge" | "apart";
type Ctx = { done: Record<string, string>; admin: boolean; act: (g: Group, action: Action) => Promise<{ ok: boolean; text: string }> };
export const Decisions = createContext<Ctx>({ done: {}, admin: false, act: async () => ({ ok: false, text: "" }) });
export const useDecisions = () => useContext(Decisions);

/** The decision sent: the result kept per group (shown at once), the page read again. */
export function useDecisionState(admin: boolean, again: () => void): Ctx {
  const [done, setDone] = useState<Record<string, string>>({});
  const act = async (g: Group, action: Action) => {
    const r = await fetch("/api/uc/company-duplicates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, key: g.key }) });
    const j = (await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))) as { ok: boolean; error?: string };
    const text = j.ok ? (action === "merge" ? "Merged" : "Kept apart") : `Could not: ${j.error ?? "failed"}`;
    setDone((x) => ({ ...x, [g.key]: text }));
    if (j.ok) again();
    return { ok: j.ok, text };
  };
  return { done, admin, act };
}

export function confirmText(g: Group, action: Action) {
  const keep = g.members.find((c) => c.id === g.into);
  const others = g.members.filter((c) => c.id !== g.into).map((c) => `- ${c.name} (${numberText(c)}, ${place(c)})`).join("\n");
  return action === "merge"
    ? `Merge into ${keep?.name} (${keep ? `${numberText(keep)}, ${place(keep)}` : ""})?\n\n${others}\n\nIts deals, contacts, tickets and orders go with it. A merge cannot be undone in HubSpot.`
    : `Keep these ${g.members.length} companies apart for good?\n\nThey will not be shown again.`;
}

/** Merge / Not duplicates on a group's row - or what was decided. */
export function Decide({ g }: { g: Group }) {
  const { done, admin, act } = useDecisions();
  const [busy, setBusy] = useState<Action | null>(null);
  if (done[g.key]) return <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 700, color: done[g.key].startsWith("Could not") ? RED : "#1f8a4c", whiteSpace: "nowrap" }}>{done[g.key]}</Typography>;
  if (!admin) return <Typography component="span" sx={{ fontSize: "0.76rem", color: FAINT, whiteSpace: "nowrap" }}>an admin decides</Typography>;
  const go = async (action: Action) => {
    if (!window.confirm(confirmText(g, action))) return;
    setBusy(action);
    try { await act(g, action); } finally { setBusy(null); }
  };
  const btn = { textTransform: "none", minWidth: 0, px: 1.2, py: 0.2, fontSize: "0.76rem", whiteSpace: "nowrap" } as const;
  return (
    <Box component="span" sx={{ display: "inline-flex", gap: 0.5, flexShrink: 0 }}>
      <Button size="small" variant="contained" disableElevation disabled={!!busy} onClick={() => void go("merge")} sx={btn}>
        {busy === "merge" ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : "Merge"}
      </Button>
      <Button size="small" variant="outlined" disabled={!!busy} onClick={() => void go("apart")} sx={btn}>
        {busy === "apart" ? <CircularProgress size={12} /> : "Not duplicates"}
      </Button>
    </Box>
  );
}
