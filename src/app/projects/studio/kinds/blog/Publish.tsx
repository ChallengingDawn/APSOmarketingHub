"use client";
// THE BLOG TO MAGENTO, AND MORE POSTS (08.11.2026). The blog is three kinds of CMS page: its home (/blog), a page per post
// (/blog/<address>) and a page per topic (/blog/tag/<topic>). Publishing a post means pasting its page and the home
// again (it lists the post) - and its topics' pages. Nothing is written to Magento from here.
// "More posts" makes a blog-post to-do per topic in this project, a week apart, each with its own studio.

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import {
  addDays, batchPlan, cardOf, homeCards, homePath, postPath, postWarnings, tagPath, topicsOf, type BlogCard, type BlogDoc,
} from "@/lib/content/studio/kinds/blog/model";
import { hubPictures, pasteHome, pastePost, pasteTopic } from "@/lib/content/studio/kinds/blog/render";
import { Field, btn, field, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Block, Hint, PasteCard, mono, useCopy } from "./ui";

const PUBLISHED = new Set(["approved", "live"]);

export function Publish({ api, d, cards }: { api: StudioApi; d: BlogDoc; cards: BlogCard[] | null }) {
  const { done, copy } = useCopy();
  const p = api.data.piece;
  const warnings = postWarnings(d);
  const onHome = useMemo(() => {
    const current = cardOf(d, { pieceId: p.id, projectId: p.projectId, status: p.status, due: p.dueDate });
    // the home as it will be with this post on it: the posts approved or live, and this one
    return homeCards(cards ?? [], current).filter((c) => PUBLISHED.has(c.status) || c.pieceId === p.id);
  }, [cards, d, p.id, p.projectId, p.status, p.dueDate]);
  const o = { store: d.store, language: d.language, topics: topicsOf(onHome) };
  // the hub's pictures go into the paste with the hub's full address
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  // the post's page is the page the preview shows - nothing under it but the shop's own newsletter band
  const blocks = [...pastePost(d, { origin, due: p.dueDate }), pasteHome(onHome, { ...o, origin }), ...d.tags.map((t) => pasteTopic(onHome, { ...o, origin }, t))];
  const fromHub = hubPictures(d).length;

  return (
    <Box>
      <Block first title="Where it lives">
        <Box sx={{ ...mono, fontSize: "0.76rem", color: INK, bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}`, borderRadius: "10px", p: 1.25, lineHeight: 1.6, overflowWrap: "anywhere", "& > div + div": { mt: 0.5 } }}>
          <div>{homePath(d.store)} <span style={{ color: MUTED }}>· the blog&apos;s home, every post</span></div>
          <div>&nbsp;&nbsp;└ {postPath(d)} <span style={{ color: MUTED }}>· this post</span></div>
          {d.tags.map((t) => <div key={t}>&nbsp;&nbsp;└ {tagPath(d.store, t)} <span style={{ color: MUTED }}>· {t}</span></div>)}
        </Box>
      </Block>

      <Block title="Copy for Magento">
        {warnings.map((w) => <Typography key={w} sx={{ fontSize: "0.8rem", color: AMBER, mb: 0.5 }}>{w}</Typography>)}
        {fromHub > 0 && (
          <Typography sx={{ fontSize: "0.8rem", color: AMBER, mb: 0.5 }}>
            {fromHub === 1 ? "Its picture is" : `${fromHub} of its pictures are`} kept in the hub, which the shop&apos;s visitors cannot reach: upload {fromHub === 1 ? "it" : "them"} to Magento (Content &gt; Media Gallery) and put {fromHub === 1 ? "its" : "their"} shop address in place of the hub&apos;s before the page goes live.
          </Typography>
        )}
        <Hint mt={warnings.length ? 1 : 0}>The home lists the posts approved or live, and this one{cards === null ? " (the other posts are still being read)" : ""}.</Hint>
        <Box sx={{ mt: 1.25 }}>
          {blocks.map((b) => <PasteCard key={b.key} label={b.label} steps={b.steps} code={b.code} copied={done === b.key} onCopy={() => void copy(b.key, b.code)} />)}
        </Box>
      </Block>

      <MorePosts api={api} />
    </Box>
  );
}

function MorePosts({ api }: { api: StudioApi }) {
  const [topics, setTopics] = useState("");
  const [start, setStart] = useState(() => addDays(new Date().toISOString().slice(0, 10), 7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: number; title: string; dueDate: string | null }[]>([]);
  const plan = batchPlan(topics, /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : addDays(new Date().toISOString().slice(0, 10), 7));
  const canEdit = api.data.access.canEdit;
  const projectId = api.data.piece.projectId;
  const run = async () => {
    setBusy(true); setErr(null);
    const r = await api.act<{ made: { id: number; title: string; dueDate: string | null }[] }>("batch", { topics, start });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setMade(r.result.made);
    setTopics("");
  };
  return (
    <Block title="More posts">
      <Hint mt={0}>One topic per line: each becomes a blog post to-do in this project, written by you, a week apart - each with its own studio.</Hint>
      {canEdit && (
        <Box sx={{ mt: 1.25 }}>
          <Field label="Topics" value={topics} onChange={setTopics} multiline rows={4} placeholder={"FKM or EPDM for hot water?\nStoring O-rings the right way\nHow hard should a seal be?"} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <TextField size="small" type="date" label="The first one due" value={start} onChange={(e) => setStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, flex: 1 }} />
            <Button variant="contained" disableElevation disabled={!plan.length || busy} onClick={run} sx={{ ...mainBtn, height: 40 }}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>
              {plan.length ? `Make ${plan.length} to-do${plan.length === 1 ? "" : "s"}` : "Make the to-dos"}
            </Button>
          </Box>
        </Box>
      )}
      {err && <Typography sx={{ fontSize: "0.82rem", color: "#c5221f", mt: 1 }}>{err}</Typography>}
      {made.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          {made.map((m) => (
            <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.85rem", color: INK, flex: 1, minWidth: 0 }}>{m.title}</Typography>
              <Button size="small" component={Link} href={`/projects/${projectId}/pieces/${m.id}`} sx={{ ...btn, color: "#c22c6e" }}>Open</Button>
            </Box>
          ))}
        </Box>
      )}
    </Block>
  );
}
