"use client";

/**
 * The projects, the way Adobe Express lists them (SARCLA, 11.10.2026): the
 * ones you own, the ones shared with you, and - for admins - all of them.
 * "New project" names it, says what it is for, and opens it, where Share is.
 *
 * Each card says how many variations are under it, in how many languages, who
 * owns it and who else is in it, because that is what tells you whether a
 * project is a draft somebody abandoned or a decision three people are
 * arguing about.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

import { FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT } from "@/app/uc/report/ui";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { Pager } from "@/app/seo/Finding";
import { Face } from "./ShareDialog";

type Project = {
  id: number; title: string; brief: string | null; status: string;
  chosenVariantId: number | null; createdBy: string | null; ownerName: string | null; updatedAt: string;
  variantCount: number; commentCount: number; languages: string[];
  myRole: "owner" | "editor" | "commenter" | "admin"; members: { username: string; name: string }[];
};
type Scope = "mine" | "shared" | "all";

/** Twelve cards fill a wide screen twice over without becoming a scroll. */
const PER_PAGE = 12;

const ROLE = { owner: "Owner", editor: "Can edit", commenter: "Can comment", admin: "Admin view" } as const;
const ago = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 86_400_000;
  return d < 1 ? "today" : d < 2 ? "yesterday" : d < 30 ? `${Math.floor(d)} days ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function ProjectList() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("mine");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    setProjects(null);
    fetch(`/api/content/projects?scope=${scope}`)
      .then((r) => r.json())
      .then((j) => { setProjects(j.ok ? j.projects : []); setIsAdmin(!!j.isAdmin); })
      .catch(() => setProjects([]));
  }, [scope]);
  useEffect(load, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const j = await fetch("/api/content/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), brief: brief.trim() || undefined }),
      }).then((r) => r.json());
      if (j.ok && j.project?.id) router.push(`/projects/${j.project.id}`);
      else load();
    } finally {
      setBusy(false);
    }
  };

  // Search and paging sit over whatever the scope tab returned, so "Shared
  // with you, Italian, page 2" is one thought rather than three.
  const visible = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return projects ?? [];
    return (projects ?? []).filter((p) =>
      `${p.title} ${p.brief ?? ""} ${p.ownerName ?? ""}`.toLowerCase().includes(q),
    );
  }, [projects, queryText]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const current = Math.min(page, pageCount - 1);
  useEffect(() => { setPage(0); }, [queryText, scope]);
  const shown = visible.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const tabs: { key: Scope; label: string }[] = [
    { key: "mine", label: "Your projects" },
    { key: "shared", label: "Shared with you" },
    ...(isAdmin ? [{ key: "all" as const, label: "All projects" }] : []),
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", gap: 0.5, p: 0.5, borderRadius: "12px", bgcolor: "rgba(255,255,255,.7)", border: `1px solid ${HAIRLINE}` }}>
          {tabs.map((t) => (
            <Box key={t.key} component="button" onClick={() => setScope(t.key)} sx={{
              border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "0.84rem", px: 1.5, py: 0.75, borderRadius: "9px",
              bgcolor: scope === t.key ? "#fff" : "transparent", color: scope === t.key ? INK : MUTED, fontWeight: scope === t.key ? 700 : 500,
              boxShadow: scope === t.key ? "0 1px 3px rgba(21,34,58,.12)" : "none",
            }}>{t.label}</Box>
          ))}
        </Box>
        <TextField
          size="small" placeholder="Search projects"
          value={queryText} onChange={(e) => setQueryText(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> } }}
          sx={{ width: 240, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: 13.5, bgcolor: "#fff" } }}
        />
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setCreating(true)} variant="contained" disableElevation startIcon={<AddIcon />}
          sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
          New project
        </Button>
      </Box>

      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: "20px" } }}>
        <DialogContent sx={{ p: { xs: 2.5, sm: 3 }, display: "grid", gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>New project</Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>You will own it. Share it from inside once it is open.</Typography>
          </Box>
          <TextField autoFocus size="small" label="Name" placeholder="e.g. DirectCut landing page, Italy"
            value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) create(); }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }} />
          <TextField size="small" label="Brief (optional)" multiline minRows={3} maxRows={8}
            placeholder="What it is for, who reads it, what must be in it"
            value={brief} onChange={(e) => setBrief(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }} />
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setCreating(false)} sx={{ textTransform: "none", borderRadius: "10px" }}>Cancel</Button>
            <Button onClick={create} disabled={busy || !title.trim()} variant="contained" disableElevation
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
              {busy ? "Creating…" : "Create project"}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {projects === null && <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>Loading…</Typography>}

      {projects?.length === 0 && (
        <GlassCard>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK, mb: 0.5 }}>
            {scope === "shared" ? "Nothing shared with you yet" : "No projects yet"}
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.6 }}>
            {scope === "shared"
              ? "When somebody shares a project with you, it appears here - and the hub emails you about it."
              : <>A project is how a draft stops living in one person&rsquo;s browser. Start one, then save every attempt into it from
                Create Studio - the short version, the German one, the one somebody disagreed with - and share it with the people
                who should have a say.</>}
          </Typography>
        </GlassCard>
      )}

      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 1fr" } }}>
        {shown.map((p) => {
          const people = [{ username: p.createdBy ?? "", name: p.ownerName ?? p.createdBy ?? "?" }, ...p.members];
          const tint = p.myRole === "owner" ? TINT.purple : p.myRole === "editor" ? TINT.blue : p.myRole === "commenter" ? TINT.amber : TINT.slate;
          return (
            <GlassCard key={p.id} sx={{ display: "flex", flexDirection: "column" }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box component={Link} href={`/projects/${p.id}`} sx={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{p.title}</Typography>
                </Box>
                <Box sx={{ fontSize: "0.7rem", fontWeight: 700, px: 1, py: 0.3, borderRadius: "999px", bgcolor: tint.bg, color: tint.fg, whiteSpace: "nowrap" }}>
                  {ROLE[p.myRole]}
                </Box>
              </Box>
              <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.25 }}>
                {p.variantCount} variation{p.variantCount === 1 ? "" : "s"}
                {p.languages.length > 1 ? ` · ${p.languages.length} languages` : ""}
                {p.commentCount ? ` · ${p.commentCount} comment${p.commentCount === 1 ? "" : "s"}` : ""}
                {p.chosenVariantId ? " · decided" : ""}
                {` · ${ago(p.updatedAt)}`}
              </Typography>
              {p.brief && (
                <Typography sx={{ mt: 1, fontSize: "0.84rem", color: MUTED, lineHeight: 1.6,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.brief}
                </Typography>
              )}
              <Box sx={{ mt: "auto", pt: 1.25, borderTop: `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ display: "flex", "& > *:not(:first-of-type)": { ml: "-8px" } }}>
                  {people.slice(0, 5).map((m) => <Face key={m.username} name={m.name} size={26} />)}
                </Box>
                <Typography sx={{ fontSize: "0.74rem", color: FAINT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.myRole === "owner" ? (p.members.length ? `You and ${p.members.length} other${p.members.length === 1 ? "" : "s"}` : "Only you") : `Owned by ${p.ownerName ?? "somebody"}`}
                </Typography>
                <Button component={Link} href={`/projects/${p.id}`} size="small"
                  sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
                  Open
                </Button>
              </Box>
            </GlassCard>
          );
        })}
      </Box>

      {visible.length > PER_PAGE && (
        <Box sx={{ mt: 2 }}>
          <Pager
            total={visible.length}
            filteredFrom={visible.length === (projects?.length ?? 0) ? null : (projects?.length ?? 0)}
            noun="project"
            page={current}
            perPage={PER_PAGE}
            onPage={setPage}
            onPerPage={() => { /* a project card is a fixed size; twelve is the page */ }}
          />
        </Box>
      )}
    </Box>
  );
}
