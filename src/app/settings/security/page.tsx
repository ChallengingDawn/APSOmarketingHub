"use client";
// SECURITY — how you get in, and what stands between a stolen password and
// everything you can see.
//
// Two things work today: changing the password, and enrolling an authenticator.
// The gaps are named rather than hidden, because the one that matters — losing
// the phone — currently needs an admin, and somebody should know that before it
// happens rather than after.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";

import { ROLE_LABEL, mfaRequired, type Role } from "@/lib/auth/access";

const INK = "#15223a";
const MUTED = "#5d6b85";
const FAINT = "#8b97ac";
const HAIRLINE = "rgba(21,34,58,.10)";
const OK = "#1e7e45";
const WARN = "#b26a00";

const glass = {
  bgcolor: "rgba(255,255,255,.72)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,.8)",
  boxShadow: "0 1px 2px rgba(31,45,78,.04), 0 12px 32px rgba(31,45,78,.07)",
};

type Me = { username: string; role: Role; totp_enrolled: boolean; last_login: string | null };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

export default function Security() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("You are not signed in."))))
      .then((j) => setMe(j.user as Me))
      .catch((e) => setError(String((e as Error).message ?? e)));
  }, []);

  const must = me ? mfaRequired(me.role) : false;

  return (
    <Box sx={{ px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 }, display: "grid", gap: 2.5, maxWidth: 820 }}>
      {error && <Typography sx={{ color: "#9e1b18", fontSize: "0.9rem" }}>{error}</Typography>}
      {!me && !error && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: MUTED }}>
          <CircularProgress size={18} /> <Typography sx={{ fontSize: "0.9rem" }}>Reading your account…</Typography>
        </Box>
      )}

      {me && (
        <>
          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", flexShrink: 0,
                bgcolor: me.totp_enrolled ? "#e6f4ec" : "#fff6e8", color: me.totp_enrolled ? OK : WARN,
              }}>{me.totp_enrolled ? <CheckCircleIcon /> : <ShieldOutlinedIcon />}</Box>
              <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
                  Two-factor authentication
                </Typography>
                <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.4, lineHeight: 1.5 }}>
                  {me.totp_enrolled
                    ? "Your authenticator is enrolled. A password alone will not get anyone in."
                    : must
                      ? `Your role is ${ROLE_LABEL[me.role]}, which can change things, so this should be on. A password alone is all that stands between a stolen login and everything you can see.`
                      : "Optional for your role, because you can only read. It is still the single best thing you can do for this account."}
                </Typography>
              </Box>
              {!me.totp_enrolled && (
                <Button component={Link} href="/enroll" variant="contained" size="small"
                  sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}>
                  Turn it on
                </Button>
              )}
            </Box>
          </Box>

          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", flexShrink: 0,
                bgcolor: "#e6edfd", color: "#2459d1",
              }}><KeyOutlinedIcon /></Box>
              <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
                  Password
                </Typography>
                <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.4 }}>
                  Last signed in {when(me.last_login)}.
                </Typography>
              </Box>
              <Button component={Link} href="/change-password" variant="outlined" size="small"
                sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}>
                Change password
              </Button>
            </Box>
          </Box>

          {/* The gaps, named. The first one is the one that bites. */}
          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
            <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              Not built yet
            </Typography>
            <Typography sx={{ fontSize: "0.84rem", color: MUTED, mt: 0.25, mb: 2 }}>
              Worth knowing before you need them, rather than at the moment you do.
            </Typography>
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {[
                {
                  icon: <ConfirmationNumberOutlinedIcon />, name: "Recovery codes",
                  why: "Lose the phone today and an admin has to reset your second factor. Ten one-time codes, issued when you enrol, would make that a two-minute job you do yourself.",
                },
                {
                  icon: <DevicesOtherIcon />, name: "Signed-in devices",
                  why: "There is no list of where you are signed in, and changing your password does not end the other sessions.",
                },
              ].map((g) => (
                <Box key={g.name} sx={{
                  display: "flex", gap: 1.5, p: 1.75, borderRadius: "16px",
                  bgcolor: "rgba(255,255,255,.55)", border: `1px solid ${HAIRLINE}`,
                }}>
                  <Box sx={{
                    width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center",
                    bgcolor: "#eef1f5", color: FAINT, flexShrink: 0, "& svg": { fontSize: 18 },
                  }}>{g.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>{g.name}</Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{g.why}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
