"use client";
// ONE CONTENT PROJECT AS THE TEAM'S WORK (SARCLA 07.11.2026: "this should look like a collaborative project"; 08.11:
// "for me a piece is a to-do", "the interface feels slow and it's not dynamic").
//
//   the head          what it is, where it stands (its to-dos decide), who is on it
//   the brief         one shared page everybody writes against
//   the to-dos        every piece of content and every task, each an Action plan sub-action with its ticket (TodoList)
//   the conversation  comments and everything that happened; "@Name" tags someone and mails them
// Every change shows at once and is saved behind it (act); the page reads the database only, and the tickets come from
// HubSpot after it is drawn. Its owner or an admin deletes it from the head (SARCLA 08.11.2026: "I should be able to
// delete projects") - DeleteProject.tsx says what goes and what stays first.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";

import { Chip } from "@/app/connectors/parts";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { InlineTitle } from "./work/InlineTitle";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { STAGES, STAGE_LABEL, STATUS_LABEL, stageOf, type PieceStatus, type Stage } from "@/lib/content/pieceRules";
import ShareDialog from "./ShareDialog";
import { DeleteProject, canDelete } from "./DeleteProject";
import TodoList, { type Act } from "./work/TodoList";
import { Face, Faces, PINK, STAGE_DOT, StageChip, dayLabel, postWork } from "./work/ui";
import type { Brief, EventRow, PersonOpt, Tickets, Work } from "./work/types";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "10px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, "&:hover": { bgcolor: "#a3245c" } };

/** The line an event leaves in the stream. */
function eventLine(e: EventRow, name: (u: string) => string): string | null {
  const d = e.detail as Record<string, string | boolean | null | undefined>;
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  switch (e.kind) {
    case "status": return `moved ${s("piece") || "a to-do"} to ${STATUS_LABEL[(s("to") || "todo") as PieceStatus] ?? s("to")}`;
    case "assign": return `asked ${name(s("to"))} to ${s("role") === "reviewer" ? "review" : "do"} ${s("piece") || "a to-do"}`;
    case "piece": return `added ${s("piece") || "a to-do"}`;
    case "piece-removed": return `removed ${s("piece") || "a to-do"}`;
    case "stage": return `moved the project to ${STAGE_LABEL[(s("to") || "planned") as Stage] ?? s("to")}`;
    case "brief": return "changed the brief";
    case "place": return d.planItem ? "placed the project in the action plan" : "took the project out of the action plan";
    case "ticket": return `${d.made ? "made" : "linked"} the ticket of ${s("piece") || "a to-do"}`;
    case "todo": return `added the to-do “${s("todo")}”`;
    case "todo-done": return `ticked off “${s("todo")}”`;
    case "deleted": return "deleted the project";
    case "restored": return "brought the project back";
    default: return null;
  }
}

/** A comment with its tags in bold: "@Anna Rossi" for any person the hub knows. */
function Tagged({ text, people }: { text: string; people: PersonOpt[] }) {
  const names = people.map((p) => p.name).filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  if (!names.length) return <>{text}</>;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(@(?:${names.map(esc).join("|")}))`, "gi"));
  return <>{parts.map((x, i) => (i % 2 ? <b key={i} style={{ color: "#a3245c" }}>{x}</b> : x))}</>;
}

/** The text box that tags: "@" and a few letters offer the people; picking one writes "@Their Name". */
function Composer({ people, onSend }: { people: PersonOpt[]; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const at = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(text);
  const offer = at ? people.filter((p) => `${p.name} ${p.username}`.toLowerCase().includes(at[2].toLowerCase())).slice(0, 6) : [];
  const pick = (p: PersonOpt) => {
    if (!at) return;
    setText(`${text.slice(0, text.length - at[2].length - 1)}@${p.name} `);
    ref.current?.focus();
  };
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const t = text.trim();
    setText("");
    if (!(await onSend(t))) setText(t);
    setBusy(false);
  };
  return (
    <Box sx={{ position: "relative" }}>
      <TextField inputRef={ref} fullWidth multiline minRows={3} placeholder="Write to the team. Type @ to tag someone - they get a mail."
        value={text} onChange={(e) => setText(e.target.value)} sx={field}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send(); }} />
      {offer.length > 0 && (
        <Box role="listbox" aria-label="People to tag" sx={{ position: "absolute", zIndex: 5, left: 8, right: 8, top: "100%", mt: 0.5, bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${HAIRLINE}`, boxShadow: "0 12px 28px rgba(31,45,78,.14)", overflow: "hidden" }}>
          {offer.map((p) => (
            <Box key={p.username} component="button" type="button" role="option" aria-selected={false} onClick={() => pick(p)} sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", px: 1.25, py: 0.9, border: 0, bgcolor: "transparent", cursor: "pointer", font: "inherit", textAlign: "left", "&:hover": { bgcolor: "#f3f5f9" } }}>
              <Face username={p.username} name={p.name} size={24} /><Typography sx={{ fontSize: "0.88rem" }}>{p.name}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>Ctrl+Enter sends</Typography>
        <Button variant="contained" disableElevation disabled={busy || !text.trim()} onClick={send} sx={{ ...mainBtn, ml: "auto" }}>Send</Button>
      </Box>
    </Box>
  );
}

function BriefCard({ w, act }: { w: Work; act: Act }) {
  const [edit, setEdit] = useState(false);
  const [b, setB] = useState<Brief>(w.brief);
  useEffect(() => { if (!edit) setB(w.brief); }, [w.brief, edit]);
  const empty = !w.brief.goal && !w.brief.audience && !w.brief.message && !w.brief.keywords.length && !w.brief.channels.length;
  const save = async () => {
    setEdit(false);
    await act({ action: "brief", brief: b }, (x) => ({ ...x, brief: b }));
  };
  const row = (label: string, value: React.ReactNode) => (
    <Box><Typography sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>{label}</Typography>
      <Box sx={{ fontSize: "0.9rem", color: INK, mt: 0.4, lineHeight: 1.5 }}>{value || <Box component="span" sx={{ color: MUTED }}>-</Box>}</Box></Box>
  );
  return (
    <GlassCard>
      <CardTitle icon={<DescriptionOutlinedIcon />} tint="pink" title="Brief" note="What everybody writes against"
        right={w.access.canEdit && !edit ? <Button size="small" onClick={() => setEdit(true)} sx={btn}>{empty ? "Write the brief" : "Edit the brief"}</Button> : undefined} />
      {edit ? (
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <TextField size="small" label="Goal" multiline minRows={2} value={b.goal} onChange={(e) => setB({ ...b, goal: e.target.value })} sx={field} />
          <TextField size="small" label="Who it is for" multiline minRows={2} value={b.audience} onChange={(e) => setB({ ...b, audience: e.target.value })} sx={field} />
          <TextField size="small" label="Key message" multiline minRows={2} value={b.message} onChange={(e) => setB({ ...b, message: e.target.value })} sx={field} />
          <Autocomplete multiple freeSolo size="small" options={[]} value={b.keywords} onChange={(_, v) => setB({ ...b, keywords: v as string[] })}
            renderInput={(p) => <TextField {...p} label="Keywords" placeholder="Type one, Enter" sx={field} />} />
          <Autocomplete multiple freeSolo size="small" options={["Website", "LinkedIn", "Google Ads", "Newsletter", "Blog", "Video"]} value={b.channels}
            onChange={(_, v) => setB({ ...b, channels: v as string[] })} renderInput={(p) => <TextField {...p} label="Channels" sx={field} />} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", justifyContent: "flex-end" }}>
            <Button onClick={() => { setB(w.brief); setEdit(false); }} sx={btn}>Cancel</Button>
            <Button variant="contained" disableElevation onClick={save} sx={mainBtn}>Save the brief</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {row("Goal", w.brief.goal)}
          {row("Who it is for", w.brief.audience)}
          {row("Key message", w.brief.message)}
          {row("Keywords", w.brief.keywords.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>{w.brief.keywords.map((k) => <Chip key={k} tint="slate">{k}</Chip>)}</Box> : null)}
          {row("Channels", w.brief.channels.join(" · "))}
          {w.project.brief && row("Notes", <Box sx={{ whiteSpace: "pre-wrap" }}>{w.project.brief}</Box>)}
        </Box>
      )}
    </GlassCard>
  );
}

/** While the project is read: the page's shape, not a sentence. */
function Loading() {
  return (
    <Box sx={{ display: "grid", gap: 2.25 }}>
      <Skeleton variant="rounded" height={150} sx={{ borderRadius: "22px" }} />
      <Box sx={{ display: "flex", gap: 2.25, flexWrap: "wrap" }}>
        <Box sx={{ flex: "999 1 620px", display: "grid", gap: 2.25 }}>
          <Skeleton variant="rounded" height={180} sx={{ borderRadius: "22px" }} />
          <Skeleton variant="rounded" height={320} sx={{ borderRadius: "22px" }} />
        </Box>
        <Skeleton variant="rounded" height={520} sx={{ flex: "1 1 340px", borderRadius: "22px" }} />
      </Box>
    </Box>
  );
}

export default function ProjectWorkspace({ id }: { id: number }) {
  const [w, setW] = useState<Work | null>(null);
  const [t, setT] = useState<Tickets | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const loads = useRef(0);

  // the newest read wins: an older answer arriving late never puts back what a click just changed
  const load = useCallback(async () => {
    const n = ++loads.current;
    const j = (await fetch(`/api/content/projects/${id}/work`).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }))) as Work;
    if (n !== loads.current) return;
    if (j.ok) setW(j); else setErr(j.error ?? "The project could not be read.");
  }, [id]);
  const loadTickets = useCallback(async () => {
    const j = await fetch(`/api/content/projects/${id}/work?tickets`).then((r) => r.json()).catch(() => null);
    if (j?.ok) setT(j as Tickets); else setT({ tickets: {}, takes: {}, place: null, error: j?.error ?? "HubSpot did not answer." });
  }, [id]);
  useEffect(() => { void load().then(loadTickets); }, [load, loadTickets]);

  // a change shows at once (optimistic), is saved, and the page reads itself again quietly behind it
  const act: Act = useCallback(async (body, optimistic) => {
    if (optimistic) setW((cur) => (cur ? (() => { const next = optimistic(cur); return { ...next, stage: stageOf(next.pieces.map((p) => p.status)) }; })() : cur));
    const r = await postWork(id, body);
    setErr(r.ok ? null : r.error ?? "That did not save.");
    await load();
    const a = String(body.action ?? "");
    if (a.startsWith("ticket") || a === "place" || a === "piece-add" || a === "piece-remove" || (a === "piece-edit" && "writer" in body)) void loadTickets();
    return r;
  }, [id, load, loadTickets]);

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of w?.people ?? []) m[p.username] = p.name;
    for (const p of w?.members ?? []) m[p.username] = p.name;
    return m;
  }, [w]);
  const name = useCallback((u: string) => names[u] ?? u, [names]);

  const feed = useMemo(() => {
    if (!w) return [];
    const items: { at: string; who: string; comment?: string; line?: string; dot?: string }[] = [];
    for (const c of w.comments) items.push({ at: c.createdAt, who: c.author, comment: c.body });
    for (const e of w.events) {
      if (e.kind === "mention") continue;
      const line = eventLine(e, name);
      if (line) items.push({ at: e.createdAt, who: e.actor, line, dot: e.kind === "status" ? "#c97a10" : e.kind === "stage" ? STAGE_DOT[(e.detail.to as Stage) ?? "planned"] : e.kind === "ticket" ? "#1b7a55" : "#5d6b85" });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [w, name]);

  if (err && !w) return <Notice tone="bad">{err}</Notice>;
  if (!w) return <Loading />;

  const team = [...new Set([w.project.createdBy, ...w.members.map((m) => m.username), ...w.pieces.flatMap((p) => [p.writer, p.reviewer])].filter((x): x is string => !!x))];
  const done = w.pieces.filter((p) => p.status === "approved" || p.status === "live").length;
  const at = STAGES.indexOf(w.stage);
  const sendComment = async (text: string) => {
    const temp = { id: -Date.now(), author: w.me, body: text, createdAt: new Date().toISOString() };
    const r = await act({ action: "comment", body: text }, (x) => ({ ...x, comments: [temp, ...x.comments] }));
    return r.ok;
  };

  return (
    <Box sx={{ display: "grid", gap: 2.25 }}>
      <Box component={Link} href="/projects" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: MUTED, fontSize: "0.86rem", fontWeight: 600, textDecoration: "none", justifySelf: "start" }}>
        <ArrowBackIcon sx={{ fontSize: 17 }} />All projects
      </Box>

      <GlassCard>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
          <Box sx={{ flex: "1 1 420px", minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              <StageChip stage={w.stage} />
              {[...new Set(w.pieces.map((p) => p.language).filter(Boolean))].map((l) => <Chip key={l} tint="slate">{l}</Chip>)}
            </Box>
            {/* the project's name, changed where it is read (SARCLA 08.11.2026: "changing the title is still hard") */}
            <Box component="h1" sx={{ mt: 1, mb: 0, fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", letterSpacing: "-0.025em", display: "flex", minWidth: 0 }}>
              <InlineTitle value={w.project.title} canEdit={w.access.canEdit} size="1.85rem" weight={600} maxWidth="100%" label="Project name"
                onSave={async (title) => {
                  setW((cur) => (cur ? { ...cur, project: { ...cur.project, title } } : cur));
                  const r = await fetch(`/api/content/projects/${w.project.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rename", title }) })
                    .then((x) => x.json()).catch(() => ({ ok: false }));
                  if (!r.ok) void load();
                }} />
            </Box>
            {w.brief.goal && <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.5 }}>{w.brief.goal}</Typography>}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center" }}>
            <Faces people={team} names={names} owner={w.project.createdBy} size={30} max={7} />
            {w.access.canShare && <Button variant="outlined" startIcon={<PersonAddAlt1Icon />} onClick={() => setSharing(true)} sx={btn}>Invite</Button>}
            <Button variant="outlined" component={Link} href={`/projects/${w.project.id}/versions`} sx={btn}>All versions</Button>
            {canDelete({ owner: w.project.createdBy }, w.me, w.isAdmin) && (
              <Tooltip title="Delete the project">
                <IconButton aria-label="Delete the project" onClick={() => setDeleting(true)}
                  sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: "10px", color: MUTED, p: 0.9, "&:hover": { color: "#c5221f", borderColor: "#c5221f55" } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1, md: 1.5 }, mt: 2, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
          {STAGES.map((s, i) => (
            <Box key={s} sx={{ display: "contents" }}>
              {i > 0 && <Box aria-hidden sx={{ flex: "0 1 44px", height: 2, borderRadius: 2, bgcolor: i <= at ? "#1b7a55" : "#dfe4ec", transition: "background-color .4s ease" }} />}
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: "0.84rem", fontWeight: 600, color: i < at ? "#17684a" : i === at ? STAGE_DOT[s] : MUTED, whiteSpace: "nowrap", transition: "color .4s ease" }}>
                <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", boxSizing: "border-box", transition: "all .4s ease",
                  ...(i < at ? { bgcolor: "#1b7a55", color: "#fff" } : i === at ? { border: `2px solid ${STAGE_DOT[s]}`, boxShadow: `0 0 0 4px ${STAGE_DOT[s]}22` } : { border: "2px solid #c9d0db" }) }}>
                  {i < at ? <CheckIcon sx={{ fontSize: 14 }} /> : i === at ? <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: STAGE_DOT[s] }} /> : null}
                </Box>
                {STAGE_LABEL[s]}
              </Box>
            </Box>
          ))}
          <Typography sx={{ ml: "auto", fontSize: "0.82rem", color: MUTED }}>
            Owner <b style={{ color: INK }}>{name(w.project.createdBy ?? "")}</b>
            {w.project.dueDate ? <> · goes live <b style={{ color: INK }}>{dayLabel(w.project.dueDate)}</b></> : null}
            {w.pieces.length ? ` · ${done} of ${w.pieces.length} to-dos approved or done` : ""}
          </Typography>
        </Box>
      </GlassCard>

      {err && <Notice tone="bad">{err}</Notice>}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.25, alignItems: "flex-start" }}>
        <Box sx={{ flex: "999 1 620px", minWidth: 0, display: "grid", gap: 2.25 }}>
          <TodoList w={w} t={t} act={act} onTicketChanged={() => void loadTickets()} />
          <BriefCard w={w} act={act} />
        </Box>
        <Box sx={{ flex: "1 1 340px", minWidth: 0, position: { lg: "sticky" }, top: { lg: 16 } }}>
          <GlassCard>
            <CardTitle icon={<ForumOutlinedIcon />} tint="purple" title="Conversation" note="Comments, and everything that happened" />
            {w.access.canComment && <Composer people={w.people} onSend={sendComment} />}
            <Box sx={{ mt: 1.5, maxHeight: { lg: "calc(100vh - 330px)" }, overflowY: { lg: "auto" }, pr: { lg: 0.5 } }}>
              {feed.length === 0 && <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Nothing yet.</Typography>}
              {feed.map((f, i) => (
                <Box key={`${f.at}-${i}`} sx={{ display: "flex", gap: 1.25, py: 1.25, borderTop: `1px solid ${HAIRLINE}`, animation: "rowIn .3s ease", "@keyframes rowIn": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "none" } } }}>
                  <Face username={f.who} name={name(f.who)} size={30} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700 }}>{name(f.who)}</Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: MUTED }}>{when(f.at)}</Typography>
                    </Box>
                    {f.comment ? (
                      <Typography sx={{ mt: 0.4, fontSize: "0.9rem", lineHeight: 1.5, p: "8px 11px", borderRadius: "4px 12px 12px 12px", bgcolor: "#f3f5f9", whiteSpace: "pre-wrap", wordBreak: "break-word" }}><Tagged text={f.comment} people={w.people} /></Typography>
                    ) : (
                      <Box sx={{ mt: 0.3, display: "flex", gap: 0.75, alignItems: "center", fontSize: "0.84rem", color: "#3d4a63" }}>
                        <Box aria-hidden sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: f.dot, flexShrink: 0 }} />{f.line}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </GlassCard>
        </Box>
      </Box>

      <ShareDialog projectId={w.project.id} title={w.project.title} open={sharing} onClose={() => setSharing(false)} onChanged={() => void load()} me={w.me} />
      <DeleteProject project={deleting ? { id: w.project.id, title: w.project.title } : null} onClose={() => setDeleting(false)}
        onDeleted={() => router.push(`/projects?deleted=${encodeURIComponent(w.project.title.slice(0, 120))}`)} />
    </Box>
  );
}
