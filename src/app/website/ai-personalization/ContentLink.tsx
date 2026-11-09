"use client";

// APSOconvert > the way to a page's CONTENT PROJECT (SARCLA 08.11.2026: "have a link for the project so you can also
// navigate to it after an optimization"). A project made from APSOconvert carries a marker line in its brief
// (src/lib/convert/handoff.ts): the test's own project first, else the page's; nothing is shown when there is none, or
// when the person cannot open Content.

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import { markerOf } from "@/lib/convert/handoff";
import type { Env } from "@/lib/convert/model";

export function ContentProjectLink({ env, path, testId }: { env: Env; path: string; testId?: string | number | null }) {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/content/projects?scope=visible")
      .then((r) => r.json())
      .then((j: { ok?: boolean; projects?: { id: number; brief: string | null }[] }) => {
        if (!live || !j?.ok) return;
        const rows = (j.projects ?? []).map((p) => ({ id: p.id, m: markerOf(p.brief) })).filter((x) => x.m && x.m.env === env && x.m.path === path);
        const own = testId != null ? rows.find((x) => x.m?.testId === String(testId)) : undefined;
        setId((own ?? rows[0])?.id ?? null);
      })
      .catch(() => { /* no Content access, or Content away: no link */ });
    return () => { live = false; };
  }, [env, path, testId]);
  if (id === null) return null;
  return (
    <Button size="small" variant="outlined" href={`/projects/${id}`} startIcon={<EditNoteOutlinedIcon sx={{ fontSize: 16 }} />}
      sx={{ borderRadius: "6px", textTransform: "none", fontWeight: 600 }}>
      The Content project
    </Button>
  );
}
