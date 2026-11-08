"use client";
// PUBLISH (SARCLA 08.11.2026: "on the side bar you should have Publish, to publish to social media, and then subtitle
// and generate come to this page, not in the AI module"; "also on Publish you have the validation awaiting, and you
// should be able to place it on the content calendar"; "in the publish options you can choose multiple formats").
//
//   1 Where it goes   each network, and the formats it gets there - several at once, each its own design
//   2 Texts           each network's caption (where its feed cuts it), written or adapted by the AI, the first comment,
//                     the hashtags, the link
//   3 Preview         the post as the feed shows it, with its design in that network's format
//   4 Approval & day  the to-do's status and its review moves; its day on the content calendar, the time
//   5 Out             the pictures and the PDF per format, the texts to copy, "mark as published"
// Nothing is posted from the hub: there is no network connection, by design.

import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckIcon from "@mui/icons-material/Check";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { DesignThumb } from "@/app/editor/designRender";
import { BRAND, logoSvg } from "@/lib/content/studio/kinds/banner/brand";
import { cleanPostText, type WriteAnswer } from "@/lib/content/studio/kinds/social/ai";
import { FORMATS, pageIn, sizeOf, withFormat, type FormatKey } from "@/lib/content/studio/kinds/social/design";
import {
  NETWORK, NETWORKS, NETWORK_FORMATS, checks, cleanTag, composed, composedComment, enabled, exportPack, formatsInUse, type Network, type SocialDoc,
} from "@/lib/content/studio/kinds/social/model";
import type { PieceStatus } from "@/lib/content/pieceRules";
import { StatusChip, dayLabel } from "../../../../work/ui";
import { moves } from "../../../../work/TodoList";
import { ChipsInput, Checks, CopyButton } from "../../banner/ui";
import { TextFor } from "../BuildPane";
import { PostText } from "../FeedPreview";
import { Btn, Head, Note, PanelFrame, T } from "../look";
import { FormatGlyph } from "../CanvasBar";
import { fileStem } from "../actions";
import { exportPages, exportPdf } from "../exportDesign";
import type { StudioCtx } from "../Studio";

const ICON: Record<Network, React.ReactNode> = { linkedin: <LinkedInIcon />, instagram: <InstagramIcon />, facebook: <FacebookIcon /> };
const COLOR: Record<Network, string> = { linkedin: "#0a66c2", instagram: "#d62976", facebook: "#1877f2" };
const UI_FONT = `-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

function Step({ n, title, children, right }: { n: number; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Box sx={{ pt: 2, mt: 2, borderTop: n > 1 ? `1px solid ${T.line}` : "none", ...(n === 1 ? { mt: 0.5, pt: 0 } : {}) }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "6px", bgcolor: T.ink, color: "#fff", display: "grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 700 }}>{n}</Box>
        <Typography sx={{ flex: 1, fontSize: "0.92rem", fontWeight: 700, color: T.ink }}>{title}</Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/** The post as its feed shows it: the name, the caption with the feed's cut, the design in that network's format. */
function Feed({ ctx, net }: { ctx: StudioCtx; net: Network }) {
  const d = ctx.doc;
  const f = d.formats[net][0];
  const [at, setAt] = useState(0);
  const pages = d.design.pages;
  const i = Math.min(at, pages.length - 1);
  const W = 392;
  const doc = pages[i] ? (i === ctx.pageIx && f === ctx.fmt && ctx.live ? ctx.live : pageIn(d.design, pages[i], f)) : null;
  return (
    <Box sx={{ width: W, mx: "auto", bgcolor: "#fff", borderRadius: "10px", border: "1px solid #e0dfdc", overflow: "hidden", fontFamily: UI_FONT, boxShadow: "0 8px 24px -16px rgba(0,0,0,.35)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, pt: 1.25, pb: 1 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: net === "linkedin" ? "4px" : "50%", border: "1px solid rgba(0,0,0,.08)", display: "grid", placeItems: "center", overflow: "hidden", "& svg": { width: "84%", height: "auto" } }}
          dangerouslySetInnerHTML={{ __html: logoSvg("av", BRAND.red) }} />
        <Box>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, color: "rgba(0,0,0,.9)", lineHeight: 1.2 }}>APSOparts</Typography>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 12, color: "rgba(0,0,0,.55)" }}>{net === "instagram" ? "apsoparts" : "now"}</Typography>
        </Box>
      </Box>
      {net !== "instagram" && <Box sx={{ px: 1.5, pb: 1 }}><PostText text={composed(d, net)} net={net} /></Box>}
      {doc && (
        <Box sx={{ position: "relative", bgcolor: "#f3f2ef", display: "flex", justifyContent: "center" }}>
          <DesignThumb doc={doc} width={W} radius={0} />
          {pages.length > 1 && i > 0 && <IconButton size="small" aria-label="Previous page" onClick={() => setAt(i - 1)} sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,.92)", "&:hover": { bgcolor: "#fff" } }}><ChevronLeftIcon /></IconButton>}
          {pages.length > 1 && i < pages.length - 1 && <IconButton size="small" aria-label="Next page" onClick={() => setAt(i + 1)} sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,.92)", "&:hover": { bgcolor: "#fff" } }}><ChevronRightIcon /></IconButton>}
          {pages.length > 1 && <Box sx={{ position: "absolute", top: 10, right: 10, px: 1, py: 0.25, borderRadius: "999px", bgcolor: "rgba(18,18,18,.7)", color: "#fff", fontSize: 12, fontWeight: 600 }}>{i + 1}/{pages.length}</Box>}
        </Box>
      )}
      {net === "instagram" && <Box sx={{ px: 1.5, py: 1 }}><PostText text={composed(d, net)} net={net} lead="apsoparts" /></Box>}
      {net === "linkedin" && composedComment(d) && (
        <Box sx={{ px: 1.5, py: 1, borderTop: "1px solid #e0dfdc", bgcolor: "#f9fafb" }}>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600, color: "rgba(0,0,0,.7)", mb: 0.25 }}>First comment</Typography>
          <Typography sx={{ fontFamily: UI_FONT, fontSize: 13, color: "rgba(0,0,0,.85)", whiteSpace: "pre-wrap" }}>{composedComment(d)}</Typography>
        </Box>
      )}
      <Box sx={{ px: 1.5, py: 0.75, fontSize: 12, color: "rgba(0,0,0,.55)", borderTop: "1px solid #eee" }}>
        {formatLabelShort(f, d)} · {pages.length} page{pages.length > 1 ? "s" : ""}
      </Box>
    </Box>
  );
}
const formatLabelShort = (f: FormatKey, d: SocialDoc) => (f === "custom" ? `Custom ${sizeOf(f, d.design).w} × ${sizeOf(f, d.design).h}` : `${FORMATS[f].label} ${FORMATS[f].w} × ${FORMATS[f].h}`);

export default function PublishPanel({ ctx }: { ctx: StudioCtx }) {
  const { api, doc, set, canEdit } = ctx;
  const nets = enabled(doc);
  const [tab, setTab] = useState<Network>(nets[0]);
  const net = nets.includes(tab) ? tab : nets[0];
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adapting, setAdapting] = useState(false);
  const list = useMemo(() => checks(doc).map((c) => c.text), [doc]);
  const p = api.data.piece;
  const stem = fileStem(p.title);
  const used = formatsInUse(doc);
  const ai = api.data.ai && canEdit;

  const toggleNet = (n: Network) => {
    const on = !doc.networks[n].on;
    if (!on && nets.length === 1) return;
    set((d) => ({ ...d, networks: { ...d.networks, [n]: { ...d.networks[n], on } } }));
    if (on) setTab(n);
  };
  const toggleFormat = (n: Network, f: FormatKey) => {
    set((d) => {
      const cur = d.formats[n];
      const next = cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f];
      if (!next.length) return d;
      const design = d.design.formats.includes(f) ? d.design : withFormat(d.design, f, undefined, ctx.fmt);
      return { ...d, design, formats: { ...d.formats, [n]: NETWORK_FORMATS[n].filter((x) => next.includes(x)) } };
    });
  };
  const run = async (tag: string, fn: () => Promise<string | null>) => {
    setBusy(tag); setMsg(null);
    try { setMsg(await fn()); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  const write = () => run("write", async () => {
    const r = await api.ai<WriteAnswer>("write", { networks: nets });
    if (!r.ok) return r.error;
    set((d) => {
      const networks = { ...d.networks };
      for (const n of enabled(d)) { const t = r.result.texts[n]; if (t) networks[n] = { ...networks[n], text: t }; }
      return { ...d, networks, firstComment: d.networks.linkedin.on && r.result.firstComment ? r.result.firstComment : d.firstComment, hashtags: d.hashtags.length ? d.hashtags : r.result.hashtags };
    });
    return Object.keys(r.result.texts).length ? "Written for each network - read it through." : "No text came back - try again.";
  });
  const adapt = async (from: Network, to: Network) => {
    setAdapting(true); setMsg(null);
    const r = await api.ai<{ text: string; hashtags: string[] }>("adapt", { from, to });
    setAdapting(false);
    if (!r.ok) { setMsg(r.error); return; }
    set((d) => ({ ...d, networks: { ...d.networks, [to]: { ...d.networks[to], text: cleanPostText(r.result.text, to).text } }, hashtags: d.hashtags.length ? d.hashtags : r.result.hashtags.slice(0, 5) }));
  };
  const tags = () => run("tags", async () => {
    const r = await api.ai<{ hashtags: string[] }>("hashtags");
    if (!r.ok) return r.error;
    if (!r.result.hashtags.length) return "No hashtag came back.";
    set((d) => ({ ...d, hashtags: r.result.hashtags }));
    return null;
  });

  // the status and its moves, as the studio's bar has them
  const w = { me: api.data.me, isAdmin: api.data.isAdmin, access: api.data.access, project: { id: p.projectId, title: api.data.project?.title ?? "", brief: null, createdBy: api.data.project?.createdBy ?? null, contentType: null, dueDate: api.data.project?.dueDate ?? null } };
  const allMoves = moves(p, w);
  const live = allMoves.find((m) => m.to === "live");
  const review = allMoves.filter((m) => m.to !== "live" && !m.note);
  const go = (to: PieceStatus) => run(`move-${to}`, async () => { const r = await api.move(to); return r.ok ? null : r.error ?? "That did not work."; });
  const publish = () => run("live", async () => {
    const r = await api.move("live");
    if (!r.ok) return r.error ?? "Not marked.";
    set((d) => ({ ...d, published: { at: new Date().toISOString(), by: api.data.me } }));
    return "Marked as published.";
  });
  const setDay = (day: string | null) => run("day", async () => {
    const r = await api.edit({ dueDate: day });
    if (!r.ok) return r.error ?? "Not moved.";
    set((d) => ({ ...d, schedule: { ...d.schedule, date: day ?? "" } }));
    return null;
  });
  const who = (u: string) => api.data.people.find((x) => x.username === u)?.name ?? u;

  return (
    <PanelFrame title="Publish">
      <Note sx={{ mb: 2 }}>Nothing is posted from the hub - the pictures and the texts are made ready here, then posted by hand.</Note>

      <Step n={1} title="Where it goes">
        <Box sx={{ display: "grid", gap: 1 }}>
          {NETWORKS.map((n) => {
            const on = doc.networks[n].on;
            return (
              <Box key={n} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, pl: 1.25, borderRadius: "10px", border: `1px solid ${on ? T.line2 : T.line}`, bgcolor: on ? "#fff" : T.sunken }}>
                <Box component="button" type="button" aria-pressed={on} disabled={!canEdit} onClick={() => toggleNet(n)} sx={{
                  all: "unset", cursor: canEdit ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 0.75, width: 118,
                  color: on ? COLOR[n] : T.ink3, fontSize: "0.84rem", fontWeight: 700, "& svg": { fontSize: 20 },
                }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: "4px", border: `1.5px solid ${on ? COLOR[n] : T.line2}`, bgcolor: on ? COLOR[n] : "#fff", display: "grid", placeItems: "center", "& svg": { fontSize: 13, color: "#fff" } }}>{on && <CheckIcon />}</Box>
                  {ICON[n]}{NETWORK[n].label}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", flex: 1, justifyContent: "flex-end", opacity: on ? 1 : 0.45 }}>
                  {NETWORK_FORMATS[n].map((f) => {
                    const sel = doc.formats[n].includes(f);
                    return (
                      <Box key={f} component="button" type="button" disabled={!canEdit || !on} onClick={() => toggleFormat(n, f)} title={`${FORMATS[f as Exclude<FormatKey, "custom">].label} ${FORMATS[f as Exclude<FormatKey, "custom">].w} × ${FORMATS[f as Exclude<FormatKey, "custom">].h}`} sx={{
                        all: "unset", cursor: canEdit && on ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.45, borderRadius: "5px",
                        fontSize: "0.74rem", fontWeight: 600, border: `1px solid ${sel ? T.ink : T.line}`, bgcolor: sel ? T.ink : "#fff", color: sel ? "#fff" : T.ink2,
                      }}>
                        <FormatGlyph f={f} d={doc.design} size={12} />{FORMATS[f as Exclude<FormatKey, "custom">].label}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
        <Head mt={1.75}>{used.length} format{used.length > 1 ? "s" : ""} to make · click one to work on it</Head>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
          {used.map((f) => {
            const page = doc.design.pages[ctx.pageIx] ?? doc.design.pages[0];
            if (!page) return null;
            const on = f === ctx.fmt;
            const s = sizeOf(f, doc.design);
            return (
              <Box key={f} component="button" type="button" onClick={() => ctx.goFormat(f)} sx={{ all: "unset", cursor: "pointer", textAlign: "center" }}>
                <Box sx={{ borderRadius: "6px", boxShadow: on ? `0 0 0 2px ${T.accent}` : `0 0 0 1px ${T.line}`, overflow: "hidden" }}>
                  <DesignThumb doc={on && ctx.live ? ctx.live : pageIn(doc.design, page, f)} width={Math.round(Math.min(96, (84 * s.w) / s.h))} radius={0} />
                </Box>
                <Typography sx={{ mt: 0.5, fontSize: "0.7rem", fontWeight: on ? 700 : 500, color: on ? T.accent : T.ink2 }}>{f === "custom" ? "Custom" : FORMATS[f].label}</Typography>
              </Box>
            );
          })}
        </Box>
      </Step>

      <Step n={2} title="Texts" right={<Btn onClick={() => void write()} disabled={!ai || !!busy} icon={busy === "write" ? <CircularProgress size={14} /> : <AutoAwesomeIcon sx={{ color: T.accent }} />} sx={{ height: 30 }}>{nets.some((n) => doc.networks[n].text.trim()) ? "Rewrite with AI" : "Write with AI"}</Btn>}>
        {nets.length > 1 && <Box sx={{ mb: 1.25 }}><SquareChoice value={net} onChange={setTab} options={nets.map((k) => ({ key: k, label: NETWORK[k].label }))} /></Box>}
        <TextFor doc={doc} set={set} canEdit={canEdit} textNet={net} setTextNet={setTab} slide={0} setSlide={() => undefined} adapt={ai ? adapt : null} adapting={adapting} />
        <Head right={<Btn onClick={() => void tags()} disabled={!ai || !!busy} icon={busy === "tags" ? <CircularProgress size={13} /> : <AutoAwesomeIcon sx={{ color: T.accent }} />} sx={{ height: 28, fontSize: "0.76rem" }}>Suggest</Btn>}>Hashtags</Head>
        <ChipsInput values={doc.hashtags} comma max={30} disabled={!canEdit} placeholder="sealing technology, MRO…" clean={cleanTag} onChange={(v) => set((d) => ({ ...d, hashtags: v }))} />
        <Head>Link</Head>
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 1 }}>
          <TextField size="small" label="Address" value={doc.link.url} disabled={!canEdit} onChange={(e) => set((d) => ({ ...d, link: { ...d.link, url: e.target.value.trim() } }))} placeholder="https://www.apsoparts.com/…" />
          <TextField size="small" label="Words before it" value={doc.link.label} disabled={!canEdit} onChange={(e) => set((d) => ({ ...d, link: { ...d.link, label: e.target.value } }))} placeholder="Sizes in the shop:" />
        </Box>
        {msg && <Note sx={{ mt: 1, color: T.ink2 }}>{msg}</Note>}
      </Step>

      <Step n={3} title="Preview">
        {nets.length > 1 && <Box sx={{ mb: 1.25 }}><SquareChoice value={net} onChange={setTab} options={nets.map((k) => ({ key: k, label: NETWORK[k].label }))} /></Box>}
        <Feed key={net} ctx={ctx} net={net} />
      </Step>

      <Step n={4} title="Approval and day">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <StatusChip status={p.status} />
          <Typography sx={{ fontSize: "0.8rem", color: T.ink2, flex: 1 }}>
            {p.status === "review" ? `Waiting for approval${p.reviewer ? ` by ${who(p.reviewer)}` : ""}.` : p.status === "approved" ? "Approved - ready to go out." : p.status === "live" ? "Published." : p.status === "changes" ? "Changes asked for." : "Not sent for approval yet."}
          </Typography>
        </Box>
        {review.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
            {review.map((m) => <Btn key={m.to} main={m.main} disabled={!!busy} onClick={() => void go(m.to)} sx={m.to === "approved" ? { bgcolor: "#1b7a55", "&:hover": { bgcolor: "#155c40" } } : undefined}>{busy === `move-${m.to}` ? <CircularProgress size={14} color="inherit" /> : m.label}</Btn>)}
          </Box>
        )}
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 1, mt: 2 }}>
          <TextField size="small" type="date" label="On the content calendar" value={p.dueDate ?? ""} disabled={!canEdit} slotProps={{ inputLabel: { shrink: true } }} onChange={(e) => void setDay(e.target.value || null)} />
          <TextField size="small" type="time" label="Time" value={doc.schedule.time} disabled={!canEdit} slotProps={{ inputLabel: { shrink: true } }} onChange={(e) => set((d) => ({ ...d, schedule: { ...d.schedule, time: e.target.value } }))} />
        </Box>
        <Note sx={{ mt: 0.75 }}>
          {p.dueDate ? `On the calendar ${dayLabel(p.dueDate)}. ` : "Not on the calendar yet. "}
          <Link href={`/projects/calendar${p.dueDate ? `?day=${p.dueDate}` : ""}`} style={{ color: T.focus, fontWeight: 600 }}>Open the calendar</Link>
        </Note>
      </Step>

      <Step n={5} title="Out">
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {used.map((f) => (
            <Box key={f} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 128, fontSize: "0.82rem", fontWeight: 600, color: T.ink }}><FormatGlyph f={f} d={doc.design} />{f === "custom" ? "Custom" : FORMATS[f].label}</Box>
              <Btn disabled={!!busy} onClick={() => void run(`png-${f}`, async () => `${await exportPages(doc.design, f, stem)} picture${doc.design.pages.length > 1 ? "s" : ""} saved.`)} icon={busy === `png-${f}` ? <CircularProgress size={13} /> : <FileDownloadOutlinedIcon />} sx={{ height: 30, fontSize: "0.78rem" }}>
                PNG{doc.design.pages.length > 1 ? ` · ${doc.design.pages.length}` : ""}
              </Btn>
              {doc.design.pages.length > 1 && (
                <Btn disabled={!!busy} onClick={() => void run(`pdf-${f}`, async () => ((await exportPdf(doc.design, f, stem)) ? "The PDF is saved." : "The PDF could not be made."))} icon={busy === `pdf-${f}` ? <CircularProgress size={13} /> : <FileDownloadOutlinedIcon />} sx={{ height: 30, fontSize: "0.78rem" }}>PDF carousel</Btn>
              )}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.5 }}>
          {nets.map((n) => <CopyButton key={n} text={() => composed(doc, n)} label={`Copy the ${NETWORK[n].label} text`} disabled={!doc.networks[n].text.trim()} />)}
          {doc.networks.linkedin.on && composedComment(doc) && <CopyButton text={() => composedComment(doc)} label="Copy the first comment" />}
          <CopyButton text={() => exportPack(doc, p.title)} label="Copy everything" />
        </Box>
        <Head>Before it goes out</Head>
        <Checks items={list} ok="Every network's text fits, and the brand's rules are kept." />
        <Box sx={{ mt: 2, p: 1.5, borderRadius: "12px", bgcolor: p.status === "live" ? "#ecf7f1" : T.sunken, border: `1px solid ${p.status === "live" ? "#bfe3cf" : T.line}` }}>
          {p.status === "live" ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CheckCircleIcon sx={{ color: "#1b7a55" }} />
              <Typography sx={{ fontSize: "0.86rem", color: T.ink }}>
                Published{doc.published ? ` ${new Date(doc.published.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} by ${who(doc.published.by)}` : ""}.
              </Typography>
            </Box>
          ) : (
            <>
              <Btn main disabled={!live || !!busy} onClick={() => void publish()} icon={busy === "live" ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />} sx={{ width: "100%", bgcolor: live ? "#1b7a55" : undefined, "&:hover": { bgcolor: "#155c40" } }}>
                Mark as published
              </Btn>
              <Note sx={{ mt: 0.75, textAlign: "center" }}>{live ? "Once it is on the networks - the calendar shows it as live." : "It needs its approval first (step 4)."}</Note>
            </>
          )}
        </Box>
      </Step>
    </PanelFrame>
  );
}
