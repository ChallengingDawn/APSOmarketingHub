"use client";

// SEND TO CONTENT - where it goes (SARCLA 10.11.2026: "upon sending to Content allow to create a new project or to
// associate to the current one + the ticket"; "A/B should also be sent to Content and then decided on Content" - all the
// optimization's versions go, Content decides which is tested). A new project, or a to-do added to a project the person
// may add to (Content's GET /api/content/projects/addable - it says which already hold this page); and its ticket in
// "From Scroll to Sale": none now, made, or an existing one linked by its number. Until Content's side is live (its
// addable answer missing) only "A new project" is offered.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ACCENT, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import { SquareChoice } from "../SquareChoice";
import { ticketNumber } from "@/lib/convert/handoff";

export type TicketAsk = { link: string } | { create: true } | null;
export type SendChoice = { project: number | null; ticket: TicketAsk };
type Addable = {
  id: number; title: string; stageLabel?: string; ownerName?: string; owner?: string; role?: string; updatedAt?: string;
  pages?: { env: string; path: string; versionId: string | null }[];
};


export function SendDialog({ open, onClose, onSend, env, path, versions, landing = false, busy, error }: {
  open: boolean; onClose: () => void; onSend: (c: SendChoice) => void;
  env: string; path: string; versions: number; landing?: boolean; busy: boolean; error: string | null;
}) {
  const [mode, setMode] = useState<"new" | "add">("new");
  const [projects, setProjects] = useState<Addable[] | null>(null);
  const [can, setCan] = useState<boolean | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [ticket, setTicket] = useState<"none" | "create" | "link">("none");
  const [num, setNum] = useState("");

  useEffect(() => {
    if (!open || can !== null) return;
    fetch("/api/content/projects/addable", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; projects?: Addable[] } | null) => { if (j?.ok) { setProjects(j.projects ?? []); setCan(true); } else setCan(false); })
      .catch(() => setCan(false));
  }, [open, can]);

  const holds = (p: Addable) => (p.pages ?? []).some((x) => x.env === env && x.path === path);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (projects ?? []).filter((p) => !t || p.title.toLowerCase().includes(t) || (p.ownerName ?? p.owner ?? "").toLowerCase().includes(t)).slice(0, 60);
  }, [projects, q]);

  const ask: TicketAsk = ticket === "create" ? { create: true } : ticket === "link" && ticketNumber(num) ? { link: ticketNumber(num) } : null;
  const ready = !busy && (mode === "new" || pick !== null) && !(ticket === "link" && !ticketNumber(num));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800, color: INK }}>Send to Content</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.75 }}>
        <Typography sx={{ fontSize: "0.86rem", color: INK, lineHeight: 1.45 }}>
          {landing
            ? <>The new page goes to Content as an <b>SEO landing page</b> with its brief - Content writes it there.</>
            : versions > 1
            ? <>All <b>{versions} versions</b> go to Content as the page&apos;s A/B versions - which one is tested, and the test itself, are decided there.</>
            : <>The version goes to Content&apos;s Page builder, where it is built and tested.</>}
        </Typography>

        <SquareChoice<"new" | "add"> label="Where" value={mode} onChange={(m) => { setMode(m); if (m === "new") setPick(null); }}
          options={[{ key: "new", label: "A new project" }, { key: "add", label: "Add to a project" }]} />

        {mode === "add" && can === null && <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={14} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading your projects…</Typography></Box>}
        {mode === "add" && can === false && (
          <Notice tone="warn">Adding to an existing project - with its ticket - comes with Content&apos;s next round. For now it goes to a new project.</Notice>
        )}
        {mode === "add" && can && (
          <Box sx={{ display: "grid", gap: 1 }}>
            <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a project by its name or owner" inputProps={{ "aria-label": "Find a project" }} />
            <Box sx={{ maxHeight: 280, overflowY: "auto", display: "grid", gap: 0.5, pr: 0.5 }}>
              {shown.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{projects?.length ? "No project matches." : "No project you may add to."}</Typography>}
              {shown.map((p) => (
                <Box key={p.id} component="button" type="button" onClick={() => setPick(p.id)} sx={{
                  all: "unset", cursor: "pointer", display: "grid", gap: 0.25, p: 1, borderRadius: "8px",
                  border: `1px solid ${pick === p.id ? ACCENT : HAIRLINE}`, bgcolor: pick === p.id ? "rgba(36,89,209,.06)" : "#fff",
                  boxShadow: pick === p.id ? `0 0 0 1px ${ACCENT}` : "none",
                }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{p.title}</Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                    {p.stageLabel && <Chip tint="slate">{p.stageLabel}</Chip>}
                    {holds(p) && <Chip tint="amber">Already holds this page</Chip>}
                    <Typography component="span" sx={{ fontSize: "0.74rem", color: MUTED }}>{p.ownerName ?? p.owner ?? ""}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {can && (
          <Box sx={{ display: "grid", gap: 1 }}>
            <SquareChoice<"none" | "create" | "link"> label="Its ticket" value={ticket} onChange={setTicket}
              options={[{ key: "none", label: "Not now" }, { key: "create", label: "Make a ticket" }, { key: "link", label: "Link a ticket" }]} />
            {ticket === "link" && (
              <TextField size="small" value={num} onChange={(e) => setNum(e.target.value)} placeholder="The ticket's number, or its HubSpot address"
                helperText={num && !ticketNumber(num) ? "A ticket number has at least 5 digits" : "A ticket of \"From Scroll to Sale\""} error={!!num && !ticketNumber(num)} />
            )}
            {ticket === "create" && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Made in &quot;From Scroll to Sale&quot; with the to-do, the hub&apos;s usual way.</Typography>}
          </Box>
        )}

        {error && <Notice tone="bad">{error}</Notice>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none", fontWeight: 600 }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!ready} onClick={() => onSend({ project: mode === "add" ? pick : null, ticket: can ? ask : null })}
          startIcon={busy ? <CircularProgress size={13} sx={{ color: "inherit" }} /> : undefined} sx={{ textTransform: "none", fontWeight: 700, borderRadius: "6px" }}>
          {busy ? "Sending…" : mode === "add" ? "Add to the project" : "Make the project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
