"use client";

// DUPLICATES & MERGES > Companies - one group at a time (SARCLA 10.11.2026: "for these ones we see that they are
// duplicates from far - can we put a swipe mode where you can just click?"). The companies side by side, what differs
// marked; Merge (→), Not duplicates (←), Skip (↓), Back (↑) - a key or a click, then the next group of the list as
// filtered. The card is the confirmation: what is shown is what is merged.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import EastIcon from "@mui/icons-material/East";
import WestIcon from "@mui/icons-material/West";
import SouthIcon from "@mui/icons-material/South";
import NorthIcon from "@mui/icons-material/North";
import { full } from "@/app/charts/format";
import { Chip } from "@/app/connectors/parts";
import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import type { Company, Group } from "@/lib/companyDuplicates/rules";
import { useDecisions, type Action } from "./decide";
import { KIND_LABEL, cap, dmy, kindOf, link, numberText } from "./parts";

const FIELDS: { label: string; get: (c: Company) => string }[] = [
  { label: "Customer number", get: numberText },
  { label: "Address", get: (c) => c.address ?? "" },
  { label: "Postcode", get: (c) => c.zip ?? "" },
  { label: "City", get: (c) => c.city ?? "" },
  { label: "Country", get: (c) => cap(c.country) },
  { label: "Website", get: (c) => c.domain ?? "" },
  { label: "Company unique number", get: (c) => c.unique ?? "" },
  { label: "Phone", get: (c) => c.phone ?? "" },
  { label: "Owner", get: (c) => c.ownerName ?? "" },
  { label: "Created", get: (c) => dmy(c.createdate) },
  { label: "Last order", get: (c) => (c.lastOrder ? dmy(c.lastOrder) : c.lastYear ? String(c.lastYear) : "") },
  { label: "Revenue this year (EUR)", get: (c) => (c.revenue ? full(c.revenue) : "") },
  { label: "Deals · contacts", get: (c) => `${full(c.deals)} · ${full(c.contacts)}` },
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function Review({ groups, onClose }: { groups: Group[]; onClose: () => void }) {
  const { done, admin, act } = useDecisions();
  // the list as it was when the review opened - decided groups stay in it, shown as done
  const list = useMemo(() => groups, [groups]);
  const [i, setI] = useState(() => Math.max(0, groups.findIndex((g) => !done[g.key])));
  const [busy, setBusy] = useState<Action | null>(null);
  const [tally, setTally] = useState({ merged: 0, apart: 0, skipped: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const g = list[i];
  const next = useCallback(() => setI((x) => { let y = x + 1; while (y < list.length && done[list[y].key]) y++; return Math.min(y, list.length); }), [list, done]);
  const decide = useCallback(async (action: Action) => {
    if (!g || busy || !admin || done[g.key]) return;
    setBusy(action); setMsg(null);
    try {
      const r = await act(g, action);
      if (r.ok) { setTally((t) => ({ ...t, [action === "merge" ? "merged" : "apart"]: t[action === "merge" ? "merged" : "apart"] + 1 })); next(); }
      else setMsg(r.text);
    } finally { setBusy(null); }
  }, [g, busy, admin, done, act, next]);
  const skip = useCallback(() => { if (!g) return; setTally((t) => ({ ...t, skipped: t.skipped + 1 })); setMsg(null); next(); }, [g, next]);
  const back = useCallback(() => { setMsg(null); setI((x) => Math.max(0, x - 1)); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); void decide("merge"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); void decide("apart"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); skip(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, skip, back]);

  const differs = (f: (typeof FIELDS)[number]) => !!g && new Set(g.members.map((c) => norm(f.get(c)))).size > 1;
  const merges = g && (g.kind === "erp" || g.kind === "possible");
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <Box sx={{ p: { xs: 2, md: 2.5 }, position: "relative" }}>
        <IconButton onClick={onClose} aria-label="Close" size="small" sx={{ position: "absolute", top: 12, right: 12 }}><CloseIcon fontSize="small" /></IconButton>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap", pr: 5, mb: 1.5 }}>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: INK }}>One by one</Typography>
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
            {g ? `${full(i + 1)} of ${full(list.length)}` : `${full(list.length)} looked at`} · {full(tally.merged)} merged · {full(tally.apart)} kept apart · {full(tally.skipped)} skipped
          </Typography>
        </Box>
        {!g ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK }}>That was the last one of the list.</Typography>
            <Button onClick={onClose} sx={{ mt: 1.5, textTransform: "none" }} variant="outlined">Back to the table</Button>
          </Box>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
              <Chip tint={g.kind === "erp" ? "green" : g.otherNames ? "amber" : "purple"}>{KIND_LABEL[kindOf(g)]}</Chip>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK }}>{g.why}</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>· came {dmy(g.newest)}</Typography>
              {done[g.key] && <Chip tint={done[g.key].startsWith("Could not") ? "pink" : "green"}>{done[g.key]}</Chip>}
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: `150px repeat(${g.members.length}, minmax(220px, 1fr))`, border: `1px solid ${HAIRLINE}`, borderRadius: "12px", overflow: "hidden", minWidth: 150 + 220 * g.members.length }}>
                <Box sx={{ bgcolor: "rgba(21,34,58,.03)" }} />
                {g.members.map((c) => {
                  const keeps = merges && c.id === g.into;
                  return (
                    <Box key={c.id} sx={{ p: 1.25, bgcolor: keeps ? "rgba(27,122,85,.07)" : "rgba(21,34,58,.03)", borderLeft: `1px solid ${HAIRLINE}` }}>
                      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                        <Typography component="span" sx={{ fontSize: "0.92rem", fontWeight: 800 }}>{link(c.id, c.name)}</Typography>
                        {keeps && <Box component="span" sx={{ fontSize: "0.68rem", fontWeight: 800, color: TINT.green.fg, bgcolor: TINT.green.bg, px: 0.75, py: 0.1, borderRadius: "6px" }}>keeps</Box>}
                      </Box>
                      {merges && !keeps && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>goes into the green one</Typography>}
                    </Box>
                  );
                })}
                {FIELDS.map((f) => {
                  const diff = differs(f);
                  return [
                    <Box key={`${f.label}-l`} sx={{ px: 1.25, py: 0.75, borderTop: `1px solid ${HAIRLINE}`, fontSize: "0.74rem", fontWeight: 700, color: diff ? "#a96a12" : MUTED, bgcolor: diff ? "rgba(237,161,0,.07)" : undefined }}>{f.label}</Box>,
                    ...g.members.map((c) => (
                      <Box key={`${f.label}-${c.id}`} sx={{ px: 1.25, py: 0.75, borderTop: `1px solid ${HAIRLINE}`, borderLeft: `1px solid ${HAIRLINE}`, fontSize: "0.84rem", color: f.get(c) ? INK : FAINT, bgcolor: diff ? "rgba(237,161,0,.07)" : undefined, wordBreak: "break-word" }}>{f.get(c) || "—"}</Box>
                    )),
                  ];
                })}
              </Box>
            </Box>
            {msg && <Typography sx={{ fontSize: "0.84rem", color: RED, mt: 1 }}>{msg}</Typography>}
            <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="outlined" startIcon={<WestIcon />} disabled={!admin || !!busy || !!done[g.key]} onClick={() => void decide("apart")} sx={{ textTransform: "none" }}>
                {busy === "apart" ? <CircularProgress size={14} /> : "Not duplicates"}
              </Button>
              <Button variant="text" startIcon={<SouthIcon />} disabled={!!busy} onClick={skip} sx={{ textTransform: "none" }}>Skip</Button>
              <Button variant="text" startIcon={<NorthIcon />} disabled={!!busy || i === 0} onClick={back} sx={{ textTransform: "none" }}>Back</Button>
              <Box sx={{ flex: 1 }} />
              {!admin && <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>an admin decides</Typography>}
              <Button variant="contained" disableElevation endIcon={<EastIcon />} disabled={!admin || !!busy || !!done[g.key]} onClick={() => void decide("merge")} sx={{ textTransform: "none", px: 3 }}>
                {busy === "merge" ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Merge"}
              </Button>
            </Box>
            <Typography sx={{ fontSize: "0.72rem", color: FAINT, mt: 1 }}>Keys: → Merge · ← Not duplicates · ↓ Skip · ↑ Back. What differs is marked. A merge cannot be undone in HubSpot.</Typography>
          </>
        )}
      </Box>
    </Dialog>
  );
}
