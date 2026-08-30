"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
  badge?: string;
}

/**
 * One header for every page. The title does the work; there is no decorative
 * bar beside it. The subtitle is a single measured line of context, and the
 * right slot holds the page's controls so they sit on the same baseline as the
 * title wherever the reader lands.
 */
export default function PageHeader({ title, subtitle, rightSlot, badge }: PageHeaderProps) {
  return (
    <Box
      className="animate-fade-in-up"
      sx={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
        mb: { xs: 3, md: 3.5 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
              fontWeight: 600,
              color: "#1a1d21",
              letterSpacing: "-0.03em",
              fontSize: { xs: "1.7rem", md: "2rem" },
              lineHeight: 1.1,
            }}
          >
            {title}
          </Typography>
          {badge && (
            <Chip
              label={badge}
              size="small"
              sx={{
                height: 22,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.04em",
                bgcolor: "rgba(39,78,100,0.08)",
                color: "#274e64",
                border: "1px solid rgba(39,78,100,0.18)",
              }}
            />
          )}
        </Box>
        <Typography sx={{ color: "#5b6470", fontSize: "0.95rem", mt: 0.75, maxWidth: 760, lineHeight: 1.5 }}>
          {subtitle}
        </Typography>
      </Box>
      {rightSlot && <Box sx={{ flexShrink: 0 }}>{rightSlot}</Box>}
    </Box>
  );
}
