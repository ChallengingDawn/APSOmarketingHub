"use client";

/**
 * HOW WOULD YOU LIKE TO START?
 *
 * SARCLA pointed at Adobe Express and said: this. He was right that what I
 * had built was not it. I had made a list of projects with a text field above
 * it — a filing cabinet with a label maker on top. Express does not open on
 * your files. It asks what you want to make, offers a handful of big obvious
 * ways in, and only then shows what you were working on.
 *
 * The difference matters because of who uses this. Somebody who writes two
 * pieces a month should not have to know that a project is a thing, that it
 * holds variations, or that the studio is a separate app. They should be able
 * to type what they need and land in the right place with the brief already
 * carried across.
 *
 * So: a greeting, one box, six ways in, then the recent work. Everything here
 * creates a project — including the box — because the project is what makes
 * the result survive the afternoon and reach another person.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AddIcon from "@mui/icons-material/Add";

import { FAINT, HAIRLINE, INK, MUTED } from "@/app/uc/report/ui";
import { CONTENT_TYPES } from "@/lib/content/contentTypes";

type Project = {
  id: number; title: string; brief: string | null;
  variantCount: number; languages: string[]; chosenVariantId: number | null;
  ownerName: string | null; updatedAt: string;
};

/** The six that earn a tile. The rest live behind "Something else". */
const FEATURED = ["landing-page", "blog-article", "linkedin-post", "product-page", "search-ad", "page-refresh"];

/**
 * Each tile gets its own colour and its own little abstract drawing, built
 * from divs rather than from an illustration file: it has to survive a
 * rename, a theme change and somebody adding a ninth type without anybody
 * having to open a drawing tool.
 */
const TILE: Record<string, { from: string; to: string; ink: string }> = {
  "landing-page": { from: "#fde8f1", to: "#fbd5e6", ink: "#b63a76" },
  "blog-article": { from: "#e6edfd", to: "#d6e2fb", ink: "#2459d1" },
  "linkedin-post": { from: "#e7f6ee", to: "#d4efe2", ink: "#1b7a55" },
  "product-page": { from: "#efe8fd", to: "#e3d8fb", ink: "#6a46c9" },
  "search-ad": { from: "#fdf0e3", to: "#fbe4cc", ink: "#a96a12" },
  "page-refresh": { from: "#e9eef5", to: "#dde5ef", ink: "#4a5a70" },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** A sketch of the thing, not a picture of it. Blocks suggest the shape. */
function Sketch({ typeKey, ink }: { typeKey: string; ink: string }) {
  const bar = (w: string, o: number) => (
    <Box sx={{ height: 6, width: w, borderRadius: 3, bgcolor: ink, opacity: o }} />
  );
  if (typeKey === "search-ad") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, width: "100%" }}>
        {bar("55%", 0.85)} {bar("80%", 0.3)} {bar("70%", 0.3)}
      </Box>
    );
  }
  if (typeKey === "linkedin-post") {
    return (
      <Box sx={{ display: "flex", gap: 0.8, alignItems: "flex-start", width: "100%" }}>
        <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: ink, opacity: 0.8, flexShrink: 0 }} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: 1 }}>
          {bar("90%", 0.75)} {bar("65%", 0.28)}
        </Box>
      </Box>
    );
  }
  if (typeKey === "product-page") {
    return (
      <Box sx={{ display: "flex", gap: 0.8, width: "100%" }}>
        <Box sx={{ width: 26, height: 26, borderRadius: 1.2, bgcolor: ink, opacity: 0.75, flexShrink: 0 }} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: 1, pt: 0.3 }}>
          {bar("80%", 0.6)} {bar("50%", 0.28)}
        </Box>
      </Box>
    );
  }
  // Pages and articles: a headline and a body, which is what they are.
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.55, width: "100%" }}>
      {bar("62%", 0.85)} {bar("100%", 0.28)} {bar("92%", 0.28)} {bar("74%", 0.28)}
    </Box>
  );
}

export default function ContentHome({ name }: { name: string }) {
  const router = useRouter();
  const [what, setWhat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [recent, setRecent] = useState<Project[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/content/projects?scope=mine")
      .then((r) => r.json())
      .then((j) => setRecent(j.ok ? j.projects.slice(0, 8) : []))
      .catch(() => setRecent([]));
  }, []);
  useEffect(load, [load]);

  /**
   * Everything on this screen ends here: a project exists, and you are taken
   * into the studio already pointed at it. Typing a sentence and pressing a
   * tile are the same act with different amounts said up front.
   */
  const start = async (typeKey: string | null) => {
    const said = what.trim();
    const type = typeKey ? CONTENT_TYPES.find((t) => t.key === typeKey) : null;
    const title = said || (type ? `Untitled ${type.label.toLowerCase()}` : "Untitled project");

    setBusy(typeKey ?? "prompt");
    try {
      const j = await fetch("/api/content/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.slice(0, 200), brief: said || undefined }),
      }).then((r) => r.json());
      if (!j.ok) { setBusy(null); return; }
      router.push(`/create?project=${j.project.id}${typeKey ? `&type=${typeKey}` : ""}`);
    } catch {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto" }}>
      <Box sx={{ textAlign: "center", pt: { xs: 1, md: 3 }, pb: 3 }}>
        <Typography sx={{ fontSize: "0.95rem", color: MUTED }}>
          {greeting()}, {name}
        </Typography>
        <Typography sx={{ fontSize: { xs: "1.7rem", md: "2.1rem" }, fontWeight: 800, color: INK, letterSpacing: "-0.03em", mt: 0.5 }}>
          What are we making?
        </Typography>
      </Box>

      {/* One box. Say it in your own words; everything else on the page is a
          shortcut for people who would rather point than type. */}
      <Box sx={{
        maxWidth: 680, mx: "auto", mb: 4,
        bgcolor: "#fff", borderRadius: "16px", border: `1px solid ${HAIRLINE}`,
        boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
        p: 1.5,
      }}>
        <TextField
          fullWidth multiline minRows={2} maxRows={8} variant="standard"
          placeholder="Describe what you need — “a landing page for DirectCut in Italian, aimed at joiners who cut their own panels”"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          slotProps={{ input: { disableUnderline: true, sx: { fontSize: 15, lineHeight: 1.6, px: 1 } } }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, px: 1 }}>
          <Typography sx={{ fontSize: "0.74rem", color: FAINT, flex: 1 }}>
            This starts a project. Every version you make lands in it.
          </Typography>
          <Button
            onClick={() => start(null)}
            disabled={!what.trim() || busy !== null}
            variant="contained" disableElevation
            endIcon={busy === "prompt" ? <CircularProgress size={14} color="inherit" /> : <ArrowForwardIcon />}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
          >
            Start
          </Button>
        </Box>
      </Box>

      <Box sx={{
        display: "grid", gap: 1.5, mb: 5,
        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
      }}>
        {FEATURED.map((key) => {
          const type = CONTENT_TYPES.find((t) => t.key === key);
          if (!type) return null;
          const c = TILE[key];
          return (
            <Box
              key={key}
              component="button"
              type="button"
              disabled={busy !== null}
              onClick={() => start(key)}
              sx={{
                cursor: "pointer", fontFamily: "inherit", textAlign: "left", p: 0,
                border: `1px solid ${HAIRLINE}`, borderRadius: "16px", overflow: "hidden",
                bgcolor: "#fff", display: "flex", flexDirection: "column",
                transition: "transform 120ms, box-shadow 120ms",
                "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 24px rgba(31,45,78,.10)" },
                "&:disabled": { opacity: 0.6, cursor: "default" },
              }}
            >
              <Box sx={{
                height: 92, p: 1.75, display: "flex", alignItems: "center",
                background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
              }}>
                <Sketch typeKey={key} ink={c.ink} />
              </Box>
              <Box sx={{ p: 1.25 }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>
                  {type.label}
                </Typography>
                <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.25 }}>
                  {type.sections.length} sections
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1.5 }}>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>Recent projects</Typography>
        <Box component={Link} href="/projects/all" sx={{ fontSize: "0.82rem", color: "#2459d1", textDecoration: "none" }}>
          View all
        </Box>
      </Box>

      {recent === null && <Typography sx={{ fontSize: "0.86rem", color: FAINT }}>Loading…</Typography>}

      {recent?.length === 0 && (
        <Box sx={{ p: 3, borderRadius: "16px", border: `1px dashed ${HAIRLINE}`, textAlign: "center" }}>
          <Typography sx={{ fontSize: "0.88rem", color: MUTED, lineHeight: 1.6 }}>
            Nothing yet. Type what you need above, or press one of the six.
          </Typography>
        </Box>
      )}

      <Box sx={{
        display: "grid", gap: 1.5,
        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
      }}>
        {recent?.map((p) => (
          <Box
            key={p.id} component={Link} href={`/projects/${p.id}`}
            sx={{
              textDecoration: "none", borderRadius: "14px", overflow: "hidden",
              border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", display: "block",
              transition: "box-shadow 120ms",
              "&:hover": { boxShadow: "0 8px 24px rgba(31,45,78,.10)" },
            }}
          >
            {/* A thumbnail would be a lie until variations carry images, so
                the tile shows the only honest preview: how much is in it. */}
            <Box sx={{
              height: 84, display: "flex", alignItems: "flex-end", gap: 0.4, p: 1.25,
              background: "linear-gradient(135deg, #eef1f5, #e3e9f2)",
            }}>
              {Array.from({ length: Math.min(p.variantCount || 1, 6) }).map((_, i) => (
                <Box key={i} sx={{
                  flex: 1, borderRadius: "4px 4px 0 0", bgcolor: "#2459d1",
                  opacity: 0.15 + i * 0.12, height: `${35 + ((i * 17) % 50)}%`,
                }} />
              ))}
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Typography sx={{
                fontSize: "0.82rem", fontWeight: 600, color: INK, lineHeight: 1.35,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {p.title}
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.4 }}>
                {p.variantCount} version{p.variantCount === 1 ? "" : "s"}
                {p.languages?.length > 1 ? ` · ${p.languages.length} languages` : ""}
                {p.chosenVariantId ? " · decided" : ""}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
        <Button
          component={Link} href="/projects/all" startIcon={<AddIcon />}
          sx={{ textTransform: "none", fontWeight: 600, color: MUTED }}
        >
          All projects, shared ones, and search
        </Button>
      </Box>
    </Box>
  );
}
