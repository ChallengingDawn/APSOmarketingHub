"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";
import type { TemplateSpec } from "@/data/templates";
import TemplateEditor from "./TemplateEditor";

export default function TemplatesClient({ templates }: { templates: TemplateSpec[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const grouped = templates.reduce<Record<string, TemplateSpec[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] ?? []).push(t);
    return acc;
  }, {});

  const active = templates.find((t) => t.id === openId) ?? null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {Object.entries(grouped).map(([category, list]) => (
        <Box key={category}>
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color: "#5f6368",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              mb: 1.25,
            }}
          >
            {category}
          </Typography>
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
            {list.map((t) => (
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
                    position: "relative",
                    width: "100%",
                    aspectRatio: `${t.width} / ${t.height}`,
                    bgcolor: "#eceff1",
                  }}
                >
                  <Image
                    src={t.src}
                    alt={t.name}
                    fill
                    sizes="(min-width: 1200px) 25vw, (min-width: 900px) 33vw, 50vw"
                    style={{ objectFit: "cover" }}
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
        </Box>
      ))}

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