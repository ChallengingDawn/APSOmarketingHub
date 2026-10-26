"use client";
// THE BAR ON TOP OF EVERY SANDBOX PAGE - Bring data (the reads this page could not answer, fetched coded by the hub),
// Bring requested data (what was asked from the CLI), Delete all. Rendered only when the layout says this copy is the
// sandbox; the real hub never draws it.

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { AMBER, FAINT, HAIRLINE, MUTED, glass } from "./uc/report/ui";
import { Chip } from "./connectors/parts";

type State = { missing: number; asked: number; refused: number; brought: number; wouldWrite: number; asks: number; asksAsked: number };

export default function SandboxBar() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/sandbox", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const next = (await r.json()) as State;
    // the hub answered what was asked: read the page again, now from what it sent
    if (waiting.current && next.asked === 0 && next.asksAsked === 0) {
      waiting.current = false;
      window.location.reload();
      return;
    }
    setS(next);
  }, []);

  useEffect(() => {
    load();
    // again once the page has made its own reads, so their misses show without waiting for the next round
    const settle = setTimeout(load, 3_000);
    const t = setInterval(load, waiting.current ? 5_000 : 15_000);
    return () => { clearTimeout(settle); clearInterval(t); };
  }, [load, s?.asked, s?.asksAsked]);

  async function act(action: "bring" | "bring-requested" | "delete-all") {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sandbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `failed (${r.status})`);
      if (action === "delete-all") { window.location.reload(); return; }
      if (j.asked > 0) waiting.current = true;
      setS(j.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const askedNow = (s?.asked ?? 0) + (s?.asksAsked ?? 0);
  const note = askedNow > 0
    ? "Asked the hub - it answers within a minute, then this page reads again."
    : s && s.missing > 0
      ? `${s.missing} read${s.missing === 1 ? "" : "s"} of this sandbox ${s.missing === 1 ? "is" : "are"} not here yet.`
      : "Coded data only: customers by their HubSpot number, nothing real is stored.";

  return (
    <Box sx={{ ...glass, position: "sticky", top: 0, zIndex: 5, mx: { xs: 1, md: 2 }, mt: 1, px: 2, py: 1,
      display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", borderColor: HAIRLINE }}>
      <Chip tint="amber">Sandbox</Chip>
      <Typography sx={{ fontSize: "0.8rem", color: askedNow > 0 ? AMBER : MUTED, flex: "1 1 220px", minWidth: 0 }}>
        {note}
        {s && s.refused > 0 && <Box component="span" sx={{ color: AMBER }}> {s.refused} refused by the hub.</Box>}
        {s && s.wouldWrite > 0 && <Box component="span" sx={{ color: FAINT }}> {s.wouldWrite} HubSpot write{s.wouldWrite === 1 ? "" : "s"} held back.</Box>}
        {error && <Box component="span" sx={{ color: AMBER }}> {error}</Box>}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button size="small" variant="contained" disableElevation disabled={busy || !s || s.missing === 0} onClick={() => act("bring")}>
          Bring data{s && s.missing > 0 ? ` (${s.missing})` : ""}
        </Button>
        <Button size="small" variant="outlined" disabled={busy || !s || s.asks === 0} onClick={() => act("bring-requested")}>
          Bring requested data{s && s.asks > 0 ? ` (${s.asks})` : ""}
        </Button>
        <Button size="small" variant="outlined" color="warning" disabled={busy}
          onClick={() => { if (confirm("Delete all brought and test data in the sandbox? Logins stay.")) act("delete-all"); }}>
          Delete all
        </Button>
      </Box>
      <Typography sx={{ width: "100%", display: { xs: "none", md: "block" }, fontSize: "0.7rem", color: FAINT, mt: -0.5 }}>
        {s ? `${s.brought} read${s.brought === 1 ? "" : "s"} brought` : " "}
      </Typography>
    </Box>
  );
}
