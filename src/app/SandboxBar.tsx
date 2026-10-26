"use client";
// THE BAR ON TOP OF EVERY SANDBOX PAGE - what this sandbox holds, what waits, and where to bring it: the hub's Sandbox
// app (the decision to let data out is made on the hub, behind its login and its log). Delete all stays here - it
// only touches the sandbox. Rendered only when the layout says this copy is the sandbox; the real hub never draws it.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { AMBER, FAINT, HAIRLINE, MUTED, glass } from "./uc/report/ui";
import { Chip } from "./connectors/parts";

type State = { missing: number; refused: number; brought: number; wouldWrite: number; asks: number; hub: string | null };

export default function SandboxBar() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/sandbox", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const next = (await r.json()) as State;
    // a poll that sets an equal object would redraw every page every round
    setS((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  useEffect(() => {
    load();
    // again once the page has made its own reads, so their misses show without waiting for the next round
    const settle = setTimeout(load, 3_000);
    const t = setInterval(load, 15_000);
    return () => { clearTimeout(settle); clearInterval(t); };
  }, [load]);

  async function deleteAll() {
    if (!confirm("Delete all brought and test data in this sandbox? Logins stay.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sandbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete-all" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `failed (${r.status})`);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const waiting = (s?.missing ?? 0) + (s?.asks ?? 0);
  const note = !s ? " "
    : waiting > 0
      ? `${s.missing ? `${s.missing} read${s.missing === 1 ? "" : "s"} of this sandbox` : ""}${s.missing && s.asks ? " and " : ""}${s.asks ? `${s.asks} request${s.asks === 1 ? "" : "s"} from the CLI` : ""} waiting - bring them on the hub.`
      : "Coded data only: customers by their HubSpot number, nothing real is stored.";

  return (
    <Box sx={{ ...glass, position: "sticky", top: 0, zIndex: 5, mx: { xs: 1, md: 2 }, mt: 1, px: 2, py: 1,
      display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", borderColor: HAIRLINE }}>
      <Chip tint="amber">Sandbox</Chip>
      <Typography sx={{ fontSize: "0.8rem", color: waiting > 0 ? AMBER : MUTED, flex: "1 1 220px", minWidth: 0 }}>
        {note}
        {s && s.refused > 0 && <Box component="span" sx={{ color: AMBER }}> {s.refused} refused by the hub.</Box>}
        {s && s.wouldWrite > 0 && <Box component="span" sx={{ color: FAINT }}> {s.wouldWrite} HubSpot write{s.wouldWrite === 1 ? "" : "s"} held back.</Box>}
        {error && <Box component="span" sx={{ color: AMBER }}> {error}</Box>}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {s?.hub && (
          <Button size="small" variant={waiting > 0 ? "contained" : "outlined"} disableElevation href={s.hub} target="_blank" rel="noopener">
            Bring data on the hub{waiting > 0 ? ` (${waiting})` : ""}
          </Button>
        )}
        <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={deleteAll}>Delete all</Button>
      </Box>
      <Typography sx={{ width: "100%", display: { xs: "none", md: "block" }, fontSize: "0.7rem", color: FAINT, mt: -0.5 }}>
        {s ? `${s.brought} read${s.brought === 1 ? "" : "s"} brought` : " "}
      </Typography>
    </Box>
  );
}
