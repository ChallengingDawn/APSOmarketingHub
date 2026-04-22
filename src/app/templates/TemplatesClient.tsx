"use client";
import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CloseIcon from "@mui/icons-material/Close";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import type { TemplateSpec } from "@/data/templates";
import TemplateEditor from "./TemplateEditor";

const CATEGORY_ORDER: TemplateSpec["category"][] = ["LinkedIn event", "Email signature"];

export default function TemplatesClient({ templates }: { templates: TemplateSpec[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<TemplateSpec["category"]>("LinkedIn event");

  const grouped = useMemo(() => {
    const acc: Record<string, TemplateSpec[]> = {};
    for (const t of templates) (acc[t.category] = acc[t.category] ?? []).push(t);
    return acc;
  }, [templates]);

  const visible = grouped[tab] ?? [];
  const active = templates.find((t) => t.id === openId) ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, v: TemplateSpec["category"]) => setTab(v)}
        sx={{
          minHeight: 40,
          borderBottom: "1px solid #e8eaed",
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 600,
            fontSize: 13,
            minHeight: 40,
            py: 0,
            color: "#5f6368",
          },
          "& .Mui-selected": { color: "#ed1b2f" },
          "& .MuiTabs-indicator": { backgroundColor: "#ed1b2f", height: 2 },
        }}
      >
        {CATEGORY_ORDER.map((cat) => (
          <Tab
            key={cat}
            value={cat}
            icon={
              cat === "LinkedIn event" ? (
                <LinkedInIcon sx={{ fontSize: 18 }} />
              ) : (
                <MailOutlineIcon sx={{ fontSize: 18 }} />
              )
            }
            iconPosition="start"
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                {cat}
                <Chip
                  label={(grouped[cat] ?? []).length}
                  size="small"
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 2,
        }}
      >
        {visible.map((t) => (
          <Paper
            key={t.id}
            variant="outlined"
            onClick={() => setOpenId(t.id)}
            sx={{
              borderRadius: 2,
              borderColor: "#dde1e6",
              overflow: "hidden",
              cursor: "pointer",
              bgcolor: "#ffffff",
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                borderColor: "#ed1b2f",
              },
            }}
          >
            <Box
              sx={{
                width: "100%",
                aspectRatio: `${t.width} / ${t.height}`,
                bgcolor: "#eceff1",
                overflow: "hidden",
              }}
            >
              {/* Plain <img> — Next/Image was failing to render local public assets in this dialog grid. */}
              <Box
                component="img"
                src={t.src}
                alt={t.name}
                loading="lazy"
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1a3a4c", mb: 0.25 }}>
                {t.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: 11,
                  color: "#5f6368",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {t.description}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                <Chip
                  label={`${t.width}×${t.height}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: 10 }}
                />
                {t.photoSlot && (
                  <Chip
                    label="Photo slot"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 10,
                      bgcolor: "#fdebed",
                      color: "#ed1b2f",
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      <Dialog
        open={!!active}
        onClose={() => setOpenId(null)}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: { sx: { borderRadius: 3, overflow: "hidden" } },
          backdrop: { sx: { bgcolor: "rgba(15,20,26,0.5)", backdropFilter: "blur(6px)" } },
        }}
      >
        {active && (
          <Box sx={{ position: "relative" }}>
            <IconButton
              onClick={() => setOpenId(null)}
              sx={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 2,
                bgcolor: "rgba(255,255,255,0.9)",
                "&:hover": { bgcolor: "#fff" },
              }}
            >
              <CloseIcon />
            </IconButton>
            <TemplateEditor template={active} />
          </Box>
        )}
      </Dialog>
    </Box>
  );
}