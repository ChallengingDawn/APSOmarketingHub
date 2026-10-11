"use client";

/**
 * WHAT ARE WE MAKING?
 *
 * The studio opened on a 160px dropdown listing six channels, so the first
 * decision — the one that determines the shape of everything that follows —
 * looked like a formatting preference. Adobe Express gets this right: you
 * start by picking the THING, from a gallery, and the tool reshapes itself
 * around it.
 *
 * Each card here is a real type with its own section skeleton (see
 * @/lib/content/contentTypes), so picking "SEO landing page" and picking
 * "Search ad" now produce genuinely different artefacts rather than the same
 * essay at two lengths. The card says what you get, and the sections are on
 * the back of it, because the structure is the product.
 */

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import ArticleIcon from "@mui/icons-material/Article";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import InventoryIcon from "@mui/icons-material/Inventory";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import CampaignIcon from "@mui/icons-material/Campaign";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { CONTENT_GROUPS, CONTENT_TYPES, type ContentType } from "@/lib/content/contentTypes";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";
const ACCENT = "#2459d1";

const ICONS: Record<string, React.ReactNode> = {
  "landing-page": <TravelExploreIcon />,
  "product-page": <InventoryIcon />,
  "blog-article": <ArticleIcon />,
  "linkedin-post": <LinkedInIcon />,
  newsletter: <NewspaperIcon />,
  "search-ad": <CampaignIcon />,
  "page-refresh": <AutorenewIcon />,
  "consolidation-brief": <CallSplitIcon />,
};

function TypeCard({ type, active, onPick }: { type: ContentType; active: boolean; onPick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onPick}
      aria-pressed={active}
      sx={{
        textAlign: "left", cursor: "pointer", fontFamily: "inherit",
        p: 1.75, borderRadius: "16px", width: "100%", height: "100%",
        display: "flex", flexDirection: "column", gap: 0.75,
        bgcolor: active ? "#eef3ff" : "#fff",
        border: `1px solid ${active ? ACCENT : HAIRLINE}`,
        boxShadow: active ? `0 0 0 1px ${ACCENT}` : "0 1px 2px rgba(31,45,78,.04)",
        transition: "border-color 120ms, background-color 120ms",
        "&:hover": { borderColor: ACCENT },
      }}
    >
      <Box sx={{ color: active ? ACCENT : MUTED, "& svg": { fontSize: 22 } }}>{ICONS[type.key]}</Box>
      <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.25 }}>
        {type.label}
      </Typography>
      <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{type.blurb}</Typography>
      <Box sx={{ flex: 1 }} />
      <Typography sx={{ fontSize: "0.7rem", color: FAINT, mt: 0.5 }}>
        {type.sections.length} sections
        {type.seoNeeds !== "none" && " · uses Search Console"}
      </Typography>
    </Box>
  );
}

export default function TypePicker({
  value, onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = CONTENT_TYPES.find((t) => t.key === value) ?? CONTENT_TYPES[0];

  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen(true)}
        sx={{
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          display: "flex", alignItems: "center", gap: 1,
          px: 1.5, py: 1, borderRadius: "12px", flexShrink: 0,
          bgcolor: "#fff", border: `1px solid ${HAIRLINE}`,
          "&:hover": { borderColor: ACCENT },
        }}
      >
        <Box sx={{ color: ACCENT, display: "flex", "& svg": { fontSize: 20 } }}>{ICONS[current.key]}</Box>
        <Box>
          <Typography sx={{ fontSize: "0.7rem", color: FAINT, lineHeight: 1.2 }}>Making</Typography>
          <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, lineHeight: 1.3 }}>
            {current.label}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{ fontSize: 18, color: MUTED }} />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth
        slotProps={{ paper: { sx: { borderRadius: "20px" } } }}>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK, mb: 0.5 }}>
            What are we making?
          </Typography>
          <Typography sx={{ fontSize: "0.84rem", color: MUTED, mb: 2.5 }}>
            Each one has its own structure. A landing page is not a blog post with a different length.
          </Typography>

          {CONTENT_GROUPS.map((group) => {
            const inGroup = CONTENT_TYPES.filter((t) => t.group === group);
            if (inGroup.length === 0) return null;
            return (
              <Box key={group} sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: FAINT, letterSpacing: "0.08em", mb: 1 }}>
                  {group.toUpperCase()}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" }, gap: 1.5 }}>
                  {inGroup.map((t) => (
                    <TypeCard
                      key={t.key} type={t} active={t.key === value}
                      onPick={() => { onChange(t.key); setOpen(false); }}
                    />
                  ))}
                </Box>
              </Box>
            );
          })}

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setOpen(false)} sx={{ textTransform: "none", fontWeight: 600 }}>
              Close
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
