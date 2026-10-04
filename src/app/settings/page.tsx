"use client";
// SETTINGS — the overview.
//
// Your account, what you can change about the hub, and the way into the parts
// that govern other people. The sections themselves live in the sidebar; this
// page is the landing, so it answers "what is here" and hands you on.
//
// Nothing here is drawn as a control that does not work. Where something is not
// built, it says so in words instead of as a switch that persists nothing — a
// switch like that is worse than no switch, because it looks like a promise.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TuneIcon from "@mui/icons-material/Tune";
import PeopleIcon from "@mui/icons-material/People";
import HubIcon from "@mui/icons-material/Hub";
import SecurityIcon from "@mui/icons-material/Security";
import DescriptionIcon from "@mui/icons-material/Description";
import LinkIcon from "@mui/icons-material/Link";

import { ROLE_LABEL, ROLE_NOTE, type Role } from "@/lib/auth/access";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";

const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

const ROLE_TINT: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: "#efe8fd", fg: "#5a3fa0" },
  user: { bg: "#e6edfd", fg: "#2459d1" },
  viewer: { bg: "#e9eef5", fg: "#4a5a70" },
};

type Me = { full_name: string; username: string; email: string | null; role: Role; totp_enrolled: boolean };

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

function Card({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 }, ...sx }}>{children}</Box>;
}

function Head({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: "11px", display: "grid", placeItems: "center",
        bgcolor: "#e6edfd", color: "#2459d1", flexShrink: 0, "& svg": { fontSize: 20 },
      }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>{title}</Typography>
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>{note}</Typography>
      </Box>
    </Box>
  );
}

const WORKSPACE = [
  { name: "People & access", note: "Who may open which app", href: "/settings/people", icon: <PeopleIcon />, tint: "#e6edfd", fg: "#2459d1" },
  { name: "Integrations", note: "Connect your apps and services", href: "/settings/integrations", icon: <HubIcon />, tint: "#e7f6ee", fg: "#1b7a55" },
  { name: "Audit log", note: "What was done, and by whom", href: "/settings/audit", icon: <SecurityIcon />, tint: "#efe8fd", fg: "#6a46c9" },
];

/** Everyone can read the docs; nothing in them is privileged. */
const FOR_EVERYONE = [
  { name: "Docs", note: "How the hub works", href: "/docs", icon: <DescriptionIcon />, tint: "#fdf0e3", fg: "#a96a12" },
];

export default function SettingsOverview() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.user) setMe(j.user as Me); })
      .catch(() => {});
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5 }}>
      <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", lg: "1.25fr 1fr" } }}>
        <Card>
          <Head icon={<PersonOutlineIcon />} title="Your account" note="Who the hub thinks you are." />
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
              bgcolor: me ? ROLE_TINT[me.role].bg : "#e9eef5", color: me ? ROLE_TINT[me.role].fg : FAINT,
              fontSize: "1.05rem", fontWeight: 700,
            }}>{me ? initials(me.full_name || me.username) : "·"}</Box>
            <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
              <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.015em" }}>
                {me?.full_name || "…"}
              </Typography>
              <Typography sx={{ fontSize: "0.84rem", color: FAINT }}>{me?.email || me?.username || ""}</Typography>
              {me && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
                  <Chip size="small" label={ROLE_LABEL[me.role]} sx={{
                    height: 21, fontSize: "0.7rem", fontWeight: 700,
                    bgcolor: ROLE_TINT[me.role].bg, color: ROLE_TINT[me.role].fg,
                  }} />
                  <Typography sx={{
                    fontSize: "0.75rem", fontWeight: 600,
                    color: me.totp_enrolled ? "#1e7e45" : "#b26a00",
                  }}>
                    {me.totp_enrolled ? "Two-factor on" : "Two-factor off"}
                  </Typography>
                </Box>
              )}
            </Box>
            <Button component={Link} href="/settings/you" endIcon={<ArrowForwardIcon />} variant="contained"
              sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}>
              Manage profile &amp; security
            </Button>
          </Box>
          {me && (
            <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 2, pt: 2, borderTop: `1px solid ${HAIRLINE}` }}>
              {ROLE_NOTE[me.role]} Only an admin can change a role, and nobody can change their own.
            </Typography>
          )}
        </Card>

        <Card>
          <Head icon={<TuneIcon />} title="Personal preferences" note="What you can change about your own hub." />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, borderRadius: "14px", bgcolor: "rgba(255,255,255,.6)", border: `1px solid ${HAIRLINE}` }}>
            <Box sx={{
              width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center",
              bgcolor: "#e9eef5", color: "#4a5a70", flexShrink: 0, "& svg": { fontSize: 18 },
            }}><LinkIcon /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>Quick links</Typography>
              <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
                Yours, kept against your account. Edit them on the home screen.
              </Typography>
            </Box>
            <Button component={Link} href="/" size="small" sx={{ textTransform: "none", flexShrink: 0 }}>Open</Button>
          </Box>

          {/* Said plainly rather than drawn as three dropdowns that save nothing. */}
          <Typography sx={{ fontSize: "0.82rem", color: MUTED, mt: 2, lineHeight: 1.6 }}>
            <strong style={{ color: INK }}>Not built yet:</strong> language, light and dark, and notification
            preferences. Each needs somewhere to take effect before it is worth a control — the hub is English
            and light-only today, and it sends nothing.
          </Typography>
        </Card>
      </Box>

      {/* Admins only. A viewer offered People, Integrations and the audit log is
          a viewer being offered four doors that all refuse them — and three of
          them say, by existing, that there is something here worth asking for. */}
      {me?.role === "admin" && (
      <Card>
        <Head icon={<HubIcon />} title="Workspace settings"
          note="Access, integrations and the record of what was done." />
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
          {WORKSPACE.map((w) => (
            <Box key={w.href} component={Link} href={w.href} sx={{
              display: "flex", alignItems: "center", gap: 1.5, p: 1.75, borderRadius: "16px",
              textDecoration: "none", bgcolor: "rgba(255,255,255,.62)", border: `1px solid ${HAIRLINE}`,
              transition: "transform .16s ease, background-color .16s ease",
              "&:hover": { transform: "translateY(-2px)", bgcolor: "#fff" },
              "&:focus-visible": { outline: "2px solid #2459d1", outlineOffset: 3 },
              "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { transform: "none" } },
            }}>
              <Box sx={{
                width: 36, height: 36, borderRadius: "11px", display: "grid", placeItems: "center",
                bgcolor: w.tint, color: w.fg, flexShrink: 0, "& svg": { fontSize: 19 },
              }}>{w.icon}</Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK, lineHeight: 1.25 }}>{w.name}</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: FAINT, lineHeight: 1.3 }}>{w.note}</Typography>
              </Box>
              <ArrowForwardIcon sx={{ fontSize: 17, color: FAINT, flexShrink: 0 }} />
            </Box>
          ))}
        </Box>
      </Card>
      )}

      {/* Nothing in the docs is privileged, so everyone gets a way to them. */}
      {me && me.role !== "admin" && (
        <Card>
          <Head icon={<DescriptionIcon />} title="Help" note="How the hub works." />
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" } }}>
            {FOR_EVERYONE.map((w) => (
              <Box key={w.href} component={Link} href={w.href} sx={{
                display: "flex", alignItems: "center", gap: 1.5, p: 1.75, borderRadius: "16px",
                textDecoration: "none", bgcolor: "rgba(255,255,255,.62)", border: `1px solid ${HAIRLINE}`,
                "&:hover": { bgcolor: "#fff" },
              }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: "11px", display: "grid", placeItems: "center",
                  bgcolor: w.tint, color: w.fg, flexShrink: 0, "& svg": { fontSize: 19 },
                }}>{w.icon}</Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{w.name}</Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: FAINT }}>{w.note}</Typography>
                </Box>
                <ArrowForwardIcon sx={{ fontSize: 17, color: FAINT, flexShrink: 0 }} />
              </Box>
            ))}
          </Box>
        </Card>
      )}
    </Box>
  );
}
