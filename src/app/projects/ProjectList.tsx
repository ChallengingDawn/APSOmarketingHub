"use client";

/**
 * The projects, newest activity first.
 *
 * Each card says how many variations are under it and in how many languages,
 * because that is what tells you whether a project is a draft somebody
 * abandoned or a decision three people are arguing about.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

import { FAINT, GlassCard, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";

type Project = {
  id: number; title: string; brief: string | null; status: string;
  chosenVariantId: number | null; createdBy: string | null; updatedAt: string;
  variantCount?: number; commentCount?: number; languages?: string[];
};

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/content/projects")
      .then((r) => r.json())
      .then((j) => setProjects(j.ok ? j.projects : []))
      .catch(() => setProjects([]));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/content/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setTitle("");
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <GlassCard sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <TextField
            size="small" fullWidth placeholder="What are we working on? e.g. DirectCut landing page, Italy"
            value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            sx={{ flex: 1, minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontSize: 14 } }}
          />
          <Button
            onClick={create} disabled={busy || !title.trim()} variant="contained" disableElevation
            startIcon={<AddIcon />}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px", flexShrink: 0 }}
          >
            New project
          </Button>
        </Box>
      </GlassCard>

      {projects === null && <Typography sx={{ fontSize: "0.88rem", color: FAINT }}>Loading…</Typography>}

      {projects?.length === 0 && (
        <GlassCard>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: INK, mb: 0.5 }}>
            No projects yet
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.6 }}>
            A project is how a draft stops living in one person&rsquo;s browser. Name the thing you are
            working on, then save every attempt into it from Create Studio — the short version, the
            German one, the one somebody disagreed with. They sit side by side and people can argue
            about them in writing.
          </Typography>
        </GlassCard>
      )}

      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {projects?.map((p) => (
          <GlassCard key={p.id}>
            <Box component={Link} href={`/projects/${p.id}`} sx={{ textDecoration: "none" }}>
              <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>{p.title}</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.25 }}>
              {p.variantCount ?? 0} variation{p.variantCount === 1 ? "" : "s"}
              {p.languages && p.languages.length > 1 ? ` · ${p.languages.length} languages` : ""}
              {p.commentCount ? ` · ${p.commentCount} comment${p.commentCount === 1 ? "" : "s"}` : ""}
              {p.chosenVariantId ? " · decided" : ""}
            </Typography>
            {p.brief && (
              <Typography sx={{ mt: 1, fontSize: "0.84rem", color: MUTED, lineHeight: 1.6,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.brief}
              </Typography>
            )}
            <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
              <Button component={Link} href={`/projects/${p.id}`} size="small"
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}>
                Open
              </Button>
            </Box>
          </GlassCard>
        ))}
      </Box>
    </Box>
  );
}
