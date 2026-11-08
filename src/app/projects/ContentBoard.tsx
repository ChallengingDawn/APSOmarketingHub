"use client";
// CONTENT > PROJECTS: THE TEAM'S BOARD (SARCLA 07.11.2026: "this should look like a collaborative project").
//
// Every project the person may open, in a column per stage - and the stage is where its pieces are, never set by hand.
// Above it, what waits for them: reviews asked of them, pieces they write, where they were tagged this week.
// A new project starts with its brief and its pieces, not with an empty studio.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";

import { Chip, Choice } from "@/app/connectors/parts";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, Notice, headCell, bodyCell } from "@/app/uc/report/ui";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { CONTENT_BY_KEY, OFFERED_CONTENT_TYPES } from "@/lib/content/contentTypes";
import { LANGUAGES } from "@/lib/content/languages";
import { STAGES, STAGE_LABEL, type PieceStatus, type Stage } from "@/lib/content/pieceRules";
import { Faces, PINK, STAGE_DOT, StageChip, dayLabel, dueSoon, postWork } from "./work/ui";

type BoardProject = {
  id: number; title: string; stage: Stage; source: string | null; owner: string | null; team: string[]; dueDate: string | null;
  pieces: { title: string; status: PieceStatus; contentType: string | null; language: string | null; dueDate: string | null; writer: string | null }[];
  comments: number; updatedAt: string;
};
type Waiting = {
  kind: "review" | "write" | "changes" | "mention"; projectId: number; projectTitle: string; pieceId: number | null;
  title: string; by: string | null; at: string | null; dueDate: string | null; text?: string;
};
type Answer = { ok: boolean; me: string; board: BoardProject[]; waiting: Waiting[]; people: Record<string, string>; error?: string };

const SOURCE_LABEL: Record<string, string> = { seo: "From SEO", geo: "From GEO", aeo: "From AEO", sea: "From SEA", team: "Team idea" };
const KIND: Record<Waiting["kind"], { label: string; tint: "amber" | "blue" | "pink" | "purple" }> = {
  review: { label: "Review", tint: "amber" }, write: { label: "To write", tint: "blue" }, changes: { label: "Changes asked", tint: "pink" }, mention: { label: "Mention", tint: "purple" },
};
const done = (s: PieceStatus) => s === "approved" || s === "live";

/** "Landing page", "LinkedIn", "IT DE" - what a card says it holds. */
function chipsOf(p: BoardProject): string[] {
  const kinds = [...new Set(p.pieces.map((x) => (x.contentType ? CONTENT_BY_KEY[x.contentType]?.label ?? x.contentType : null)).filter((x): x is string => !!x))];
  const langs = [...new Set(p.pieces.map((x) => x.language).filter((x): x is string => !!x))];
  return [...kinds.slice(0, 4), ...(langs.length ? [langs.join(" ")] : [])];
}

function ProjectCard({ p, names, i = 0 }: { p: BoardProject; names: Record<string, string>; i?: number }) {
  const total = p.pieces.length;
  const ok = p.pieces.filter((x) => done(x.status)).length;
  return (
    <Box component={Link} href={`/projects/${p.id}`} sx={{
      display: "flex", flexDirection: "column", gap: 1.1, p: 1.5, borderRadius: "14px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}`,
      textDecoration: "none", color: INK, boxShadow: "0 1px 2px rgba(31,45,78,.04)",
      transition: "box-shadow .2s ease, border-color .2s ease, transform .2s ease",
      "&:hover": { boxShadow: "0 14px 30px rgba(31,45,78,.13)", borderColor: `${PINK}55`, transform: "translateY(-2px)" },
      animation: `cardIn .4s cubic-bezier(.22,1,.36,1) ${Math.min(i, 8) * 0.04}s backwards`,
      "@keyframes cardIn": { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minHeight: 21 }}>
        {p.source && SOURCE_LABEL[p.source] && <Chip tint="purple">{SOURCE_LABEL[p.source]}</Chip>}
        {p.dueDate && (
          <Typography sx={{ ml: "auto", fontSize: "0.76rem", fontWeight: 600, color: dueSoon(p.dueDate) && p.stage !== "live" ? "#c5221f" : MUTED }}>
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

  const load = useCallback(() => {
    fetch("/api/content/board").then((r) => r.json()).then((j: Answer) => (j.ok ? setData(j) : setErr(j.error ?? "The board could not be read."))).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (data ? (whose === "mine" ? data.board.filter((p) => p.team.includes(data.me)) : data.board) : []), [data, whose]);
  const mineCount = data ? data.board.filter((p) => p.team.includes(data.me)).length : 0;
  const names = data?.people ?? {};
  const counts = data ? data.waiting.reduce<Record<string, number>>((a, w) => ({ ...a, [w.kind]: (a[w.kind] ?? 0) + 1 }), {}) : {};

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2 }}>
        <Box sx={{ flex: "1 1 380px", minWidth: 0 }}>
          <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.5rem", md: "1.8rem" }, fontWeight: 600, letterSpacing: "-0.025em", color: INK }}>Projects</Typography>
          <Typography sx={{ fontSize: "0.95rem", color: MUTED, mt: 0.5 }}>Everything the team is making: who is on it, where it stands, and what waits for whom.</Typography>
        </Box>
        <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setMaking(true)}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "11px", bgcolor: PINK, "&:hover": { bgcolor: "#a3245c" } }}>New project</Button>
      </Box>

      {err && <Notice tone="bad">{err}</Notice>}

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
                <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>
                  {w.projectTitle}{w.kind === "review" && w.by ? ` · ${names[w.by] ?? w.by} asks you` : w.kind !== "mention" && w.by ? ` · reviewed by ${names[w.by] ?? w.by}` : ""}
                </Typography>
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
        <Box sx={{ overflowX: "auto", pb: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(196px, 1fr))", gap: 1.5, minWidth: 1000 }}>
            {STAGES.map((s) => {
              const cards = shown.filter((p) => p.stage === s);
              return (
                <Box key={s} sx={{ display: "flex", flexDirection: "column", gap: 1.25, p: 1.25, borderRadius: "18px", bgcolor: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.8)", minHeight: 160 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5 }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: STAGE_DOT[s] }} />
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{STAGE_LABEL[s]}</Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{cards.length}</Typography>
                  </Box>
                  {cards.map((p, i) => <ProjectCard key={p.id} p={p} names={names} i={i} />)}
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
              <thead><tr>{["Project", "Stage", "Owner", "Pieces", "Approved", "Due"].map((h) => <Box component="th" key={h} sx={headCell}>{h}</Box>)}</tr></thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <Box component="td" sx={bodyCell}><Box component={Link} href={`/projects/${p.id}`} sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{p.title}</Box></Box>
                    <Box component="td" sx={bodyCell}><StageChip stage={p.stage} /></Box>
                    <Box component="td" sx={bodyCell}>{p.owner ? names[p.owner] ?? p.owner : ""}</Box>
                    <Box component="td" sx={{ ...bodyCell, color: MUTED }}>{chipsOf(p).join(" · ")}</Box>
                    <Box component="td" sx={bodyCell}>{p.pieces.filter((x) => done(x.status)).length} of {p.pieces.length}</Box>
                    <Box component="td" sx={{ ...bodyCell, fontWeight: 600, color: dueSoon(p.dueDate) && p.stage !== "live" ? "#c5221f" : INK }}>{dayLabel(p.dueDate)}</Box>
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

      <NewProject open={making} onClose={() => setMaking(false)} />
    </Box>
  );
}
