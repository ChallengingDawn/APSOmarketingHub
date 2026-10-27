"use client";
// THE BAND ON TOP OF EVERY SANDBOX PAGE (SARCLA 27.10.2026: a sandbox served on the hub's own address must never pass
// for the live hub) - amber, striped, whose sandbox it is, what waits, and where to bring it: the hub's Sandbox app
// (the decision to let data out is made on the hub, behind its login and its log). Delete all stays here - it only
// touches the sandbox. Its links back to the hub carry data-leave-sandbox, so the sandbox's path pin lets them leave.
// Rendered only when the layout says this copy is the sandbox; the real hub never draws it.

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

type State = { missing: number; refused: number; brought: number; wouldWrite: number; asks: number; hub: string | null; name: string | null };

const INK = "#4a2f05";
const STRIPES = "repeating-linear-gradient(135deg, #f8d98f 0 14px, #f4cd72 14px 28px)";
const onBand = { bgcolor: "rgba(255,255,255,0.92)", color: INK, borderColor: "rgba(74,47,5,0.35)", "&:hover": { bgcolor: "#fff", borderColor: INK } } as const;

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
  const note = !s ? ""
    : waiting > 0
      ? `${s.missing ? `${s.missing} read${s.missing === 1 ? "" : "s"}` : ""}${s.missing && s.asks ? " and " : ""}${s.asks ? `${s.asks} request${s.asks === 1 ? "" : "s"} from the CLI` : ""} waiting - bring them on the hub.`
      : `${s.brought} read${s.brought === 1 ? "" : "s"} brought, customers by their HubSpot number.`;
  const extra = [
    s && s.refused > 0 ? `${s.refused} refused by the hub` : "",
    s && s.wouldWrite > 0 ? `${s.wouldWrite} HubSpot write${s.wouldWrite === 1 ? "" : "s"} held back` : "",
    error ?? "",
  ].filter(Boolean).join(" · ");

  return (
    <Box role="status" aria-label="Sandbox" sx={{
      position: "sticky", top: 0, zIndex: 20, px: { xs: 1.5, md: 2.5 }, py: 0.9, background: STRIPES, color: INK,
      borderBottom: "1px solid rgba(74,47,5,0.25)", boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset",
      display: "flex", alignItems: "center", gap: { xs: 1, md: 2 }, flexWrap: "wrap",
    }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
        SANDBOX{s?.name ? ` · ${s.name}'s` : ""}
        <Box component="span" sx={{ fontWeight: 500, letterSpacing: 0 }}> · coded data – not the live hub</Box>
      </Typography>
      {/* on a phone the band is two lines: the count rides on the button, the sentence waits for a wider screen */}
      <Typography sx={{ display: { xs: "none", sm: "block" }, fontSize: "0.8rem", flex: "1 1 220px", minWidth: 0, fontWeight: waiting > 0 ? 600 : 400 }}>
        {note}{extra && <Box component="span" sx={{ opacity: 0.8 }}> {extra}</Box>}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", ml: { xs: 0, sm: "auto" } }}>
        <Button size="small" variant="outlined" disableElevation href={s?.hub ?? "/sandbox"} target="_blank" rel="noopener" data-leave-sandbox sx={onBand}>
          Bring data<Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>&nbsp;on the hub</Box>{waiting > 0 ? ` (${waiting})` : ""}
        </Button>
        <Button size="small" variant="outlined" href={s?.hub ? s.hub.replace(/\/sandbox$/, "/") : "/"} data-leave-sandbox sx={onBand}>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>The hub</Box>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Back to the hub</Box>
        </Button>
        <Button size="small" variant="outlined" disabled={busy} onClick={deleteAll} sx={onBand}>Delete all</Button>
      </Box>
    </Box>
  );
}
