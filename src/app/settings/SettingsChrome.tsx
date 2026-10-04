"use client";
// The Settings app's own chrome.
//
// Settings stopped being a page that links elsewhere and became an application:
// one title, one row of sections, and every section inside it. The pieces were
// already there — the users table, the audit log, the integration readiness —
// but scattered across three route trees, so nobody could tell what "Settings"
// contained without being shown.
//
// Who may open which section is not enforced here. That is the access model,
// and it is not built yet; this is the shape it will hang on.

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PeopleIcon from "@mui/icons-material/People";
import HubIcon from "@mui/icons-material/Hub";
import SecurityIcon from "@mui/icons-material/Security";
import TuneIcon from "@mui/icons-material/Tune";

const INK = "#1a1d21";
const MUTED = "#5f6b76";
const HAIRLINE = "#e6e8ec";
const ACCENT = "#274e64";

const SECTIONS = [
  { name: "Overview", href: "/settings", icon: <TuneIcon />, note: "Preferences and where everything is" },
  { name: "Your account", href: "/settings/you", icon: <PersonOutlineIcon />, note: "Password, two-factor, your details" },
  { name: "People", href: "/settings/people", icon: <PeopleIcon />, note: "Who has an account" },
  { name: "Integrations", href: "/settings/integrations", icon: <HubIcon />, note: "What is connected" },
  { name: "Audit", href: "/settings/audit", icon: <SecurityIcon />, note: "Who did what" },
];

export default function SettingsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/settings";
  // Longest match wins, or /settings would light up on every section.
  const active = SECTIONS
    .filter((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/settings";

  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, pt: { xs: 2, md: 3 } }}>
        <Typography component="h1" sx={{
          fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
          fontWeight: 600, color: INK, letterSpacing: "-0.03em",
          fontSize: { xs: "1.7rem", md: "2rem" }, lineHeight: 1.1,
        }}>Settings</Typography>
        <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.25 }}>
          Your account, the people who have one, and what the hub is connected to.
        </Typography>

        <Box sx={{
          display: "flex", gap: 0.5, mt: 2, overflowX: "auto",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}>
          {SECTIONS.map((s) => {
            const on = s.href === active;
            return (
              <Box key={s.href} component={Link} href={s.href} title={s.note} sx={{
                display: "flex", alignItems: "center", gap: 0.8, px: 1.5, py: 1.25,
                textDecoration: "none", whiteSpace: "nowrap",
                fontSize: "0.88rem", fontWeight: 600, letterSpacing: "-0.01em",
                color: on ? ACCENT : MUTED,
                boxShadow: on ? `inset 0 -2px 0 ${ACCENT}` : "none",
                "& svg": { fontSize: 18 },
                "&:hover": { color: INK },
                "&:focus-visible": { outline: `2px solid ${ACCENT}`, outlineOffset: -2 },
              }}>{s.icon}{s.name}</Box>
            );
          })}
        </Box>
      </Box>
      {children}
    </Box>
  );
}
