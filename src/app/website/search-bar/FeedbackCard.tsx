"use client";

// Search bar > Setup > Customer feedback: what customers wrote with the bar's feedback button, and its handling -
// status, a HubSpot ticket (only on a click), the reply drafted as a note on that ticket. Moved from the old
// dashboard (SARCLA 17.10.2026) so its search-bar pages can go; it sits on Setup, under the switch of the button
// itself, since the Feedback tab left the page. Name and e-mail are personal data: shown here, never logged.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import { CardTitle, FAINT, GREEN, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { Feedback, FeedbackRow } from "@/lib/searchbar/gateway";
import { Empty, Loaded, pill, post, when } from "./shared";

const STATUSES = [
  { key: "open", label: "Open", tint: "blue" }, { key: "positive", label: "Positive", tint: "green" },
  { key: "implemented", label: "Implemented", tint: "green" }, { key: "refused", label: "Refused", tint: "pink" },
  { key: "company", label: "About the company", tint: "purple" },
] as const;
const REPLIES = [
  { key: "under_resolution", label: "Company problem under resolution" }, { key: "implemented", label: "Feedback implemented" },
  { key: "taking_time", label: "Taking more time" }, { key: "thanks", label: "Only thanks" },
] as const;
type Data = Feedback & { isAdmin: boolean };
type Show = "all" | (typeof STATUSES)[number]["key"];

function Item({ r, isAdmin, onDone }: { r: FeedbackRow; isAdmin: boolean; onDone: (text: string, ok: boolean) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const st = STATUSES.find((s) => s.key === r.status);
  const act = async (name: string, body: unknown, done: string) => {
    setBusy(name);
    const res = await post<{ ticket_id?: string; existing?: boolean }>(body);
    setBusy(null);
    onDone(res.ok ? (name === "ticket" && res.data?.ticket_id ? `${res.data.existing ? "The ticket already existed" : "Ticket created"}: #${res.data.ticket_id}.` : done) : res.error ?? "Did not work.", res.ok);
  };
  return (
    <Box sx={{ borderTop: `1px solid ${HAIRLINE}`, py: 1.5, display: "grid", gap: 0.75 }}>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        <Chip tint={st?.tint ?? "slate"}>{st?.label ?? r.status}</Chip>
        <Typography sx={{ fontSize: "0.76rem", color: FAINT }}>{when(r.created_at)}{r.locale ? ` · ${r.locale}` : ""}{r.rating != null ? ` · ${r.rating}/5` : ""}</Typography>
        {r.hs_ticket_id && <Chip tint="purple">ticket #{r.hs_ticket_id}</Chip>}
        {r.reply && <Chip tint="slate">reply: {REPLIES.find((x) => x.key === r.reply)?.label ?? r.reply}</Chip>}
      </Box>
      <Typography sx={{ fontSize: "0.86rem", color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{r.feedback}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
        {[r.name, r.email].filter(Boolean).join(" · ") || "No name given"}
        {r.bar_query ? ` · had searched "${r.bar_query}"` : ""}
        {r.page_url ? <> · <Box component="a" href={r.page_url} target="_blank" rel="noopener noreferrer" sx={{ color: "#2459d1" }}>page</Box></> : null}
      </Typography>
      {isAdmin && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField select size="small" label="Status" value={r.status} disabled={busy !== null} sx={{ minWidth: 170 }}
            onChange={(e) => void act("status", { action: "feedback-status", id: r.id, status: e.target.value }, `Status: ${STATUSES.find((s) => s.key === e.target.value)?.label}.${r.hs_ticket_id ? " The ticket follows." : ""}`)}>
            {STATUSES.map((s) => <MenuItem key={s.key} value={s.key}>{s.label}</MenuItem>)}
          </TextField>
          {!r.hs_ticket_id ? (
            <Button size="small" variant="outlined" sx={pill} disabled={busy !== null}
              onClick={() => { if (confirm("Create a HubSpot ticket for this feedback (E-Commerce team, New), linked to the customer's contact and company?")) void act("ticket", { action: "feedback-ticket", id: r.id }, "Ticket created."); }}>
              {busy === "ticket" ? <CircularProgress size={14} /> : "Create HubSpot ticket"}
            </Button>
          ) : (
            <>
              <TextField select size="small" label="Reply" value={reply} onChange={(e) => setReply(e.target.value)} sx={{ minWidth: 260 }}>
                {REPLIES.map((x) => <MenuItem key={x.key} value={x.key}>{x.label}</MenuItem>)}
              </TextField>
              <Button size="small" variant="outlined" sx={pill} disabled={busy !== null || !reply}
                onClick={() => void act("reply", { action: "feedback-reply", id: r.id, reply }, `Answer drafted as a note on ticket #${r.hs_ticket_id}, in the customer's language and in English.`)}>
                {busy === "reply" ? <CircularProgress size={14} /> : "Draft the answer on the ticket"}
              </Button>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

function List({ d, reload }: { d: Data; reload: () => void }) {
  const [show, setShow] = useState<Show>("open");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = d.rows ?? [];
  const pool = show === "all" ? rows : rows.filter((r) => r.status === show);
  const { slice, pager, setPage } = usePaged(pool, 5);
  const count = (k: string) => rows.filter((r) => r.status === k).length;
  return (
    <>
      <Box sx={{ mb: 1 }}>
        <Choice<Show> value={show} onChange={(k) => { setShow(k); setPage(0); }}
          options={[...STATUSES.map((s) => ({ key: s.key as Show, label: s.label, count: count(s.key) })), { key: "all", label: "All", count: rows.length }]} />
      </Box>
      {msg && <Box sx={{ mb: 1 }}>{msg.ok ? <Typography sx={{ fontSize: "0.82rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>}</Box>}
      {pool.length === 0 && <Empty>Nothing here.</Empty>}
      {slice.map((r) => <Item key={String(r.id)} r={r} isAdmin={d.isAdmin} onDone={(text, ok) => { setMsg({ ok, text }); if (ok) reload(); }} />)}
      {pager}
    </>
  );
}

export default function FeedbackCard() {
  return (
    <GlassCard>
      <CardTitle icon={<RateReviewOutlinedIcon />} tint="purple" title="Customer feedback"
        note="What customers wrote with the bar's feedback button (switched on or off above). A ticket is created only on a click." />
      <Loaded<Data> url="/api/website/search-bar?part=feedback" what="the feedback">
        {(d, reload) => <List d={d} reload={reload} />}
      </Loaded>
    </GlassCard>
  );
}
