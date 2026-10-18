"use client";

// NAVIGATION ON A PROJECT PAGE.
//
// You could reach a project and then you were stuck in it: no way back to the
// list, no way across to the next one, no way to the calendar. Every move
// meant the browser's back button or retyping a URL, which is what SARCLA
// meant by not being able to get at the full extent of it.
//
// Two things, because they are two different errands. A row of the places you
// might go NEXT, and a switcher for the project you might want INSTEAD -
// which lists the projects themselves, because "the next one" is a project
// and not a page.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GroupsIcon from "@mui/icons-material/Groups";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AddIcon from "@mui/icons-material/Add";

import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";

type Row = { id: number; title: string; folder: string | null; dueDate: string | null; status: string };

const PLACES = [
  { href: "/projects", label: "All projects", icon: <FolderOpenIcon sx={{ fontSize: 16 }} /> },
  { href: "/projects/all?scope=shared", label: "Shared with me", icon: <GroupsIcon sx={{ fontSize: 16 }} /> },
  { href: "/projects/all?scope=starred", label: "Starred", icon: <StarBorderIcon sx={{ fontSize: 16 }} /> },
  { href: "/projects/calendar", label: "Calendar", icon: <CalendarMonthIcon sx={{ fontSize: 16 }} /> },
];

export default function ProjectNav({ id }: { id: number }) {
  const router = useRouter();
  const [at, setAt] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  // Loaded when the switcher is first opened, not on every project page: the
  // list is only needed by somebody who has decided to leave this one.
  const load = useCallback(() => {
    if (rows !== null) return;
    fetch("/api/content/projects?scope=visible")
      .then((r) => r.json())
      .then((j) => setRows(j.ok ? j.projects : []))
      .catch(() => setRows([]));
  }, [rows]);

  useEffect(() => {
    if (at) load();
  }, [at, load]);

  const here = rows?.find((r) => r.id === id) ?? null;
  const others = (rows ?? []).filter((r) => r.id !== id);

  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap",
      mb: 2, pb: 1.25, borderBottom: `1px solid ${HAIRLINE}`,
    }}>
      {/* Back first and leftmost, because leaving is the move people fail to
          find. A link, not a history step: history takes you to wherever you
          came from, which on a reload is nowhere. */}
      <Button
        component={Link}
        href="/projects"
        size="small"
        startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
        sx={{ textTransform: "none", fontWeight: 600, color: MUTED, borderRadius: "10px" }}
      >
        Projects
      </Button>

      <Typography sx={{ color: FAINT, px: 0.25 }}>/</Typography>

      <Button
        size="small"
        onClick={(e) => setAt(e.currentTarget)}
        endIcon={<ExpandMoreIcon sx={{ fontSize: 17 }} />}
        sx={{ textTransform: "none", fontWeight: 700, color: INK, borderRadius: "10px", maxWidth: 360 }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {here?.title ?? "This project"}
        </Box>
      </Button>

      <Box sx={{ flex: 1 }} />

      {PLACES.map((p) => (
        <Button
          key={p.href}
          component={Link}
          href={p.href}
          size="small"
          startIcon={p.icon}
          sx={{ textTransform: "none", fontWeight: 600, color: MUTED, borderRadius: "10px" }}
        >
          {p.label}
        </Button>
      ))}

      <Menu
        open={Boolean(at)}
        anchorEl={at}
        onClose={() => setAt(null)}
        slotProps={{ paper: { sx: { borderRadius: "12px", minWidth: 290, maxHeight: 420 } } }}
      >
        {rows === null && (
          <MenuItem disabled sx={{ fontSize: "0.85rem" }}>Loading your projects&hellip;</MenuItem>
        )}
        {rows !== null && others.length === 0 && (
          <MenuItem disabled sx={{ fontSize: "0.85rem" }}>This is your only project.</MenuItem>
        )}
        {others.map((r) => (
          <MenuItem
            key={r.id}
            onClick={() => { setAt(null); router.push(`/projects/${r.id}`); }}
            sx={{ display: "block", py: 0.75 }}
          >
            <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{r.title}</Typography>
            {/* The folder and the date, because two projects called
                "LinkedIn post" are told apart by where they are filed and
                when they are due, not by their names. */}
            {(r.folder || r.dueDate) && (
              <Typography sx={{ fontSize: "0.74rem", color: FAINT }}>
                {[r.folder, r.dueDate].filter(Boolean).join(" · ")}
              </Typography>
            )}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => { setAt(null); router.push("/projects/all"); }}
          sx={{ fontSize: "0.85rem", fontWeight: 600, gap: 1 }}
        >
          <AddIcon sx={{ fontSize: 16 }} /> See them all, or start one
        </MenuItem>
      </Menu>
    </Box>
  );
}
