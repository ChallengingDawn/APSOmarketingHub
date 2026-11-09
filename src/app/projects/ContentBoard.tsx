"use client";
// CONTENT > PROJECTS: THE TEAM'S BOARD (SARCLA 07.11.2026: "this should look like a collaborative project").
//
// Every project the person may open, in a column per stage - and the stage is where its pieces are, never set by hand.
// Above it, what waits for them: reviews asked of them, pieces they write, where they were tagged this week.
// A new project starts with its brief and its pieces, not with an empty studio.
// Its owner or an admin deletes a project from its card (SARCLA 08.11.2026: "I should be able to delete projects"); the
// admins find the deleted ones at the foot of the board and bring one back (DeleteProject.tsx).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";

import { SquareChoice as Choice } from "@/app/website/ai-personalization/SquareChoice";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice, headCell, bodyCell } from "@/app/uc/report/ui";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { CONTENT_BY_KEY, OFFERED_CONTENT_TYPES } from "@/lib/content/contentTypes";
import { projectSourceLabel } from "@/lib/content/ideaOrigins";
import { projectStep } from "@/lib/content/nextStep";
import { LANGUAGES } from "@/lib/content/languages";
import { STAGES, STAGE_LABEL, type PieceStatus, type Stage } from "@/lib/content/pieceRules";
import { Chip, Faces, PINK, STAGE_DOT, StageChip, dayLabel, dueSoon, postWork } from "./work/ui";
import { DeleteProject, DeletedProjects, canDelete } from "./DeleteProject";

type BoardProject = {
  id: number; title: string; stage: Stage; source: string | null; owner: string | null; team: string[]; dueDate: string | null;
  pieces: { id: number; title: string; status: PieceStatus; contentType: string | null; language: string | null; dueDate: string | null; writer: string | null; reviewer?: string | null }[];
  comments: number; updatedAt: string;
};
type Waiting = {
  kind: "review" | "write" | "changes" | "mention"; projectId: number; projectTitle: string; pieceId: number | null;
  title: string; by: string | null; at: string | null; dueDate: string | null; text?: string;
};
type Answer = { ok: boolean; me: string; admin?: boolean; board: BoardProject[]; waiting: Waiting[]; people: Record<string, string>; error?: string };

const KIND: Record<Waiting["kind"], { label: string; tint: "amber" | "blue" | "pink" | "purple" }> = {
  review: { label: "Review", tint: "amber" }, write: { label: "To write", tint: "blue" }, changes: { label: "Changes asked", tint: "pink" }, mention: { label: "Mention", tint: "purple" },
};
const done = (s: PieceStatus) => s === "approved" || s === "live";
/** What an empty column means - and how a project gets there. */
const EMPTY_COL: Record<Stage, string> = {
  planned: "New projects start here.", making: "Here once a to-do is being written.", review: "Here when a to-do waits for its reviewer.",
  approved: "Here when every to-do is approved.", live: "Here once it is published.",
};

/** "Landing page", "LinkedIn", "IT DE" - what a card says it holds. */
function chipsOf(p: BoardProject): string[] {
  const kinds = [...new Set(p.pieces.map((x) => (x.contentType ? CONTENT_BY_KEY[x.contentType]?.label ?? x.contentType : null)).filter((x): x is string => !!x))];
  const langs = [...new Set(p.pieces.map((x) => x.language).filter((x): x is string => !!x))];
  return [...kinds.slice(0, 4), ...(langs.length ? [langs.join(" ")] : [])];
}

/** The card's delete: there for its owner or an admin, seen when the card is pointed at (always on a touch screen). */
function DeleteButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <Tooltip title="Delete the project">
      <IconButton className="del" size="small" aria-label={`Delete ${title}`} onClick={onClick}
        sx={{ color: MUTED, bgcolor: "rgba(255,255,255,.9)", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", p: 0.4, "&:hover": { color: "#c5221f", borderColor: "#c5221f55", bgcolor: "#fff" } }}>
        <DeleteOutlineIcon sx={{ fontSize: 17 }} />
      </IconButton>
    </Tooltip>
  );
}

/** The card's one next step (lib/content/nextStep.ts): what waits for the person looking first, else what the project
 * needs - a button that opens that to-do's studio, or a line saying who has it. */
function CardStep({ p, me, canEdit, names }: { p: BoardProject; me: string; canEdit: boolean; names: Record<string, string> }) {
  const s = projectStep(p.pieces, me, canEdit, (u) => names[u] ?? u);
  if (s.kind === "done") return null;
  const href = !s.piece ? `/projects/${p.id}` : s.inStudio ? `/projects/${p.id}/pieces/${s.piece.id}` : `/projects/${p.id}#piece-${s.piece.id}`;
  const many = !!s.piece && p.pieces.length > 1;
  if (!s.mine) {
    return <Typography sx={{ fontSize: "0.76rem", color: MUTED, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}{many ? ` · ${s.piece!.title}` : ""}</Typography>;
  }
  return (
    <Box component={Link} href={href} sx={{
      display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, px: 1, py: 0.6, borderRadius: "6px", textDecoration: "none",
      border: `1px solid ${PINK}40`, color: PINK, fontSize: "0.8rem", fontWeight: 700, bgcolor: "rgba(194,44,110,.04)",
      "&:hover": { bgcolor: "rgba(194,44,110,.09)" }, "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 1 },
    }}>
      <Box component="span" sx={{ flexShrink: 0 }}>{s.label}</Box>
      {many && <Box component="span" sx={{ color: MUTED, fontWeight: 500, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.piece!.title}</Box>}
      <ArrowForwardIcon sx={{ fontSize: 15, ml: "auto", flexShrink: 0 }} />
    </Box>
  );
}

function ProjectCard({ p, names, i = 0, onDelete, me, canEdit }: { p: BoardProject; names: Record<string, string>; i?: number; onDelete?: () => void; me: string; canEdit: boolean }) {
  const total = p.pieces.length;
  const ok = p.pieces.filter((x) => done(x.status)).length;
  const source = projectSourceLabel(p.source);
  return (
    <Box sx={{
      position: "relative", display: "flex", flexDirection: "column", gap: 1.1, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`,
      boxShadow: "0 1px 2px rgba(31,45,78,.04)", transition: "box-shadow .2s ease, border-color .2s ease, transform .2s ease",
      "&:hover": { boxShadow: "0 14px 30px rgba(31,45,78,.13)", borderColor: `${PINK}55`, transform: "translateY(-2px)" },
      animation: `cardIn .4s cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 0.04}s backwards`,
      "@keyframes cardIn": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
      "& .del": { opacity: 0, transition: "opacity .15s" }, "&:hover .del, & .del:focus-visible": { opacity: 1 }, "@media (hover: none)": { "& .del": { opacity: 1 } },
    }}>
    {onDelete && <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}><DeleteButton onClick={onDelete} title={p.title} /></Box>}
    <Box component={Link} href={`/projects/${p.id}`} sx={{ display: "flex", flexDirection: "column", gap: 1.1, textDecoration: "none", color: INK, borderRadius: "8px", "&:focus-visible": { outline: `2px solid ${PINK}`, outlineOffset: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minHeight: 21 }}>
        {source && <Chip tint="purple">{source}</Chip>}
        {p.dueDate && (
          <Typography sx={{ ml: "auto", mr: onDelete ? 4 : 0, fontSize: "0.76rem", fontWeight: 600, color: dueSoon(p.dueDate) && p.stage !== "live" ? "#c5221f" : MUTED }}>
            {p.stage === "live" ? "Live" : `Due ${dayLabel(p.dueDate)}`}
          </Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: "0.93rem", fontWeight: 650, lineHeight: 1.35 }}>{p.title}</Typography>
      {total > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {chipsOf(p).map((c) => <Chip key={c} tint="slate">{c}</Chip>)}
        </Box>
      )}
      <Box>
        <Box sx={{ height: 5, borderRadius: 3, bgcolor: "#edf0f5", overflow: "hidden" }}>
          <Box sx={{ height: 5, borderRadius: 3, width: `${total ? Math.round((ok / total) * 100) : 0}%`, bgcolor: STAGE_DOT[p.stage] }} />
        </Box>
        <Typography sx={{ fontSize: "0.75rem", color: MUTED, mt: 0.5 }}>
          {total ? `${ok} of ${total} piece${total === 1 ? "" : "s"} approved` : "No piece yet"}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Faces people={p.team} names={names} owner={p.owner} size={26} />
        <Box sx={{ ml: "auto", display: "inline-flex", alignItems: "center", gap: 0.5, color: MUTED, fontSize: "0.76rem" }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 15 }} />{p.comments}
        </Box>
      </Box>
    </Box>
    <CardStep p={p} me={me} canEdit={canEdit} names={names} />
    </Box>
  );
}

function NewProject({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState("landing-page");
  const [langs, setLangs] = useState<string[]>(["DE"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/content/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), contentType: kind }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "The project could not be made.");
      const id = j.project.id as number;
      if (goal.trim()) await postWork(id, { action: "brief", brief: { goal: goal.trim() } });
      if (due) await fetch(`/api/content/projects/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "due", dueDate: due }) });
      for (const l of langs.length ? langs : [""]) await postWork(id, { action: "piece-add", contentType: kind, language: l, dueDate: due || null });
      router.push(`/projects/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>New project</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <TextField autoFocus size="small" label="What is it" placeholder="DirectCut in Italy" value={title} onChange={(e) => setTitle(e.target.value)} sx={field} />
        <TextField size="small" label="Goal" placeholder="What should be different once it is out?" multiline minRows={2} value={goal} onChange={(e) => setGoal(e.target.value)} sx={field} />
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <TextField select size="small" label="First piece" value={kind} onChange={(e) => setKind(e.target.value)} sx={{ ...field, flex: "1 1 200px" }}>
            {OFFERED_CONTENT_TYPES.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="In" value={langs} onChange={(e) => setLangs(typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as string[]))}
            slotProps={{ select: { multiple: true } }} sx={{ ...field, flex: "1 1 160px" }}>
            {LANGUAGES.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Goes live" value={due} onChange={(e) => setDue(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, flex: "1 1 150px" }} />
        </Box>
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>One piece per language to start; add the others, the writers and the reviewers in the project.</Typography>
        {err && <Typography sx={{ fontSize: "0.85rem", color: "#c5221f" }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={busy || !title.trim()} onClick={create}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", bgcolor: PINK, "&:hover": { bgcolor: "#a3245c" } }}>
          {busy ? "Making it…" : "Make the project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ContentBoard() {
  const [data, setData] = useState<Answer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [whose, setWhose] = useState<"all" | "mine">("all");
  const [making, setMaking] = useState(false);
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  const load = useCallback(() => {
    fetch("/api/content/board").then((r) => r.json()).then((j: Answer) => (j.ok ? setData(j) : setErr(j.error ?? "The board could not be read."))).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);
  // deleted from its own page: the board says so once
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("deleted");
    if (t) { setGone(t); window.history.replaceState(null, "", "/projects"); }
  }, []);

  const shown = useMemo(() => (data ? (whose === "mine" ? data.board.filter((p) => p.team.includes(data.me)) : data.board) : []), [data, whose]);
  const mineCount = data ? data.board.filter((p) => p.team.includes(data.me)).length : 0;
  const names = data?.people ?? {};
  const mayDelete = (p: BoardProject) => (data ? canDelete(p, data.me, !!data.admin) : false);
  const counts = data ? data.waiting.reduce<Record<string, number>>((a, w) => ({ ...a, [w.kind]: (a[w.kind] ?? 0) + 1 }), {}) : {};

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2 }}>
        <Box sx={{ flex: "1 1 380px", minWidth: 0 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.5rem", md: "1.8rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK }}>Projects</Typography>
          <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.5 }}>Everything the team is making: who is on it, where it stands, and what waits for whom.</Typography>
        </Box>
        {/* the ideas every app found, and a new project with its lines, owners and tickets (SARCLA 08.11.2026) */}
        <Button component={Link} href="/projects/ideas" variant="outlined" startIcon={<LightbulbOutlinedIcon />}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>Ideas</Button>
        <Button component={Link} href="/projects/new" variant="contained" disableElevation startIcon={<AddIcon />}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "8px", bgcolor: PINK, "&:hover": { bgcolor: "#a3245c" } }}>New project</Button>
        <Button size="small" onClick={() => setMaking(true)} sx={{ textTransform: "none", fontWeight: 600, color: MUTED }}>Quick project</Button>
      </Box>

      {err && <Notice tone="bad">{err}</Notice>}
      {gone && (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`, fontSize: "0.86rem", color: INK }}>
          <DeleteOutlineIcon sx={{ fontSize: 18, color: MUTED }} />“{gone}” was deleted.{!data ? "" : data.admin ? " It waits under Deleted projects, at the foot of the board." : " An admin can bring it back."}
          <Button size="small" onClick={() => setGone(null)} sx={{ ml: "auto", textTransform: "none", color: MUTED }}>Close</Button>
        </Box>
      )}

      {data && data.waiting.length > 0 && (
        <GlassCard>
          <CardTitle icon={<HourglassTopOutlinedIcon />} tint="amber" title="Waiting for you"
            note={[counts.review && `${counts.review} to review`, (counts.write || counts.changes) && `${(counts.write ?? 0) + (counts.changes ?? 0)} to write`, counts.mention && `${counts.mention} mention${counts.mention === 1 ? "" : "s"}`].filter(Boolean).join(" · ")} />
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {data.waiting.slice(0, 12).map((w, i) => (
              <Box key={i} component={Link} href={`/projects/${w.projectId}${w.pieceId ? `#piece-${w.pieceId}` : ""}`} sx={{
                display: "flex", flexDirection: "column", gap: 0.6, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`,
                textDecoration: "none", color: INK, "&:hover": { boxShadow: "0 10px 24px rgba(31,45,78,.10)" },
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip tint={KIND[w.kind].tint}>{KIND[w.kind].label}</Chip>
                  {w.dueDate && <Typography sx={{ ml: "auto", fontSize: "0.76rem", fontWeight: 600, color: dueSoon(w.dueDate) ? "#c5221f" : MUTED }}>Due {dayLabel(w.dueDate)}</Typography>}
                </Box>
                <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.35 }}>
                  {w.kind === "mention" ? `${names[w.by ?? ""] ?? w.by}: “${(w.text ?? "").slice(0, 90)}${(w.text ?? "").length > 90 ? "…" : ""}”` : w.title}
                </Typography>
                {(() => {
                  // the project's name under the to-do's - not twice the same words (a quick make names both alike)
                  const proj = w.kind !== "mention" && w.projectTitle === w.title ? "" : w.projectTitle;
                  const who = w.kind === "review" && w.by ? `${names[w.by] ?? w.by} asks you` : w.kind !== "mention" && w.by ? `reviewed by ${names[w.by] ?? w.by}` : "";
                  const sub = [proj, who].filter(Boolean).join(" · ");
                  return sub ? <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>{sub}</Typography> : null;
                })()}
              </Box>
            ))}
          </Box>
        </GlassCard>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <Choice value={view} onChange={setView} options={[{ key: "board", label: "Board" }, { key: "list", label: "List" }]} />
        <Choice value={whose} onChange={setWhose} options={[{ key: "all", label: "Everyone", count: data?.board.length }, { key: "mine", label: "Mine", count: mineCount }]} />
        <Typography sx={{ ml: "auto", fontSize: "0.8rem", color: MUTED }}>A project moves when its pieces do</Typography>
      </Box>

      {!data && !err && <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>Reading the projects…</Typography>}

      {data && view === "board" && (
        // a phone: the stages one under the other, the empty ones left out (five columns side by side need 1000 px)
        <Box sx={{ overflowX: { xs: "visible", sm: "auto" }, pb: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(5, minmax(196px, 1fr))" }, gap: 1.5, minWidth: { xs: 0, sm: 1000 } }}>
            {STAGES.map((s) => {
              const cards = shown.filter((p) => p.stage === s);
              return (
                <Box key={s} sx={{ display: { xs: cards.length ? "flex" : "none", sm: "flex" }, flexDirection: "column", gap: 1.25, p: 1.25, borderRadius: "18px", bgcolor: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.8)", minHeight: { xs: 0, sm: 160 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: STAGE_DOT[s] }} />
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{STAGE_LABEL[s]}</Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{cards.length}</Typography>
                  </Box>
                  {cards.map((p, i) => <ProjectCard key={p.id} p={p} names={names} i={i} me={data.me} canEdit={!!data.admin || p.team.includes(data.me)} onDelete={mayDelete(p) ? () => setDeleting({ id: p.id, title: p.title }) : undefined} />)}
                  {cards.length === 0 && <Typography sx={{ fontSize: "0.78rem", color: "#9aa5b8", px: 0.5 }}>{EMPTY_COL[s]}</Typography>}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {data && view === "list" && (
        <GlassCard>
          <CardTitle icon={<ViewKanbanOutlinedIcon />} tint="pink" title="All projects" note={`${shown.length} project${shown.length === 1 ? "" : "s"}`} />
          <Box sx={{ overflowX: "auto" }}>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr>{["Project", "Stage", "Owner", "Pieces", "Approved", "Due", ""].map((h, i) => <Box component="th" key={i} sx={headCell}>{h}</Box>)}</tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <Box component="td" sx={bodyCell}><Box component={Link} href={`/projects/${p.id}`} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{p.title}</Box></Box>
                    <Box component="td" sx={bodyCell}><StageChip stage={p.stage} /></Box>
                    <Box component="td" sx={bodyCell}>{p.owner ? names[p.owner] ?? p.owner : ""}</Box>
                    <Box component="td" sx={{ ...bodyCell, color: MUTED }}>{chipsOf(p).join(" · ")}</Box>
                    <Box component="td" sx={bodyCell}>{p.pieces.filter((x) => done(x.status)).length} of {p.pieces.length}</Box>
                    <Box component="td" sx={{ ...bodyCell, fontWeight: 600, color: dueSoon(p.dueDate) && p.stage !== "live" ? "#c5221f" : INK }}>{dayLabel(p.dueDate)}</Box>
                    <Box component="td" sx={{ ...bodyCell, width: 44 }}>{mayDelete(p) && <DeleteButton onClick={() => setDeleting({ id: p.id, title: p.title })} title={p.title} />}</Box>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </GlassCard>
      )}

      {data && data.board.length === 0 && (
        <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>No project yet. “New project” starts one with its brief and its first pieces.</Typography>
      )}

      {data?.admin && <DeletedProjects bump={bump} onRestored={() => { setGone(null); load(); }} />}

      <NewProject open={making} onClose={() => setMaking(false)} />
      <DeleteProject project={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => {
        setGone(deleting?.title ?? "The project");
        setDeleting(null);
        setData((d) => (d ? { ...d, board: d.board.filter((x) => x.id !== id), waiting: d.waiting.filter((w) => w.projectId !== id) } : d));
        setBump((n) => n + 1);
      }} />
    </Box>
  );
}
