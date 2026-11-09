"use client";
// MAKE ONE THING, NOW (SARCLA 08.11.2026: "the Makes really don't work"). Make > Social post, Page, Blog article,
// Newsletter, Banner, Video used to open the whole New project form with one line in it - and a second Make clicked kept
// the first one's line. A person who clicks "Make > Video" wants to make a video: so one short screen - what it is about
// (may stay empty: "Untitled video"), its language - and Start makes the project and its one to-do, both of that name
// (owner: the person, no day, no plan, no ticket), and opens its studio. Everything else is set later, from the studio's
// bar or the to-do's line; renaming the to-do in the studio renames this project too (workflow.ts followSoleTodo).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { GlassCard, HAIRLINE, INK, MUTED, Notice } from "@/app/uc/report/ui";
import { SquareChoice } from "@/app/website/ai-personalization/SquareChoice";
import { field } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { KindTile } from "../../work/kinds";
import { PINK } from "../../studio/parts";
import { MAKE_KINDS } from "../makeKinds";

type Setup = { ok: boolean; error?: string; me: string; canStart: boolean; languages: { code: string; label: string }[]; people?: { username: string; name: string }[]; defaultReviewer?: string | null };

const LANG_KEY = "content:make-language";

export default function QuickMake({ kind }: { kind: string }) {
  const router = useRouter();
  const k = MAKE_KINDS.find((x) => x.key === kind)!;
  const [setup, setSetup] = useState<Setup | null>(null);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("DE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reviewerName = setup?.defaultReviewer && setup.defaultReviewer !== setup.me ? setup.people?.find((p) => p.username === setup.defaultReviewer)?.name ?? null : null;
  const who = setup?.defaultReviewer === setup?.me && setup?.me ? "you as its owner and its reviewer" : reviewerName ? `you as its owner and ${reviewerName} as its reviewer` : "you as its owner";

  useEffect(() => {
    try { const l = window.localStorage.getItem(LANG_KEY); if (l) setLang(l); } catch { /* no storage */ }
    fetch("/api/content/projects/start").then((r) => r.json()).then((j: Setup) => (j.ok ? setSetup(j) : setErr(j.error ?? "The page could not open.")))
      .catch(() => setErr("The hub did not answer."));
  }, []);

  const start = async () => {
    if (!setup || busy) return;
    setBusy(true); setErr(null);
    try { window.localStorage.setItem(LANG_KEY, lang); } catch { /* fine */ }
    // unnamed, it is "Untitled video" until it is named in its studio - where the project takes the name too
    const name = title.trim() || k.untitled || `Untitled ${k.noun}`;
    const r = await fetch("/api/content/projects/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start", title: name, goal: "", audience: "", message: "", ideas: [], planItem: null, tickets: false,
        // owner = the person, reviewer = Claudio (SARCLA 09.11.2026) - changed from the studio's bar
        lines: [{ contentType: kind, title: name, language: lang, writer: setup.me, reviewer: setup.defaultReviewer ?? null, dueDate: null }],
      }),
    }).then((x) => x.json()).catch(() => ({ ok: false, error: "The hub did not answer." }));
    const piece = Array.isArray(r.pieceIds) ? r.pieceIds[0] : null;
    if (!r.ok || !piece) { setBusy(false); setErr(r.error ?? "It was not made."); return; }
    router.push(`/projects/${r.id}/pieces/${piece}`);
  };

  if (err && !setup) return <Notice tone="bad">{err}</Notice>;
  if (setup && !setup.canStart) return <Notice tone="warn">Making content needs Edit on Marketing &amp; Content - ask an admin.</Notice>;

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", mt: { xs: 1, md: "6vh" }, display: "grid", gap: 2 }}>
      <GlassCard>
        <Box sx={{ display: "grid", gap: 2.25, p: { md: 1 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
            <KindTile kind={kind} size={52} />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" sx={{ fontFamily: "var(--font-outfit), var(--font-inter), sans-serif", fontSize: { xs: "1.45rem", md: "1.7rem" }, fontWeight: 600, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2 }}>
                {k.heading ?? `New ${k.noun}`}
              </Typography>
              <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.25 }}>{k.blurb}</Typography>
            </Box>
          </Box>

          <TextField autoFocus fullWidth label={k.ask ?? "What is it about?"} placeholder={k.example} value={title}
            onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void start(); }}
            helperText="Optional - you can name it later in the studio." disabled={busy}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ ...field, "& .MuiInputBase-input": { fontSize: "1.05rem", py: 1.5 }, "& .MuiFormHelperText-root": { mx: 0.5 } }} />

          <SquareChoice label="Language" value={lang} onChange={setLang}
            options={(setup?.languages ?? [{ code: "DE", label: "German" }]).map((l) => ({ key: l.code, label: l.code, disabled: busy }))} />

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pt: 0.5 }}>
            <Button variant="contained" disableElevation disabled={!setup || busy} onClick={() => void start()}
              endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon />}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.98rem", borderRadius: "8px", px: 3, py: 1.1, bgcolor: PINK, color: "#fff", "&:hover": { bgcolor: "#a3245c" } }}>
              {busy ? "Opening the studio…" : "Start"}
            </Button>
            <Typography sx={{ fontSize: "0.82rem", color: MUTED, flex: "1 1 260px" }}>
              It opens in its studio at once, with {who}. Its day, plan and ticket can all come later.
            </Typography>
          </Box>
          {err && <Typography sx={{ fontSize: "0.86rem", color: "#c5221f" }}>{err}</Typography>}
        </Box>
      </GlassCard>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
        <Typography sx={{ fontSize: "0.86rem", color: MUTED, flex: 1 }}>Several pieces, people and tickets at once?</Typography>
        <Button component={Link} href="/projects/new" endIcon={<ArrowForwardIcon sx={{ fontSize: 17 }} />} sx={{ textTransform: "none", fontWeight: 600, color: INK }}>
          New project
        </Button>
      </Box>
    </Box>
  );
}
