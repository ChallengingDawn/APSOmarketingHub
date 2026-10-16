"use client";

// Search bar > Feedback: what customers wrote with the bar's "Give us your feedback" button (the dashboard's
// Feedback page). Read-only for now - replying and opening a ticket stay on the old dashboard until the
// switches move (SARCLA 16.10.2026: "read-only first").

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, hsTicket } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged } from "@/app/connectors/parts";
import type { Feedback, FeedbackRow } from "@/lib/searchbar/gateway";
import { Empty, Loaded, when } from "./shared";

const STATUS_TINT: Record<string, "amber" | "green" | "blue" | "slate"> = { open: "amber", replied: "green", ticket: "blue", closed: "slate" };

function Item({ f }: { f: FeedbackRow }) {
  return (
    <Box sx={{ py: 1.5, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 0.5 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Chip tint={STATUS_TINT[f.status] ?? "slate"}>{f.status}</Chip>
        <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>{when(f.created_at)} · {f.locale ?? "–"}{f.rating != null ? ` · ${f.rating}/5` : ""}</Typography>
        {(f.name || f.email) && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{[f.name, f.email].filter(Boolean).join(" · ")}</Typography>}
        {f.hs_ticket_id && <Link href={hsTicket(f.hs_ticket_id)} target="_blank" rel="noopener" sx={{ fontSize: "0.78rem" }}>Ticket {f.hs_ticket_subject ? `· ${f.hs_ticket_subject}` : f.hs_ticket_id}</Link>}
      </Box>
      <Typography sx={{ fontSize: "0.88rem", color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{f.feedback}</Typography>
      {(f.bar_query || f.page_url) && (
        <Typography sx={{ fontSize: "0.76rem", color: FAINT, wordBreak: "break-all" }}>
          {f.bar_query ? `Searched: "${f.bar_query}"` : ""}{f.bar_query && f.page_url ? " · " : ""}{f.page_url ?? ""}
        </Typography>
      )}
      {f.reply && <Typography sx={{ fontSize: "0.8rem", color: MUTED, borderLeft: `3px solid ${HAIRLINE}`, pl: 1.25 }}>Reply: {f.reply}</Typography>}
    </Box>
  );
}

function List({ d }: { d: Feedback }) {
  const statuses = useMemo(() => [...new Set(d.rows.map((r) => r.status))].sort(), [d.rows]);
  const [s, setS] = useState("all");
  const rows = s === "all" ? d.rows : d.rows.filter((r) => r.status === s);
  const { slice, pager } = usePaged(rows, 10);
  return (
    <>
      <Choice value={s} onChange={setS} options={[{ key: "all", label: "All", count: d.rows.length }, ...statuses.map((x) => ({ key: x, label: x, count: d.rows.filter((r) => r.status === x).length }))]} />
      <Box sx={{ mt: 1.5 }}>
        {rows.length === 0 && <Empty>No feedback here.</Empty>}
        {slice.map((f) => <Item key={f.id} f={f} />)}
      </Box>
      {pager}
    </>
  );
}

export default function FeedbackTab() {
  return (
    <GlassCard>
      <CardTitle icon={<RateReviewOutlinedIcon />} tint="green" title="Customer feedback" note="Sent with the search bar's feedback button. Replying and opening a ticket move here later; until then they stay on the old dashboard." />
      <Loaded<Feedback> url="/api/website/search-bar?part=feedback" what="the feedback">
        {(d) => <List d={d} />}
      </Loaded>
    </GlassCard>
  );
}
