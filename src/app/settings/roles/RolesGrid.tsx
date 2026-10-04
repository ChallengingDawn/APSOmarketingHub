"use client";
// ROLES & ACCESS — everyone against every app, on one screen.
//
// People shows one person at a time, which answers "what can Jamie see". This
// answers the other question, the one asked in a review: "who can see
// Datatracker". Same rows underneath; a different cut of them.
//
// Read-only on purpose. Two screens that both write the same grants would
// eventually disagree about what a click means; changes belong on People, where
// the person you are changing is in front of you.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { APPS } from "@/app/hubApps";
import { ROLE_LABEL, ROLE_NOTE, effectiveLevel, mfaRequired, type Level, type Role } from "@/lib/auth/access";

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

const CELL: Record<Level, { label: string; bg: string; fg: string }> = {
  none: { label: "—", bg: "transparent", fg: "#c2cad6" },
  read: { label: "View", bg: "#eef2f7", fg: "#4a5a70" },
  write: { label: "Edit", bg: "#e6f4ec", fg: "#0f7b4f" },
};

type Person = {
  id: number; username: string; full_name: string; email: string | null;
  role: Role; is_active: boolean; totp_enrolled: boolean; access: Record<string, Level>;
};

export default function RolesGrid() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/people")
      .then((r) => r.json())
      .then((j) => (j?.ok ? setPeople(j.people as Person[]) : setError(j?.error ?? "Could not read the people.")))
      .catch((e) => setError(String(e)));
  }, []);

  /** How many people can open each app, so a column means something at a glance. */
  const perApp = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of APPS) {
      m[a.key] = (people ?? []).filter((p) => p.is_active && effectiveLevel(p.role, p.access[a.key]) !== "none").length;
    }
    return m;
  }, [people]);

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5 }}>
      {error && <Typography sx={{ color: "#9e1b18", fontSize: "0.9rem" }}>{error}</Typography>}

      {/* What each role means, since the grid below is meaningless without it. */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
        {(["admin", "user", "viewer"] as Role[]).map((r) => (
          <Box key={r} sx={{ ...glass, borderRadius: "20px", p: 2.25 }}>
            <Chip size="small" label={ROLE_LABEL[r]} sx={{
              height: 22, fontSize: "0.72rem", fontWeight: 700,
              bgcolor: ROLE_TINT[r].bg, color: ROLE_TINT[r].fg, mb: 1,
            }} />
            <Typography sx={{ fontSize: "0.85rem", color: MUTED, lineHeight: 1.5 }}>{ROLE_NOTE[r]}</Typography>
            <Typography sx={{ fontSize: "0.78rem", color: mfaRequired(r) ? "#0f7b4f" : "#b26a00", mt: 1, fontWeight: 600 }}>
              {mfaRequired(r) ? "Two-factor required" : "Two-factor optional"}
            </Typography>
            {r === "admin" && (
              <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: 0.75, lineHeight: 1.45 }}>
                Needs no grants: the point of the role is that it does not have to be given apps one at a time.
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
          <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              Who can open what
            </Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
              Everyone against every app. To change any of it, open the person on People.
            </Typography>
          </Box>
          <Button component={Link} href="/settings/people" size="small" variant="outlined"
            sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}>
            Open People
          </Button>
        </Box>

        {!people && !error && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: MUTED, py: 3 }}>
            <CircularProgress size={18} /> <Typography sx={{ fontSize: "0.9rem" }}>Reading the grants…</Typography>
          </Box>
        )}

        {people && (
          <Box sx={{ overflowX: "auto" }}>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{
                    textAlign: "left", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em",
                    textTransform: "uppercase", color: FAINT, pb: 1, px: 1, borderBottom: `1px solid ${HAIRLINE}`,
                  }}>Person</Box>
                  {APPS.map((a) => (
                    <Box component="th" key={a.key} sx={{
                      px: 1, pb: 1, borderBottom: `1px solid ${HAIRLINE}`, minWidth: 96,
                    }}>
                      <Box sx={{ display: "grid", justifyItems: "center", gap: 0.5 }}>
                        <Box sx={{
                          width: 22, height: 22, borderRadius: "7px",
                          background: `linear-gradient(140deg, ${a.from}, ${a.to})`,
                        }} />
                        <Typography sx={{
                          fontSize: "0.68rem", fontWeight: 700, color: FAINT, textAlign: "center",
                          lineHeight: 1.2, maxWidth: 92,
                        }}>{a.name}</Typography>
                        <Typography sx={{ fontSize: "0.66rem", color: FAINT }}>{perApp[a.key]} people</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {people.map((p) => (
                  <Box component="tr" key={p.id} sx={{ opacity: p.is_active ? 1 : 0.5 }}>
                    <Box component="td" sx={{ px: 1, py: 1.1, borderBottom: `1px solid ${HAIRLINE}` }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>
                          {p.full_name || p.username}
                        </Typography>
                        <Chip size="small" label={ROLE_LABEL[p.role]} sx={{
                          height: 19, fontSize: "0.67rem", fontWeight: 700,
                          bgcolor: ROLE_TINT[p.role].bg, color: ROLE_TINT[p.role].fg,
                        }} />
                        {!p.is_active && (
                          <Typography sx={{ fontSize: "0.72rem", color: "#9e1b18", fontWeight: 600 }}>suspended</Typography>
                        )}
                      </Box>
                    </Box>
                    {APPS.map((a) => {
                      const lvl = effectiveLevel(p.role, p.access[a.key]);
                      const c = CELL[lvl];
                      return (
                        <Box component="td" key={a.key} sx={{
                          px: 1, py: 1.1, borderBottom: `1px solid ${HAIRLINE}`, textAlign: "center",
                        }}>
                          <Tooltip title={p.role === "admin" && lvl === "write" ? "Admins have every app" : `${a.name} · ${c.label}`}>
                            <Box component="span" sx={{
                              display: "inline-block", minWidth: 46, px: 1, py: 0.35, borderRadius: "999px",
                              fontSize: "0.72rem", fontWeight: 700, bgcolor: c.bg, color: c.fg,
                            }}>{c.label}</Box>
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
