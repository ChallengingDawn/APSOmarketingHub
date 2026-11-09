"use client";
// IDEAS (SARCLA 08.11.2026: "Ideas is missing - we should be able to review ideas from multiple apps and then create a
// project"). Every app's ideas in one list - AI testing & personalization's Insights and What stops buyers, AEO & LLM
// Optimizer, SEO, the Search bar's gaps, what customers ask APSOassistant Chat, the Personality's keyword signals - and the
// team's own. Each card says EXACTLY where it comes from, by the menus' own names, with the link to that page (SARCLA
// 08.11.2026: "if it comes from AI Personalization, call it like that - we need to identify exactly where they come
// from"). The Action plan is not here (SARCLA 08.11.2026: "Action plan should not be visible here").
// "+ Idea" is an idea from none of the apps (SARCLA 08.11.2026: "Ideas should have + Idea - not of ours - and then
// create with AI"): a few words, "Write it with AI" makes the whole idea (title, why, what to make) from them and the
// brand brain, the person adjusts it, then keeps it or makes a project of it at once.
// Each source loads on its own (one slow or failing source never holds the others). Pick one or several -> "Make a
// project" opens the new project with them; "Not now" puts one away (and back). An idea made into a project points at it.

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
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";

import { GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { originLabel, type Origin } from "@/lib/content/ideaOrigins";
import { KINDS, KindTile, kindLabel } from "../work/kinds";
import { AiWorking } from "../studio/parts";

type Source = { key: string; label: string; note: string; slow: boolean };
type Idea = {
  key: string; source: string; title: string; why: string; kind: string | null; kinds: string[]; origin: Origin; target: string | null; score: number;
  href: string | null; at: string | null; by: string | null;
  mark: { status: "dismissed" | "project"; projectId: number | null; by: string | null; at: string } | null;
};
type Loaded = { state: "loading" | "ok" | "error"; ideas: Idea[]; error?: string };

const PINK = "#c22c6e";
const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "8px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } };
const SOURCE_TINT: Record<string, string> = {
  team: "#c22c6e", convert: "#6a3fc4", buyers: "#6a3fc4", aeo: "#7b4bd6", seo: "#1b7a55", search: "#2459d1", chat: "#0b7a8a", brand: "#5b6470",
};
/** The kinds an idea can make: the content types offered (an action is the project's, not an idea's). */
const MAKES = KINDS.filter((k) => k.key !== "task");
/** The ideas a project starts from travel in the tab's storage - an address can hold only ~2 KB. */
export const IDEAS_FOR_PROJECT = "content:new-project-ideas";

const post = (body: Record<string, unknown>) =>
  fetch("/api/content/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));

/** Where it comes from - "AI testing & personalization · Insights" - squared, and a link to that page when there is one. */
function OriginTag({ i }: { i: Idea }) {
  const tint = SOURCE_TINT[i.source] ?? "#5b6470";
  const label = originLabel(i.origin);
  const sx = {
    display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0, maxWidth: "100%", fontSize: "0.74rem", fontWeight: 700, color: tint,
    border: `1px solid ${tint}33`, bgcolor: `${tint}0f`, px: 0.75, py: 0.25, borderRadius: "4px", textDecoration: "none",
    "& .t": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  } as const;
  if (!i.origin.href) return <Box component="span" sx={sx}><span className="t">{label}</span></Box>;
  return (
    <Tooltip title={`Open ${i.origin.place ?? i.origin.app} in ${i.origin.app}`}>
      <Box component={Link} href={i.origin.href} target="_blank" sx={{ ...sx, "&:hover": { borderColor: tint, bgcolor: `${tint}1a` } }}>
        <span className="t">{label}</span><NorthEastIcon sx={{ fontSize: 13, flexShrink: 0 }} />
      </Box>
    </Tooltip>
  );
}

export default function Ideas() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
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
      setMe(j.me ?? null);
      for (const s of j.sources as Source[]) void loadSource(s.key);
    }).catch(() => setErr("The hub did not answer."));
  }, [loadSource]);

  const all = useMemo(() => Object.values(loaded).flatMap((l) => l.ideas), [loaded]);
  const visible = useMemo(() => {
    const words = q.trim().toLowerCase();
    return all
      .filter((i) => filter === "all" || i.source === filter)
      .filter((i) => (show === "open" ? !i.mark : i.mark?.status === show))
      .filter((i) => !words || `${i.title} ${i.why} ${i.target ?? ""} ${originLabel(i.origin)}`.toLowerCase().includes(words))
      .sort((a, b) => b.score - a.score);
  }, [all, filter, show, q]);
  const counts = useMemo(() => Object.fromEntries((sources ?? []).map((s) => [s.key, (loaded[s.key]?.ideas ?? []).filter((i) => !i.mark).length])), [sources, loaded]);

  const mark = async (keys: string[], status: "dismissed" | null) => {
    setLoaded((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { ...v, ideas: v.ideas.map((i) => (keys.includes(i.key) ? { ...i, mark: status ? { status, projectId: null, by: null, at: new Date().toISOString() } : null } : i)) }])));
    setPicked((p) => new Set([...p].filter((k) => !keys.includes(k))));
    await post({ action: "mark", keys, status });
  };
  const makeProject = (ideas: Pick<Idea, "key" | "source" | "title" | "why" | "kind" | "kinds" | "origin" | "href">[]) => {
    try {
      sessionStorage.setItem(IDEAS_FOR_PROJECT, JSON.stringify(ideas.map((i) => ({
        key: i.key, source: i.source, title: i.title, why: i.why.slice(0, 380), kind: i.kind, kinds: i.kinds, origin: originLabel(i.origin), url: i.href ?? undefined,
      }))));
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
          <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={{ ...mainBtn, px: 2 }}>Idea</Button>
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
              display: "flex", flexDirection: "column", gap: 1, minWidth: 0, transition: "box-shadow .15s, border-color .15s",
              animation: `ideaIn .3s ease ${Math.min(n, 12) * 0.025}s backwards`, "@keyframes ideaIn": { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "none" } },
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                {show === "open" && <Checkbox size="small" checked={on} sx={{ p: 0.25, ml: -0.5 }} inputProps={{ "aria-label": `Pick ${i.title}` }}
                  onChange={() => setPicked((p) => { const n2 = new Set(p); if (n2.has(i.key)) n2.delete(i.key); else n2.add(i.key); return n2; })} />}
                <OriginTag i={i} />
                <Box sx={{ flex: 1 }} />
                {i.kinds.slice(0, 3).map((k) => <Tooltip key={k} title={`Would make: ${kindLabel(k)}`}><Box sx={{ display: "inline-flex" }}><KindTile kind={k} size={22} /></Box></Tooltip>)}
                {i.source !== "team" && (
                  <Tooltip title="How strong it is among this app's ideas">
                    <Box sx={{ width: 42, height: 5, borderRadius: 3, bgcolor: "#eef1f6", overflow: "hidden", flexShrink: 0 }}><Box sx={{ width: `${Math.max(6, i.score)}%`, height: "100%", bgcolor: i.score >= 70 ? "#1b7a55" : i.score >= 40 ? "#b26a00" : "#9aa5b8" }} /></Box>
                  </Tooltip>
                )}
              </Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 650, color: INK, lineHeight: 1.35 }}>{i.title}</Typography>
              {i.why && <Typography sx={{ fontSize: "0.82rem", color: "#3d4a63", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{i.why}</Typography>}
              {(i.target || (i.source === "team" && i.by)) && (
                <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {i.source === "team" ? `Written by ${i.by}` : i.target}
                </Typography>
              )}
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
                {i.href && <Tooltip title={`Open this one in ${i.origin.app}`}><Button size="small" component={Link} href={i.href} target="_blank" sx={{ ...btn, minWidth: 0, color: MUTED }}><OpenInNewIcon sx={{ fontSize: 16 }} /></Button></Tooltip>}
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
              {show === "open" ? (q ? "No idea matches these words." : "No idea to look at here - add your own with “+ Idea”, or look at another app.") : show === "project" ? "No idea made into a project yet." : "Nothing put away."}
            </Typography>
          </Box>
        </GlassCard>
      )}

      {picked.size > 0 && (
        <Box sx={{
          position: "fixed", bottom: { xs: 10, sm: 20 }, left: { xs: 10, sm: "50%" }, right: { xs: 10, sm: "auto" }, transform: { xs: "none", sm: "translateX(-50%)" },
          zIndex: 30, display: "flex", alignItems: "center", gap: { xs: 0.75, sm: 1.5 }, flexWrap: "wrap", justifyContent: "center",
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
      <NewIdea open={adding} me={me} onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); void loadSource("team"); setFilter("team"); setShow("open"); }}
        onProject={(id) => router.push(`/projects/${id}`)}
        onChooseKinds={(i) => { setAdding(false); makeProject([i]); }} />
    </Box>
  );
}

/** Several kinds of content, squared, each one a toggle (SquareChoice's look, more than one on). */
function KindToggles({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <Box role="group" aria-label="What to make" sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {MAKES.map((k) => {
        const on = value.includes(k.key);
        return (
          <Box key={k.key} component="button" type="button" aria-pressed={on} disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== k.key) : [...value, k.key])}
            sx={{
              all: "unset", cursor: disabled ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 0.75, pl: 0.5, pr: 1.25, py: 0.5,
              borderRadius: "6px", border: `1px solid ${on ? "#2459d1" : HAIRLINE}`, bgcolor: on ? "rgba(36,89,209,.08)" : "#fff",
              fontSize: "0.82rem", fontWeight: 600, color: on ? "#2459d1" : INK, transition: "background-color .12s, border-color .12s",
              "&:hover": disabled ? {} : { borderColor: "#2459d1" }, "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 1 },
            }}>
            <KindTile kind={k.key} size={24} />{k.label}
          </Box>
        );
      })}
    </Box>
  );
}

type Written = { title: string; why: string; kinds: string[]; facts: string[] };

/**
 * "+ Idea" - an idea from none of the apps (SARCLA 08.11.2026: "Ideas should have + Idea - not of ours - and then
 * create with AI"). The few words first; "Write it with AI" makes the whole idea from them and the brand brain, shown
 * at work while it writes; the person changes what they like, then keeps it, or makes a project of it at once.
 */
function NewIdea({ open, me, onClose, onSaved, onProject, onChooseKinds }: {
  open: boolean; me: string | null; onClose: () => void; onSaved: () => void; onProject: (projectId: number) => void;
  onChooseKinds: (idea: Pick<Idea, "key" | "source" | "title" | "why" | "kind" | "kinds" | "origin" | "href">) => void;
}) {
  const [words, setWords] = useState("");
  const [idea, setIdea] = useState<Written | null>(null);
  const [busy, setBusy] = useState<"write" | "save" | "project" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setWords(""); setIdea(null); setErr(null); setBusy(null); } }, [open]);

  const write = async () => {
    setBusy("write"); setErr(null);
    const j = await post({ action: "write", words });
    setBusy(null);
    if (!j.ok) return setErr(j.error ?? "The AI did not answer.");
    setIdea(j.idea as Written);
  };
  const keep = async (): Promise<string | null> => {
    if (!idea) return null;
    const j = await post({ action: "add", title: idea.title, why: idea.why, kinds: idea.kinds });
    if (!j.ok) { setErr(j.error ?? "Not kept."); return null; }
    return j.key as string;
  };
  const save = async () => {
    setBusy("save"); setErr(null);
    const key = await keep();
    setBusy(null);
    if (key) onSaved();
  };
  // a project at once: the idea kept (it then points at its project), one to-do per kind, the person its owner
  const project = async () => {
    if (!idea) return;
    setBusy("project"); setErr(null);
    const key = await keep();
    if (!key) { setBusy(null); return; }
    const own = { key, source: "team", title: idea.title, why: idea.why, kind: idea.kinds[0] ?? null, kinds: idea.kinds, origin: { app: "Own ideas", place: null, href: null }, href: null };
    if (!idea.kinds.length) { onChooseKinds(own); return; }
    const r = await fetch("/api/content/projects/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start", title: idea.title, goal: idea.why, audience: "", message: "", planItem: null, tickets: false,
        ideas: [{ key, source: "team", title: idea.title, why: idea.why.slice(0, 380) }],
        lines: idea.kinds.map((k) => ({ contentType: k, title: idea.title, language: "DE", writer: me, reviewer: null, dueDate: null })),
      }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    if (!r.ok) { setBusy(null); setErr(`The idea is kept; the project was not made: ${r.error ?? "no answer"}`); return; }
    onProject(r.id);
  };

  const ready = !!idea && !!idea.title.trim();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: "14px" } } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>A new idea</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1.75, pt: "8px !important" }}>
        <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>Your own - from none of the apps. A few words are enough; the AI writes the rest from them and the brand brain, and you change what you like.</Typography>
        <TextField autoFocus multiline minRows={2} label="Your idea, in a few words" placeholder="e.g. explain why FFKM costs more and when it pays off" value={words}
          onChange={(e) => setWords(e.target.value)} disabled={!!busy} sx={field}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && words.trim().length > 2) void write(); }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button variant={idea ? "outlined" : "contained"} disableElevation disabled={!!busy || words.trim().length < 3} onClick={() => void write()}
            startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />} sx={idea ? { ...btn, color: PINK, borderColor: `${PINK}66` } : mainBtn}>
            {idea ? "Write it again" : "Write it with AI"}
          </Button>
          {!idea && !busy && (
            <Button onClick={() => setIdea({ title: words.trim().slice(0, 160), why: "", kinds: [], facts: [] })} disabled={!words.trim()} sx={{ ...btn, color: MUTED }}>
              or write it yourself
            </Button>
          )}
        </Box>

        {busy === "write" && <AiWorking label="AI is writing the idea…" note="the title, why it matters, what to make" />}

        {idea && busy !== "write" && (
          <Box sx={{ display: "grid", gap: 1.5, pt: 1.5, borderTop: `1px solid ${HAIRLINE}`, animation: "ideaFill .3s ease", "@keyframes ideaFill": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "none" } } }}>
            <TextField size="small" label="The idea" value={idea.title} onChange={(e) => setIdea({ ...idea, title: e.target.value })} sx={field} disabled={!!busy} />
            <TextField size="small" multiline minRows={3} label="Why it matters - for whom, what it changes" value={idea.why} onChange={(e) => setIdea({ ...idea, why: e.target.value })} sx={field} disabled={!!busy} />
            <Box>
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em", mb: 0.75 }}>What to make</Typography>
              <KindToggles value={idea.kinds} onChange={(kinds) => setIdea({ ...idea, kinds })} disabled={!!busy} />
            </Box>
            {idea.facts.length > 0 && (
              <Box sx={{ p: 1.25, borderRadius: "8px", bgcolor: "#f6f8fb", border: `1px solid ${HAIRLINE}` }}>
                <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em", mb: 0.5 }}>From the brand brain</Typography>
                {idea.facts.map((f) => <Typography key={f} sx={{ fontSize: "0.8rem", color: "#3d4a63", lineHeight: 1.5 }}>- {f}</Typography>)}
              </Box>
            )}
          </Box>
        )}
        {err && <Typography sx={{ fontSize: "0.84rem", color: "#c5221f" }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 0.5 }}>
        <Button onClick={onClose} disabled={!!busy} sx={btn}>Cancel</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" disabled={!ready || !!busy} onClick={() => void save()} sx={{ ...btn, color: INK, borderColor: HAIRLINE }}>
          {busy === "save" ? "Keeping it…" : "Keep the idea"}
        </Button>
        <Tooltip title={ready && !idea?.kinds.length ? "Pick what to make first - or go on and choose it in the new project" : ""}>
          <span>
            <Button variant="contained" disableElevation disabled={!ready || !!busy} onClick={() => void project()} endIcon={busy === "project" ? <CircularProgress size={14} color="inherit" /> : <ArrowForwardIcon />} sx={mainBtn}>
              {busy === "project" ? "Making it…" : "Make a project"}
            </Button>
          </span>
        </Tooltip>
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
      for (const k of i.kinds.length ? i.kinds : [i.kind ?? "task"]) {
        const j = await fetch(`/api/content/projects/${pick}/work`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "piece-add", contentType: k, title: i.title.slice(0, 200), language: k !== "task" ? "DE" : null }),
        }).then((r) => r.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
        if (!j.ok) { setBusy(false); return setErr(j.error ?? "Not added."); }
      }
    }
    const keys = ideas.map((i) => i.key);
    await post({ action: "mark", keys, status: "project", projectId: pick });
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
