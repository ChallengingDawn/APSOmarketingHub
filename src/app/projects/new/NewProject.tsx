"use client";
// A NEW PROJECT (SARCLA 08.11.2026: "creating a project you should select the type of content you need and the task
// assignment - an action - for each one"). One page, two parts, read top to bottom:
//   1 What and why    its name and goal - or the ideas it starts from (from Ideas, each saying where it comes from); the
//                     AI proposes the rest, and is seen at work while it does
//   2 What it makes   one line per piece of content or action: its kind, its words, language, owner, reviewer, day
// Start makes it all at once (lib/content/start.ts) and opens the project. The action plan is not asked here (SARCLA
// 08.11.2026: "Action plan should not be visible here"): a to-do's "Plan & ticket", on its line in the project, places it.
// One thing alone is Make > <kind> (../make), which opens its studio at once.

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

import { GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { KindTile } from "../work/kinds";
import { IDEAS_FOR_PROJECT } from "../ideas/Ideas";
import { AiWorking } from "../studio/parts";
import { newTodoPeople } from "@/lib/content/people";
import { readAnswer } from "@/lib/http/answer";

type Kind = { key: string; label: string; blurb: string; language: boolean };
type Person = { username: string; name: string };
/** An idea brought from Ideas: where it comes from (as the menus name it), and every kind it would make. */
type IdeaRef = { key?: string; source: string; title: string; why?: string; kind?: string | null; kinds?: string[]; origin?: string; url?: string };
type Setup = { ok: boolean; error?: string; me: string; admin: boolean; ai: boolean; canStart: boolean; people: Person[]; kinds: Kind[]; languages: { code: string; label: string }[]; defaultReviewer?: string | null };
type Line = { id: string; contentType: string; title: string; language: string | null; writer: string | null; reviewer: string | null; dueDate: string; why?: string };

const PINK = "#c22c6e";
const btn = { textTransform: "none" as const, fontWeight: 600, borderRadius: "8px", whiteSpace: "nowrap" as const };
const mainBtn = { ...btn, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } };
const TASK = "task";
let seq = 0;
/** A new line, its people prefilled (SARCLA 09.11.2026): the owner is who makes it, the reviewer Claudio - changed in the dropdowns. */
const newLine = (contentType: string, language: string | null, s: Pick<Setup, "me" | "defaultReviewer"> | null, extra: Partial<Line> = {}): Line =>
  ({
    id: `l${++seq}`, contentType, title: "", language: contentType === TASK ? null : language, dueDate: "",
    ...newTodoPeople({ kind: contentType, me: s?.me ?? "", defaultReviewer: s?.defaultReviewer ?? null, task: TASK }), ...extra,
  });

async function post(body: Record<string, unknown>) {
  // in plain words, never a bare status (Content v7 - lib/http/answer.ts); the firewall's refusal says what to do here
  const a = await readAnswer(fetch("/api/content/projects/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (a.ok === false && /firewall/.test(String(a.error)) ? { ...a, error: "The hub refused it - too much at once? Remove a few lines." } : a) as any;
}

function Step({ n, title, note, children, right }: { n: number; title: string; note?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <GlassCard>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.75 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: "#15223a", color: "#fff", fontWeight: 800, fontSize: "0.85rem" }}>{n}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "1.02rem", fontWeight: 700, color: INK }}>{title}</Typography>
          {note && <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{note}</Typography>}
        </Box>
        {right}
      </Box>
      {children}
    </GlassCard>
  );
}

export default function NewProject() {
  const router = useRouter();
  const sp = useSearchParams();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [ideas, setIdeas] = useState<IdeaRef[]>([]);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [langs, setLangs] = useState<string[]>(["DE"]);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content/projects/start").then((r) => r.json()).then((j: Setup) => {
      if (!j.ok) { setErr(j.error ?? "The page could not open."); return; }
      setSetup(j);
      if (sp.get("from") === "ideas") {
        try {
          const raw = sessionStorage.getItem(IDEAS_FOR_PROJECT);
          if (raw) {
            const got = JSON.parse(raw) as IdeaRef[];
            setIdeas(got);
            if (got.length === 1) { setTitle(got[0].title.replace(/^Answer: /, "").slice(0, 120)); if (got[0].why) setGoal(got[0].why.slice(0, 600)); }
            // one line per kind each idea would make (an own idea can name several)
            const offered = new Set(j.kinds.map((k) => k.key));
            setLines(got.flatMap((i) => (i.kinds?.length ? i.kinds : i.kind ? [i.kind] : []).filter((k) => offered.has(k)).map((k) => newLine(k, "DE", j, { title: i.title.slice(0, 160) }))).slice(0, 8));
          }
        } catch { /* nothing kept */ }
      }
    }).catch(() => setErr("The hub did not answer."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const names = useMemo(() => Object.fromEntries((setup?.people ?? []).map((p) => [p.username, p.name])), [setup]);
  const kindOf = (key: string) => setup?.kinds.find((k) => k.key === key);
  // an action has no reviewer; a line made a piece of content again gets the default one back
  const set = (id: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? {
    ...l, ...patch,
    ...(patch.contentType === TASK ? { language: null, reviewer: null } : patch.contentType && l.contentType === TASK ? { language: l.language ?? "DE", reviewer: setup?.defaultReviewer ?? null } : {}),
  } : l)));

  const propose = async () => {
    setBusy("propose"); setErr(null);
    const r = await post({ action: "propose", goal, ideas, languages: langs });
    setBusy(null);
    if (!r.ok) return setErr(r.error ?? "The AI did not answer.");
    const p = r.proposal as { title: string; goal: string; audience: string; message: string; lines: { contentType: string; title: string; language: string | null; why: string }[] };
    if (!title.trim()) setTitle(p.title);
    if (!goal.trim()) setGoal(p.goal);
    if (!audience.trim()) setAudience(p.audience);
    if (!message.trim()) setMessage(p.message);
    // the AI's lines replace the empty ones; lines a person wrote stay
    setLines((ls) => [...ls.filter((l) => l.title.trim()), ...p.lines.map((l) => newLine(l.contentType, l.language, setup, { title: l.title, why: l.why }))]);
  };

  const start = async () => {
    setBusy("start"); setErr(null);
    const r = await post({
      action: "start", title, goal, audience, message, ideas: ideas.map(({ key, source, title: t, why, url }) => ({ key, source, title: t, why, url })),
      planItem: null, tickets: false,
      lines: lines.map(({ contentType, title: t, language, writer, reviewer, dueDate }) => ({ contentType, title: t, language, writer, reviewer, dueDate: dueDate || null })),
    });
    if (!r.ok) { setBusy(null); return setErr(r.error ?? "The project was not made."); }
    try { sessionStorage.removeItem(IDEAS_FOR_PROJECT); } catch { /* fine */ }
    router.push(`/projects/${r.id}`);
  };

  if (err && !setup) return <Notice tone="bad">{err}</Notice>;
  if (!setup) return <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, py: 4 }}><CircularProgress size={18} /> Opening…</Box>;
  if (!setup.canStart) return <Notice tone="warn">Starting a project needs Edit on Marketing &amp; Content - ask an admin.</Notice>;
  const ready = lines.some((l) => l.contentType !== TASK || l.title.trim());

  return (
    <Box sx={{ display: "grid", gap: 2, maxWidth: 1180 }}>
      <Step n={1} title="What and why" note="Its name and what it should achieve - the AI proposes what it makes from that">
        {ideas.length > 0 && (
          <Box sx={{ mb: 1.75, display: "grid", gap: 0.75 }}>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em" }}>It starts from {ideas.length === 1 ? "this idea" : `these ${ideas.length} ideas`}</Typography>
            {ideas.map((i) => (
              <Box key={i.key ?? i.title} sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1, borderRadius: "8px", bgcolor: "#fffaf0", border: "1px solid #f3e2bd" }}>
                <LightbulbOutlinedIcon sx={{ fontSize: 18, color: "#b26a00", mt: 0.2 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {i.origin && <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "#8a5a00", letterSpacing: ".02em" }}>{i.origin}</Typography>}
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 600 }}>{i.title}</Typography>
                  {i.why && <Typography sx={{ fontSize: "0.78rem", color: "#5b6470" }}>{i.why}</Typography>}
                </Box>
                <IconButton size="small" aria-label="Leave this idea out" onClick={() => setIdeas((all) => all.filter((x) => x !== i))}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <TextField size="small" label="Name" placeholder="Cut-to-size for food lines" value={title} onChange={(e) => setTitle(e.target.value)} sx={field} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography component="span" sx={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".04em" }}>Languages</Typography>
            <Box role="group" aria-label="Languages" sx={{ display: "inline-flex", border: `1px solid ${HAIRLINE}`, borderRadius: "6px", overflow: "hidden", bgcolor: "rgba(255,255,255,.75)" }}>
              {setup.languages.map((l, i) => {
                const on = langs.includes(l.code);
                return (
                  <Box key={l.code} component="button" type="button" aria-pressed={on} title={l.label}
                    onClick={() => setLangs((all) => (on ? (all.length > 1 ? all.filter((x) => x !== l.code) : all) : [...all, l.code]))}
                    sx={{ all: "unset", cursor: "pointer", px: 1.25, py: 0.55, fontSize: "0.8rem", fontWeight: 600, borderLeft: i ? `1px solid ${HAIRLINE}` : "none", color: on ? "#fff" : INK, bgcolor: on ? "#2459d1" : "transparent" }}>
                    {l.code}
                  </Box>
                );
              })}
            </Box>
          </Box>
          <TextField size="small" multiline minRows={2} label="Goal - what should change because of it" value={goal} onChange={(e) => setGoal(e.target.value)} sx={{ ...field, gridColumn: { md: "1 / -1" } }} />
          <TextField size="small" label="Who it is for" value={audience} onChange={(e) => setAudience(e.target.value)} sx={field} />
          <TextField size="small" label="The one message" value={message} onChange={(e) => setMessage(e.target.value)} sx={field} />
        </Box>
        <Box sx={{ mt: 1.75, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Button variant="outlined" disabled={!setup.ai || !!busy || (!goal.trim() && !ideas.length)} onClick={propose}
            startIcon={busy === "propose" ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />} sx={{ ...btn, borderColor: PINK, color: PINK }}>
            {busy === "propose" ? "Planning the project…" : lines.length ? "Propose more lines with AI" : "Propose the project with AI"}
          </Button>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{setup.ai ? "The name, the brief and the lines - you change anything after." : "The AI is not set up on this hub."}</Typography>
        </Box>
        {busy === "propose" && <Box sx={{ mt: 1.75 }}><AiWorking label="AI is planning the project…" note="its name, its brief and what it makes" lines={4} /></Box>}
      </Step>

      <Step n={2} title="What it makes" note="One line per piece of content, or per action around it - each with its owner, and its day on the calendar"
        right={<Typography sx={{ fontSize: "0.82rem", color: MUTED }}>{lines.length} line{lines.length === 1 ? "" : "s"}</Typography>}>
        <Box sx={{ display: "grid", gap: 1 }}>
          {lines.map((l) => {
            const k = kindOf(l.contentType);
            return (
              <Box key={l.id} sx={{ p: 1.25, borderRadius: "10px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}`, display: "grid", gap: 1 }}>
                {/* the line: what it is and what it is about, wide; then who and when */}
                <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "210px minmax(0, 1fr) 36px" }, alignItems: "start" }}>
                  <TextField select size="small" value={l.contentType} onChange={(e) => set(l.id, { contentType: e.target.value })} sx={field} aria-label="Kind">
                    {setup.kinds.map((x) => <MenuItem key={x.key} value={x.key}><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><KindTile kind={x.key} size={20} />{x.label}</Box></MenuItem>)}
                  </TextField>
                  <Box sx={{ minWidth: 0 }}>
                    <TextField size="small" fullWidth placeholder={l.contentType === TASK ? "The action - what is to be done" : `${k?.label ?? "It"} - what it is about`} value={l.title} onChange={(e) => set(l.id, { title: e.target.value })} sx={field} />
                    {l.why && <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 0.5, px: 0.5, lineHeight: 1.45 }}>{l.why}</Typography>}
                  </Box>
                  <Tooltip title="Remove the line"><IconButton size="small" aria-label="Remove the line" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} sx={{ mt: 0.25 }}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                </Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", pl: { md: "218px" } }}>
                  {l.contentType !== TASK && (
                    <TextField select size="small" label="Language" value={l.language ?? "DE"} onChange={(e) => set(l.id, { language: e.target.value })} sx={{ ...field, width: 110 }}>
                      {setup.languages.map((x) => <MenuItem key={x.code} value={x.code}>{x.code}</MenuItem>)}
                    </TextField>
                  )}
                  <TextField select size="small" label="Owner" value={l.writer ?? ""} onChange={(e) => set(l.id, { writer: e.target.value || null })} sx={{ ...field, width: 190 }}>
                    <MenuItem value=""><em>Nobody yet</em></MenuItem>
                    {setup.people.map((p) => <MenuItem key={p.username} value={p.username}>{p.name}</MenuItem>)}
                  </TextField>
                  {l.contentType !== TASK && (
                    <TextField select size="small" label="Reviewer" value={l.reviewer ?? ""} onChange={(e) => set(l.id, { reviewer: e.target.value || null })} sx={{ ...field, width: 190 }}>
                      <MenuItem value=""><em>Nobody yet</em></MenuItem>
                      {setup.people.map((p) => <MenuItem key={p.username} value={p.username}>{p.name}</MenuItem>)}
                    </TextField>
                  )}
                  <TextField size="small" type="date" label="Its day" value={l.dueDate} onChange={(e) => set(l.id, { dueDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ ...field, width: 160 }} />
                </Box>
              </Box>
            );
          })}
          {lines.length === 0 && <Typography sx={{ fontSize: "0.88rem", color: MUTED, py: 1 }}>No line yet - add what the project makes below, or let the AI propose it.</Typography>}
        </Box>
        <Box sx={{ mt: 1.5, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {setup.kinds.map((k) => (
            <Button key={k.key} size="small" variant="outlined" onClick={() => setLines((ls) => [...ls, newLine(k.key, langs[0] ?? "DE", setup)])}
              startIcon={<KindTile kind={k.key} size={18} />} sx={{ ...btn, borderRadius: "6px", color: INK, borderColor: HAIRLINE, bgcolor: "#fff" }}>
              <AddIcon sx={{ fontSize: 14, mr: 0.25, color: MUTED }} />{k.label}
            </Button>
          ))}
        </Box>
      </Step>

      {err && <Notice tone="bad">{err}</Notice>}
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1.5, position: "sticky", bottom: 12, p: 1.5, borderRadius: "12px", bgcolor: "rgba(255,255,255,.9)", backdropFilter: "blur(10px)", border: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED, flex: 1 }}>
          {lines.length ? `${lines.length} line${lines.length === 1 ? "" : "s"}${lines.some((l) => l.writer) ? ` · owners: ${[...new Set(lines.map((l) => l.writer).filter(Boolean))].map((u) => names[u!] ?? u).join(", ")}` : ""}` : "Add a line to start"}
        </Typography>
        <Button onClick={() => router.back()} sx={btn}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!ready || !!busy} onClick={start} sx={{ ...mainBtn, px: 2.5 }}>
          {busy === "start" ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} /> Making it…</> : "Start the project"}
        </Button>
      </Box>
    </Box>
  );
}
