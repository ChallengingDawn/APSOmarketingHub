"use client";
// THE BLOG TO MAGENTO, AND MORE POSTS (08.11.2026). The blog is three kinds of CMS page: its home (/blog), a page per post
// (/blog/<address>) and a page per topic (/blog/tag/<topic>). Publishing a post means pasting its page and the home
// again (it lists the post) - and its topics' pages. Nothing is written to Magento from here.
// "More posts" makes a blog-post to-do per topic in this project, a week apart, each with its own studio.
//
// cv16 (SARCLA 11.11.2026: "compare the evolution of this page to the other content types and improve them") - the Page
// builder's publishing view, where it fits a paste: the studio opens it wide (the assistant a rail), in three parts -
//   Pages     each page of the post (the post, the blog's home, its topics) with its state on the shop, read there with
//             "Read the shop" (www, never written): Live with its link, or not there yet. What was found is kept with the
//             post - the Content library's card shows it. Then the paste for each, as before.
//   Pictures  the post's own pictures (and the home's cards') in the hub's picture storage under readable names from what
//             they show - the paste names them there, so none waits for Magento's Media Gallery. "Store them" stores
//             each in turn (2 of 5...), a refusal says which and why, with "Try again" for those.
//   More posts  as before.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AMBER, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import {
  SHOP, addDays, batchPlan, cardOf, homeCards, postWarnings, topicsOf, type BlogCard, type BlogDoc,
} from "@/lib/content/studio/kinds/blog/model";
import { cardPictures, pagesOf, postPictures, publishedFrom, withStored, type LiveRead, type PictureRow } from "@/lib/content/studio/kinds/blog/publish";
import { hubPictures, pasteHome, pastePost, pasteTopic } from "@/lib/content/studio/kinds/blog/render";
import { Field, btn, field, mainBtn } from "../../parts";
import type { StudioApi } from "../../useStudio";
import { Block, Hint, PasteCard, mono, toolBtn, useCopy } from "./ui";

const PUBLISHED = new Set(["approved", "live"]);
type Part = "pages" | "pictures" | "more";
type Media = { on: boolean; why: string | null; list: PictureRow[] };

export function Publish({ api, d, set, cards }: { api: StudioApi; d: BlogDoc; set: (d: BlogDoc) => void; cards: BlogCard[] | null }) {
  const { done, copy } = useCopy();
  const p = api.data.piece;
  const canEdit = api.data.access.canEdit;
  const warnings = postWarnings(d);
  const [part, setPart] = useState<Part>("pages");
  const onHome = useMemo(() => {
    const current = cardOf(d, { pieceId: p.id, projectId: p.projectId, status: p.status, due: p.dueDate });
    // the home as it will be with this post on it: the posts approved or live, and this one
    return homeCards(cards ?? [], current).filter((c) => PUBLISHED.has(c.status) || c.pieceId === p.id);
  }, [cards, d, p.id, p.projectId, p.status, p.dueDate]);
  const o = { store: d.store, language: d.language, topics: topicsOf(onHome) };
  // the hub's pictures go into the paste with the hub's full address - or, stored, their address in the hub's storage
  const origin = typeof window === "undefined" ? undefined : window.location.origin;

  /* ── the pictures in the hub's picture storage ── */
  const asks = useMemo(() => {
    const own = postPictures(d);
    return [...own, ...cardPictures(onHome).filter((c) => !own.some((x) => x.url === c.url))];
  }, [d, onHome]);
  const asksKey = JSON.stringify(asks);
  const [media, setMedia] = useState<Media | null>(null);
  const [mediaErr, setMediaErr] = useState<string | null>(null);
  const readMedia = useCallback(async () => {
    if (!asks.length) { setMedia({ on: true, why: null, list: [] }); return; }
    const r = await api.act<Media>("pictures", { pictures: asks });
    if (!r.ok) { setMediaErr(r.error); return; }
    setMediaErr(null);
    setMedia(r.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asksKey]);
  useEffect(() => { void readMedia(); }, [readMedia]);
  const stored = useMemo(() => new Map((media?.on ? media.list : []).map((x) => [x.url, x.address])), [media]);
  const [storing, setStoring] = useState<{ n: number; of: number } | null>(null);
  const [failed, setFailed] = useState<{ file: string; why: string; url: string }[]>([]);
  const storeAll = async (only?: string[]) => {
    const todo = (media?.list ?? []).filter((x) => (only ? only.includes(x.url) : x.state !== "there"));
    if (!todo.length) return;
    setFailed([]);
    const fails: { file: string; why: string; url: string }[] = [];
    let list = media?.list ?? [];
    for (let i = 0; i < todo.length; i++) {
      setStoring({ n: i + 1, of: todo.length });
      const one = asks.filter((a) => a.url === todo[i].url);
      const r = await api.act<Media & { failed: { file: string; why: string }[] }>("store", { pictures: one });
      if (!r.ok) { fails.push({ file: todo[i].file, why: r.error, url: todo[i].url }); continue; }
      fails.push(...r.result.failed.map((f) => ({ ...f, url: todo[i].url })));
      list = list.map((x) => r.result.list.find((y) => y.url === x.url) ?? x);
      setMedia((m) => (m ? { ...m, list } : m));
    }
    setStoring(null);
    setFailed(fails);
  };
  const missing = (media?.list ?? []).filter((x) => x.state !== "there").length;
  const fromHub = hubPictures(d).length;
  const unstored = media?.on ? missing : fromHub;

  /* ── the pages, pasted - and read on the shop ── */
  const blocks = useMemo(() => [
    ...pastePost(d, { origin, due: p.dueDate }), pasteHome(onHome, { ...o, origin }), ...d.tags.map((t) => pasteTopic(onHome, { ...o, origin }, t)),
  ].map((b) => ({ ...b, code: withStored(b.code, stored) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [d, onHome, origin, p.dueDate, stored]);
  const pages = pagesOf(d);
  const [reads, setReads] = useState<LiveRead[] | null>(null);
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const readShop = async () => {
    setReading(true); setReadErr(null);
    const r = await api.act<{ pages: LiveRead[] }>("live", { paths: pages.map((x) => x.path) });
    setReading(false);
    if (!r.ok) { setReadErr(r.error); return; }
    setReads(r.result.pages);
    // what was found is kept with the post: the Content library's card shows where it is
    if (canEdit) {
      const rec = publishedFrom(pages, r.result.pages, new Date().toISOString(), api.data.me);
      if (rec || d.published) set({ ...d, published: rec });
    }
  };
  const stateOf = (path: string): { word: string; live: boolean | null } => {
    const r = reads?.find((x) => x.path === path);
    if (r) return r.live ? { word: "Live on the shop", live: true } : { word: r.status ? `Not on the shop yet (${r.status === 200 ? "another page answers" : r.status})` : "The shop did not answer", live: false };
    const was = d.published?.pages.find((x) => x.path === path);
    return was ? { word: `Live on the shop${d.published?.at ? ` · read ${d.published.at.slice(0, 10)}` : ""}`, live: true } : { word: "Not read on the shop yet", live: null };
  };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <SquareChoice value={part} onChange={setPart} options={[
          { key: "pages", label: "Pages", count: pages.length },
          { key: "pictures", label: "Pictures", count: asks.length },
          { key: "more", label: "More posts" },
        ]} />
      </Box>

      {part === "pages" && (
        <Box>
          <Block first title="Where it lives" right={
            <Button size="small" disabled={reading} onClick={() => void readShop()} startIcon={reading ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 16 }} />} sx={toolBtn}>Read the shop</Button>
          }>
            {reading && <LinearProgress sx={{ mb: 1, height: 3, borderRadius: 2 }} />}
            <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "hidden" }}>
              {pages.map((pg, i) => {
                const st = stateOf(pg.path);
                return (
                  <Box key={pg.key} sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1, borderTop: i ? `1px solid ${HAIRLINE}` : "none", bgcolor: "#fff" }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, ...(st.live ? { bgcolor: "#1b7a55" } : st.live === false ? { bgcolor: AMBER } : { border: "1.5px solid #9aa5ad" }) }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 650, color: INK }}>{pg.label}</Typography>
                      <Typography sx={{ ...mono, fontSize: "0.74rem", color: MUTED, overflowWrap: "anywhere" }}>{pg.path}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.76rem", color: st.live ? "#1b7a55" : st.live === false ? AMBER : MUTED, textAlign: "right", flexShrink: 0, maxWidth: 190 }}>{st.word}</Typography>
                    {st.live && <Button size="small" component="a" href={`${SHOP}${pg.path}`} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={toolBtn}>Open</Button>}
                  </Box>
                );
              })}
            </Box>
            {readErr && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f", mt: 0.75 }}>{readErr} <Button size="small" onClick={() => void readShop()} sx={{ ...btn, color: "#c5221f", minWidth: 0, px: 0.5 }}>Try again</Button></Typography>}
            <Hint>Read on www.apsoparts.com, never written: a page is live once Magento shows the blog&apos;s own article on it. What is found is kept with the post - its card in the Content library shows it.</Hint>
          </Block>

          <Block title="Copy for Magento">
            {warnings.map((w) => <Typography key={w} sx={{ fontSize: "0.8rem", color: AMBER, mb: 0.5 }}>{w}</Typography>)}
            {unstored > 0 && (
              <Typography sx={{ fontSize: "0.8rem", color: AMBER, mb: 0.5 }}>
                {media?.on
                  ? <>{unstored === 1 ? "A picture is" : `${unstored} pictures are`} not in the hub&apos;s picture storage yet - <Box component="button" type="button" onClick={() => setPart("pictures")} sx={{ all: "unset", cursor: "pointer", textDecoration: "underline", fontWeight: 650 }}>store {unstored === 1 ? "it" : "them"}</Box> before the page goes live.</>
                  : <>{fromHub === 1 ? "Its picture is" : `${fromHub} of its pictures are`} kept in the hub, which the shop&apos;s visitors cannot reach: upload {fromHub === 1 ? "it" : "them"} to Magento (Content &gt; Media Gallery) and put {fromHub === 1 ? "its" : "their"} shop address in place of the hub&apos;s before the page goes live.</>}
              </Typography>
            )}
            <Hint mt={warnings.length ? 1 : 0}>The home lists the posts approved or live, and this one{cards === null ? " (the other posts are still being read)" : ""}.{stored.size ? " Its pictures are named at their address in the hub's picture storage." : ""}</Hint>
            <Box sx={{ mt: 1.25 }}>
              {blocks.map((b) => <PasteCard key={b.key} label={b.label} steps={b.steps} code={b.code} copied={done === b.key} onCopy={() => void copy(b.key, b.code)} />)}
            </Box>
          </Block>
        </Box>
      )}

      {part === "pictures" && (
        <Block first title="Its pictures on the shop" right={media?.on && missing > 0 && canEdit ? (
          <Button size="small" variant="contained" disableElevation disabled={!!storing} onClick={() => void storeAll()} sx={{ ...mainBtn, height: 32 }}
            startIcon={storing ? <CircularProgress size={12} color="inherit" /> : undefined}>
            {storing ? `Storing ${storing.n} of ${storing.of}…` : `Store ${missing === 1 ? "it" : `all ${missing}`}`}
          </Button>
        ) : undefined}>
          {storing && <LinearProgress variant="determinate" value={(100 * (storing.n - 1)) / storing.of} sx={{ mb: 1, height: 3, borderRadius: 2 }} />}
          {!media && !mediaErr && <Hint mt={0}>Reading the hub&apos;s picture storage…</Hint>}
          {mediaErr && <Typography sx={{ fontSize: "0.8rem", color: "#c5221f" }}>{mediaErr} <Button size="small" onClick={() => void readMedia()} sx={{ ...btn, color: "#c5221f", minWidth: 0, px: 0.5 }}>Try again</Button></Typography>}
          {media && !media.on && (
            <Hint mt={0}>{media.why ?? "The hub's picture storage is off"} - the pictures go to Magento&apos;s Media Gallery by hand (Pages says how).</Hint>
          )}
          {media?.on && !asks.length && <Hint mt={0}>The post and the home show no picture kept in the hub - nothing to store.</Hint>}
          {media?.on && media.list.length > 0 && (
            <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", overflow: "hidden" }}>
              {media.list.map((x, i) => {
                const own = postPictures(d).some((y) => y.url === x.url);
                const fail = failed.find((f) => f.url === x.url);
                return (
                  <Box key={x.url} sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 1, borderTop: i ? `1px solid ${HAIRLINE}` : "none", bgcolor: "#fff" }}>
                    <Box component="img" src={x.url} alt="" sx={{ width: 64, height: 42, objectFit: "cover", borderRadius: "4px", bgcolor: "#eef1f6", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ ...mono, fontSize: "0.76rem", color: INK, overflowWrap: "anywhere" }}>{x.file}</Typography>
                      <Typography sx={{ fontSize: "0.72rem", color: fail ? "#c5221f" : MUTED }}>{fail ? `Not stored: ${fail.why}` : own ? "This post's" : "On the home: another post's"}</Typography>
                    </Box>
                    {x.state === "there"
                      ? <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "#1b7a55", fontSize: "0.76rem", fontWeight: 650 }}><CheckIcon sx={{ fontSize: 15 }} />Stored</Box>
                      : <Typography sx={{ fontSize: "0.76rem", color: AMBER, fontWeight: 650 }}>{x.state === "unknown" ? "Not read" : "Not stored yet"}</Typography>}
                    {x.state === "there" && <Button size="small" component="a" href={x.address} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={toolBtn}>Open</Button>}
                  </Box>
                );
              })}
            </Box>
          )}
          {failed.length > 0 && !storing && (
            <Box sx={{ mt: 1, p: 1.25, borderRadius: "8px", bgcolor: "#fdf1f0", border: "1px solid #f3c7c3" }}>
              <Typography sx={{ fontSize: "0.8rem", color: "#8f1d1b", fontWeight: 650 }}>{failed.length === 1 ? "A picture was" : `${failed.length} pictures were`} not stored - the paste names {failed.length === 1 ? "it" : "them"} where {failed.length === 1 ? "it is" : "they are"} not yet.</Typography>
              <Button size="small" onClick={() => void storeAll(failed.map((f) => f.url))} sx={{ ...toolBtn, mt: 0.75 }}>Try again for {failed.length === 1 ? "it" : "those"}</Button>
            </Box>
          )}
          <Hint mt={1}>Each picture gets a readable name from what it shows (Google reads it) and is stored once: the paste names it at its address in the hub&apos;s picture storage, open to the shop&apos;s visitors - nothing to upload in Magento.</Hint>
        </Block>
      )}

      {part === "more" && <MorePosts api={api} />}
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
    <Block first title="More posts">
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
