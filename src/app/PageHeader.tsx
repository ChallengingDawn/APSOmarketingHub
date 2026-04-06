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
 * Consistent polished page header used across the entire app.
 * Provides the APSO red→teal accent bar, Outfit display title,
 * and optional right-side slot for actions/chips.
 */
export default function PageHeader({ title, subtitle, rightSlot, badge }: PageHeaderProps) {
  return (
    <Box className="animate-fade-in-up" sx={{ mb: 4 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 4,
                height: 32,
                borderRadius: 4,
                background: "linear-gradient(180deg, #ed1b2f 0%, #274e64 100%)",
              }}
            />
            <Typography
              sx={{
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontWeight: 500,
                color: "#1f1f1f",
                letterSpacing: "-0.03em",
                fontSize: { xs: "1.85rem", md: "2.15rem" },
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
                  ml: 0.5,
                  height: 22,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: "#ed1b2f",
                  color: "#fff",
                  border: "none",
                }}
              />
            )}
          </Box>
          <Typography sx={{ color: "#5f6368", ml: 2.5, fontSize: "0.95rem" }}>
            {subtitle}
          </Typography>
        </Box>
        {rightSlot && <Box>{rightSlot}</Box>}
      </Box>
    </Box>
  );
}
