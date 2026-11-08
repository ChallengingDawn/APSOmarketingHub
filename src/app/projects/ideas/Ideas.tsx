"use client";
// IDEAS (SARCLA 08.11.2026: "Ideas is missing - we should be able to review ideas from multiple apps and then create a
// project"). Every app's ideas in one list - APSOconvert's page ideas and what stops buyers, AI answers, SEO, the shop's
// search, what customers ask, the brand brain, the plan's Idea box, and the team's own. Each source loads on its own (one
// slow or failing source never holds the others). Pick one or several -> "Make a project" opens the new project with
// them; "Not now" puts one away (and back). An idea made into a project points at it.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";

import { GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { KINDS, KindTile, kindLabel } from "../work/kinds";

type Source = { key: string; label: string; note: string; slow: boolean };
type Idea = {
  key: string; source: string; title: string; why: string; kind: string | null; target: string | null; score: number; href: string | null;
  at: string | null; by: string | null; mark: { status: "dismissed" | "project"; projectId: number | null; by: string | null; at: string } | null;
};
type Loaded = { state: "loading" | "ok" | "error"; ideas: Idea[]; error?: string };

const PINK = "#c22c6e";
const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "8px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } };
const SOURCE_TINT: Record<string, string> = {
  team: "#c22c6e", convert: "#2459d1", buyers: "#2459d1", aeo: "#7b4bd6", seo: "#1b7a55", search: "#b26a00", chat: "#0b7a8a", brand: "#5b6470", plan: "#3d4a63",
};
/** The ideas a project starts from travel in the tab's storage - an address can hold only ~2 KB. */
export const IDEAS_FOR_PROJECT = "content:new-project-ideas";

export default function Ideas() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [filter, setFilter] = useState<string>("all");
  const [show, setShow] = useState<"open" | "project" | "dismissed">("open");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addTo, setAddTo] = useState<Idea[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadSource = useCallback(async (key: string) => {
    setLoaded((l) => ({ ...l, [key]: { state: "loading", ideas: l[key]?.ideas ?? [] } }));
    const j = await fetch(`/api/content/ideas?source=${key}`).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    setLoaded((l) => ({ ...l, [key]: j.ok ? { state: "ok", ideas: j.ideas } : { state: "error", ideas: [], error: j.error ?? "Not read." } }));
  }, []);
  useEffect(() => {
    fetch("/api/content/ideas").then((r) => r.json()).then((j) => {
      if (!j.ok) { setErr(j.error ?? "The ideas could not be read."); return; }
      setSources(j.sources);
      for (const s of j.sources as Source[]) void loadSource(s.key);
    }).catch(() => setErr("The hub did not answer."));
  }, [loadSource]);

  const all = useMemo(() => Object.values(loaded).flatMap((l) => l.ideas), [loaded]);
  const visible = useMemo(() => {
    const words = q.trim().toLowerCase();
    return all
      .filter((i) => filter === "all" || i.source === filter)
      .filter((i) => (show === "open" ? !i.mark : i.mark?.status === show))
      .filter((i) => !words || `${i.title} ${i.why} ${i.target ?? ""}`.toLowerCase().includes(words))
      .sort((a, b) => b.score - a.score);
  }, [all, filter, show, q]);
  const counts = useMemo(() => Object.fromEntries((sources ?? []).map((s) => [s.key, (loaded[s.key]?.ideas ?? []).filter((i) => !i.mark).length])), [sources, loaded]);
  const label = (key: string) => sources?.find((s) => s.key === key)?.label ?? key;

  const mark = async (keys: string[], status: "dismissed" | null) => {
    setLoaded((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v, ideas: v.ideas.map((i) => (keys.includes(i.key) ? { ...i, mark: status ? { status, projectId: null, by: null, at: new Date().toISOString() } : null } : i)) }])));
    setPicked((p) => new Set([...p].filter((k) => !keys.includes(k))));
    await fetch("/api/content/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark", keys, status }) }).catch(() => undefined);
  };
  const makeProject = (ideas: Idea[]) => {
    try {
      sessionStorage.setItem(IDEAS_FOR_PROJECT, JSON.stringify(ideas.map((i) => ({ key: i.key, source: i.source, title: i.title, why: i.why.slice(0, 380), kind: i.kind, url: i.href ?? undefined }))));
    } catch { /* no storage - the page starts empty */ }
    router.push("/projects/new?from=ideas");
  };
  const pickedIdeas = all.filter((i) => picked.has(i.key));
  const loading = sources && sources.some((s) => loaded[s.key]?.state !== "ok" && loaded[s.key]?.state !== "error");

  return (
    <Box sx={{ display: "grid", gap: 2, pb: picked.size ? 10 : 2 }}>
      {err && <Notice tone="bad">{err}</Notice>}
      <GlassCard>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Box sx={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
            <SearchIcon sx={{ position: "absolute", left: 10, top: 9, fontSize: 19, color: MUTED }} />
            <TextField size="small" fullWidth placeholder="Search the ideas" value={q} onChange={(e) => setQ(e.target.value)} sx={{ ...field, "& input": { pl: 3.5 } }} />
          </Box>
          <SquareChoice value={show} onChange={setShow} options={[{ key: "open", label: "To look at" }, { key: "project", label: "Made into projects" }, { key: "dismissed", label: "Not now" }]} />
          <Box sx={{ flex: 1 }} />
          {loading && <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.82rem" }}><CircularProgress size={14} /> Reading the apps…</Box>}
          <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={mainBtn}>An idea of ours</Button>
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <SquareChoice label="From" value={filter} onChange={setFilter}
            options={[{ key: "all", label: "Everywhere", count: Object.values(counts).reduce((a, b) => a + b, 0) }, ...(sources ?? []).map((s) => ({ key: s.key, label: s.label, count: counts[s.key] }))]} />
        </Box>
        {sources && filter !== "all" && (() => {
          const s = sources.find((x) => x.key === filter);
          const l = loaded[filter];
          return (
            <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{s?.note}</Typography>
              {l?.state === "error" && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f" }}>- {l.error}</Typography>}
              {l && l.state !== "loading" && <Button size="small" onClick={() => void loadSource(filter)} sx={btn}>Read again</Button>}
            </Box>
          );
        })()}
      </GlassCard>

      {filter === "all" && sources?.some((s) => loaded[s.key]?.state === "error") && (
        <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
          Not read just now: {sources.filter((s) => loaded[s.key]?.state === "error").map((s) => `${s.label} (${loaded[s.key]?.error})`).join(" · ")}
        </Typography>
      )}

      <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
        {visible.map((i, n) => {
          const on = picked.has(i.key);
          return (
            <Box key={i.key} sx={{
              p: 1.75, borderRadius: "12px", bgcolor: on ? "#fff" : "rgba(255,255,255,.82)", border: `1px solid ${on ? PINK : "rgba(255,255,255,.9)"}`,
              boxShadow: on ? `0 0 0 1px ${PINK}, 0 10px 28px rgba(194,44,110,.12)` : "0 1px 2px rgba(31,45,78,.04), 0 10px 26px rgba(31,45,78,.06)",
              display: "flex", flexDirection: "column", gap: 1, transition: "box-shadow .15s, border-color .15s",
              animation: `ideaIn .3s ease ${Math.min(n, 12) * 0.025}s backwards`, "@keyframes ideaIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {show === "open" && <Checkbox size="small" checked={on} sx={{ p: 0.25, ml: -0.5 }} inputProps={{ "aria-label": `Pick ${i.title}` }}
                  onChange={() => setPicked((p) => { const n2 = new Set(p); if (n2.has(i.key)) n2.delete(i.key); else n2.add(i.key); return n2; })} />}
                <Box component="span" sx={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: SOURCE_TINT[i.source] ?? MUTED, border: `1px solid ${SOURCE_TINT[i.source] ?? HAIRLINE}33`, bgcolor: `${SOURCE_TINT[i.source] ?? "#5b6470"}0f`, px: 0.75, py: 0.2, borderRadius: "4px" }}>
                  {label(i.source)}
                </Box>
                {i.kind && <Tooltip title={`Would make: ${kindLabel(i.kind)}`}><Box sx={{ display: "inline-flex" }}><KindTile kind={i.kind} size={22} /></Box></Tooltip>}
                <Box sx={{ flex: 1 }} />
                <Tooltip title="How strong it is among this app's ideas">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 42, height: 5, borderRadius: 3, bgcolor: "#eef1f6", overflow: "hidden" }}><Box sx={{ width: `${Math.max(6, i.score)}%`, height: "100%", bgcolor: i.score >= 70 ? "#1b7a55" : i.score >= 40 ? "#b26a00" : "#9aa5b8" }} /></Box>
                  </Box>
                </Tooltip>
              </Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK, lineHeight: 1.35 }}>{i.title}</Typography>
              {i.why && <Typography sx={{ fontSize: "0.82rem", color: "#3d4a63", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{i.why}</Typography>}
              {i.target && <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.target}</Typography>}
              <Box sx={{ mt: "auto", pt: 0.5, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                {i.mark?.status === "project" && i.mark.projectId ? (
                  <Button size="small" component={Link} href={`/projects/${i.mark.projectId}`} endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />} sx={{ ...btn, color: "#1b7a55" }}>Its project</Button>
                ) : i.mark?.status === "dismissed" ? (
                  <Button size="small" onClick={() => void mark([i.key], null)} sx={btn}>Back in the list</Button>
                ) : (
                  <>
                    <Button size="small" variant="contained" disableElevation onClick={() => makeProject([i])} sx={mainBtn}>Make a project</Button>
                    <Button size="small" variant="outlined" onClick={() => setAddTo([i])} sx={{ ...btn, color: INK, borderColor: HAIRLINE }}>Add to a project</Button>
                    <Button size="small" onClick={() => void mark([i.key], "dismissed")} sx={{ ...btn, color: MUTED }}>Not now</Button>
                  </>
                )}
                <Box sx={{ flex: 1 }} />
                {i.href && <Tooltip title="Open it where it comes from"><Button size="small" component={Link} href={i.href} target="_blank" sx={{ ...btn, minWidth: 0, color: MUTED }}><OpenInNewIcon sx={{ fontSize: 16 }} /></Button></Tooltip>}
              </Box>
            </Box>
          );
        })}
      </Box>
      {sources && !loading && visible.length === 0 && (
        <GlassCard>
          <Box sx={{ textAlign: "center", py: 3 }}>
            <LightbulbOutlinedIcon sx={{ fontSize: 34, color: "#c9cfdb" }} />
            <Typography sx={{ fontSize: "0.92rem", color: MUTED, mt: 1 }}>
              {show === "open" ? (q ? "No idea matches these words." : "No idea to look at here - add one of ours, or look at another app.") : show === "project" ? "No idea made into a project yet." : "Nothing put away."}
            </Typography>
          </Box>
        </GlassCard>
      )}

      {picked.size > 0 && (
        <Box sx={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 30, display: "flex", alignItems: "center", gap: 1.5,
          px: 2, py: 1.25, borderRadius: "12px", bgcolor: "#15223a", color: "#fff", boxShadow: "0 16px 40px rgba(21,34,58,.35)",
        }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>{picked.size} idea{picked.size === 1 ? "" : "s"} picked</Typography>
          <Button size="small" onClick={() => setPicked(new Set())} sx={{ ...btn, color: "rgba(255,255,255,.75)" }}>Clear</Button>
          <Button size="small" onClick={() => void mark([...picked], "dismissed")} sx={{ ...btn, color: "rgba(255,255,255,.9)" }}>Not now</Button>
          <Button size="small" onClick={() => setAddTo(pickedIdeas)} sx={{ ...btn, color: "#fff", border: "1px solid rgba(255,255,255,.35)" }}>Add to a project</Button>
          <Button size="small" variant="contained" disableElevation onClick={() => makeProject(pickedIdeas)} sx={mainBtn}>Make one project from them</Button>
        </Box>
      )}

      <AddToProject ideas={addTo} onClose={() => setAddTo(null)} onDone={(keys, projectId) => {
        setAddTo(null);
        setPicked(new Set());
        setLoaded((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v, ideas: v.ideas.map((i) => (keys.includes(i.key) ? { ...i, mark: { status: "project" as const, projectId, by: null, at: new Date().toISOString() } } : i)) }])));
      }} />
      <AddIdea open={adding} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); void loadSource("team"); setFilter("team"); setShow("open"); }} />
    </Box>
  );
}

function AddIdea({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [kind, setKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setTitle(""); setWhy(""); setKind(""); setErr(null); } }, [open]);
  const add = async () => {
    setBusy(true); setErr(null);
    const j = await fetch("/api/content/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", title, why, kind: kind || null }) })
      .then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "Not added.");
    onAdded();
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>An idea of ours</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.5, pt: "8px !important" }}>
        <TextField autoFocus size="small" label="The idea, in a few words" value={title} onChange={(e) => setTitle(e.target.value)} sx={field} />
        <TextField size="small" multiline minRows={3} label="Why - what it would change, for whom" value={why} onChange={(e) => setWhy(e.target.value)} sx={field} />
        <TextField select size="small" label="It would make (optional)" value={kind} onChange={(e) => setKind(e.target.value)} sx={field}>
          <MenuItem value=""><em>Not sure yet</em></MenuItem>
          {KINDS.map((k) => <MenuItem key={k.key} value={k.key}><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><KindTile kind={k.key} size={20} />{k.label}</Box></MenuItem>)}
        </TextField>
        {err && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f" }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={btn}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!title.trim() || busy} onClick={add} sx={mainBtn}>{busy ? "Adding…" : "Add it"}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Ideas into a project that already exists: each one a line of it (its kind, or an action), then marked as used. */
function AddToProject({ ideas, onClose, onDone }: { ideas: Idea[] | null; onClose: () => void; onDone: (keys: string[], projectId: number) => void }) {
  const [projects, setProjects] = useState<{ id: number; title: string }[] | null>(null);
  const [pick, setPick] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ideas) return;
    setErr(null); setPick("");
    fetch("/api/content/board").then((r) => r.json()).then((j) => setProjects(j.ok ? j.board.map((p: { id: number; title: string }) => ({ id: p.id, title: p.title })) : []))
      .catch(() => setProjects([]));
  }, [ideas]);
  const add = async () => {
    if (!ideas || pick === "") return;
    setBusy(true); setErr(null);
    for (const i of ideas) {
      const j = await fetch(`/api/content/projects/${pick}/work`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "piece-add", contentType: i.kind ?? "task", title: i.title.slice(0, 200), language: i.kind && i.kind !== "task" ? "DE" : null }),
      }).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
      if (!j.ok) { setBusy(false); return setErr(j.error ?? "Not added."); }
    }
    const keys = ideas.map((i) => i.key);
    await fetch("/api/content/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark", keys, status: "project", projectId: pick }) }).catch(() => undefined);
    setBusy(false);
    onDone(keys, pick);
  };
  return (
    <Dialog open={!!ideas} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Add {ideas && ideas.length > 1 ? `these ${ideas.length} ideas` : "this idea"} to a project</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.5, pt: "8px !important" }}>
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Each idea becomes a line of the project - its kind of content, or an action. Give each its owner and its day there.</Typography>
        <TextField select size="small" label="The project" value={pick} onChange={(e) => setPick(e.target.value === "" ? "" : Number(e.target.value))} sx={field} disabled={!projects}>
          {(projects ?? []).map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
        </TextField>
        {projects?.length === 0 && <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>No project you may change yet - make one instead.</Typography>}
        {err && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f" }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={btn}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={pick === "" || busy} onClick={add} sx={mainBtn}>{busy ? "Adding…" : "Add"}</Button>
      </DialogActions>
    </Dialog>
  );
}
