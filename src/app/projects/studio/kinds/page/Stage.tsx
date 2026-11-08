"use client";
// THE PAGE STUDIO'S PREVIEW (08.11.2026): the shop's page as it is (Before), with the changes laid over it (After), or the
// two side by side - desktop or phone. The server builds each picture from the SAVED document (the GET route, so a
// reviewer who only comments sees it too), so the preview asks again once the studio has saved, and keeps what it
// showed while it asks. "Read again" reads the page from the shop anew (at most every 30 seconds per page).

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AMBER, INK, MUTED } from "@/app/uc/report/ui";
import type { PageDoc } from "@/lib/content/studio/kinds/page/model";
import { shopUrl } from "@/lib/content/studio/kinds/page/model";
import type { PreviewOut } from "@/lib/content/studio/kinds/page/shop";
import { Pane } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Frame, type Device } from "./Frame";
import { Choice } from "./ui";

export type View = "before" | "after" | "both";
type Side = "before" | "after";
type Held = { key: string; out: PreviewOut } | null;

/** The two pictures, asked for when what they show has changed and the studio has saved it. */
export function usePagePreview(api: StudioApi, d: PageDoc, view: View) {
  const [held, setHeld] = useState<Record<Side, Held>>({ before: null, after: null });
  const [busy, setBusy] = useState<Record<Side, boolean>>({ before: false, after: false });
  const [fresh, setFresh] = useState(0);
  const asked = useRef<Record<Side, string>>({ before: "", after: "" });
  const pieceId = api.data.piece.id;
  const keys: Record<Side, string> = {
    before: JSON.stringify([d.env, d.path]),
    after: JSON.stringify([d.source, d.env, d.path, d.source === "new" ? d.newPage.body : "", d.changes, d.texts]),
  };
  const want: Side[] = d.source === "new" ? ["after"] : view === "both" ? ["before", "after"] : [view];
  const saved = api.save === "saved";

  useEffect(() => {
    if (!d.path || !saved) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const side of want) {
      const key = `${keys[side]}|${fresh}`;
      if (asked.current[side] === key) continue;
      timers.push(setTimeout(async () => {
        asked.current[side] = key;
        setBusy((b) => ({ ...b, [side]: true }));
        const out = await fetch(`/api/content/studio/page/${pieceId}/preview?side=${side}${fresh ? "&fresh=1" : ""}`)
          .then((r) => r.json() as Promise<PreviewOut>)
          .catch(() => ({ ok: false as const, error: "The hub did not answer - try again." }));
        if (asked.current[side] === key) setHeld((h) => ({ ...h, [side]: { key, out } }));
        setBusy((b) => ({ ...b, [side]: false }));
      }, 350));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.before, keys.after, want.join(), saved, fresh, d.path, pieceId]);

  return { held, busy, readAgain: () => setFresh((n) => n + 1), want };
}

function Picture({ side, held, busy, device, label }: { side: Side; held: Held; busy: boolean; device: Device; label?: string }) {
  const out = held?.out;
  return (
    <Box sx={{ minWidth: 0 }}>
      {label && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED, mb: 1, textAlign: "center" }}>{label}</Typography>}
      {!out && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, color: MUTED, py: 10 }}>
          <CircularProgress size={16} /> Reading the page…
        </Box>
      )}
      {out && !out.ok && (
        <Box sx={{ maxWidth: 460, mx: "auto", my: 6, p: 2, borderRadius: "14px", bgcolor: "#fff", color: INK, fontSize: "0.88rem", textAlign: "center", boxShadow: "0 8px 24px rgba(31,45,78,.08)" }}>{out.error}</Box>
      )}
      {out?.ok && (
        <Box sx={{ position: "relative", opacity: busy ? 0.55 : 1, transition: "opacity .2s" }}>
          <Frame html={out.html} device={device} title={side === "before" ? "The page as it is" : "The page with its changes"} />
        </Box>
      )}
    </Box>
  );
}

export function Stage({ d, view, onView, preview }: { d: PageDoc; view: View; onView: (v: View) => void; preview: ReturnType<typeof usePagePreview> }) {
  const [device, setDevice] = useState<Device>("desktop");
  const isNew = d.source === "new";
  const { held, busy, want } = preview;
  const after = held.after?.out;
  const notes = [...new Set([...(after?.ok ? after.notes : []), ...(held.before?.out.ok ? held.before.out.notes : [])])];
  const problems = after?.ok ? after.problems : [];
  const views = isNew ? [] : [{ key: "before" as View, label: "Before" }, { key: "after" as View, label: "After" }, { key: "both" as View, label: "Side by side" }];
  return (
    <Pane tone="stage" pad={false} title="Preview" right={
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {views.length > 0 && <Choice value={view} onChange={onView} options={views} />}
        <Choice value={device} onChange={setDevice} options={[{ key: "desktop", label: "Desktop" }, { key: "mobile", label: "Phone" }]} />
        <Tooltip title="Read the page from the shop again">
          <span><IconButton size="small" disabled={!d.path || busy.before || busy.after} onClick={preview.readAgain} aria-label="Read again"><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></span>
        </Tooltip>
        {d.path && !isNew && (
          <Tooltip title="Open the page on the shop">
            <IconButton size="small" component="a" href={shopUrl(d.env, d.path)} target="_blank" rel="noopener noreferrer" aria-label="Open on the shop"><OpenInNewIcon sx={{ fontSize: 17 }} /></IconButton>
          </Tooltip>
        )}
      </Box>
    }>
      <Box sx={{ p: 3 }}>
        {!d.path ? (
          <Box sx={{ textAlign: "center", color: MUTED, py: 12, px: 2 }}>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, color: INK, mb: 0.75 }}>{isNew ? "Pick the store's page it is shown in" : "Pick a page"}</Typography>
            <Typography sx={{ fontSize: "0.88rem" }}>{isNew ? "The new page shows inside one of the store's own pages, with the shop's header and footer." : "The page shows here as the shop has it, with your changes laid over it."}</Typography>
          </Box>
        ) : want.length === 2 ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 2, alignItems: "start" }}>
            <Picture side="before" held={held.before} busy={busy.before} device={device} label="Before" />
            <Picture side="after" held={held.after} busy={busy.after} device={device} label="After" />
          </Box>
        ) : (
          <Picture side={want[0]} held={held[want[0]]} busy={busy[want[0]]} device={device} />
        )}
        {d.path && (notes.length > 0 || problems.length > 0) && (
          <Box sx={{ maxWidth: 720, mx: "auto", mt: 2.5 }}>
            {problems.map((p) => <Typography key={p} sx={{ fontSize: "0.8rem", color: AMBER, textAlign: "center" }}>Left out: {p}</Typography>)}
            {notes.map((n) => <Typography key={n} sx={{ fontSize: "0.78rem", color: MUTED, textAlign: "center" }}>{n}</Typography>)}
          </Box>
        )}
      </Box>
    </Pane>
  );
}
