"use client";
// YOUR ACCOUNT.
//
// The one section of Settings every person reaches, whatever else they may
// open. It shows what the hub actually knows about you and the two things you
// can do about it: change the password, and turn on the second factor.
//
// Everything here is read from the session rather than assumed. Where a control
// does not exist yet it says so — a switch that silently does nothing is worse
// than no switch.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";

const INK = "#1a1d21";
const MUTED = "#5f6b76";
const FAINT = "#8b96a1";
const HAIRLINE = "#e6e8ec";
const OK = "#0f7b4f";
const WARN = "#b26a00";

type Me = {
  username: string;
  email: string | null;
  full_name: string;
  role: "admin" | "user" | "viewer";
  totp_enrolled: boolean;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
};

const ROLE_NOTE: Record<string, string> = {
  admin: "Full access, including People and the integrations.",
  user: "Can change things in the apps you can open.",
  viewer: "Read-only in the apps you can open.",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 2.5, bgcolor: "#fff", p: { xs: 2, md: 2.5 } }}>
      <Typography sx={{
        fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: FAINT, mb: 1.5,
      }}>{title}</Typography>
      {children}
    </Box>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{
      display: "flex", gap: 2, alignItems: "baseline", py: 1,
      borderBottom: `1px solid ${HAIRLINE}`, "&:last-of-type": { borderBottom: 0 },
    }}>
      <Typography sx={{ fontSize: "0.82rem", color: MUTED, width: 128, flexShrink: 0 }}>{label}</Typography>
      <Box sx={{ fontSize: "0.9rem", color: INK, minWidth: 0 }}>{value}</Box>
    </Box>
  );
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function YourAccount() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Not signed in."))))
      .then((j) => setMe(j.user as Me))
      .catch((e) => setError(String((e as Error).message ?? e)));
  }, []);

  return (
    <Box sx={{
      px: { xs: 2, sm: 2.5, md: 3, lg: 4 }, py: { xs: 2.5, md: 3 },
      display: "grid", gap: 2.5, maxWidth: 820,
    }}>
      {error && <Typography sx={{ color: "#9e1b18", fontSize: "0.9rem" }}>{error}</Typography>}
      {!me && !error && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: MUTED }}>
          <CircularProgress size={18} /> <Typography sx={{ fontSize: "0.9rem" }}>Reading your account…</Typography>
        </Box>
      )}

      {me && (
        <>
          <Card title="You">
            <Row label="Name" value={me.full_name} />
            <Row label="Username" value={me.username} />
            <Row label="Email" value={me.email || <Box component="span" sx={{ color: FAINT }}>not set</Box>} />
            <Row label="Role" value={
              <Box>
                <Box component="span" sx={{ fontWeight: 600, textTransform: "capitalize" }}>{me.role}</Box>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 0.25 }}>
                  {ROLE_NOTE[me.role] ?? ""} Only an admin can change it.
                </Typography>
              </Box>
            } />
            <Row label="Last signed in" value={when(me.last_login)} />
          </Card>

          <Card title="Security">
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Box sx={{
                width: 42, height: 42, borderRadius: 2.2, display: "grid", placeItems: "center", flexShrink: 0,
                bgcolor: me.totp_enrolled ? "#e6f4ec" : "#fff6e8",
                color: me.totp_enrolled ? OK : WARN,
              }}>{me.totp_enrolled ? <CheckCircleIcon /> : <ShieldOutlinedIcon />}</Box>
              <Box sx={{ flex: "1 1 280px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>
                  {me.totp_enrolled ? "Two-factor is on" : "Two-factor is off"}
                </Typography>
                <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 0.25 }}>
                  {me.totp_enrolled
                    ? "Your authenticator is enrolled. Losing the phone currently needs an admin to reset it — recovery codes are not issued yet."
                    : "A password alone is all that stands between a stolen login and everything you can see."}
                </Typography>
              </Box>
              {!me.totp_enrolled && (
                <Button component={Link} href="/enroll" variant="contained" size="small" sx={{ flexShrink: 0 }}>
                  Turn it on
                </Button>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mt: 2.5, pt: 2.5, borderTop: `1px solid ${HAIRLINE}` }}>
              <Box sx={{ flex: "1 1 280px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: INK }}>Password</Typography>
                <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 0.25 }}>
                  Changing it does not sign out your other devices yet.
                </Typography>
              </Box>
              <Button component={Link} href="/change-password" variant="outlined" size="small" sx={{ flexShrink: 0 }}>
                Change password
              </Button>
            </Box>
          </Card>

          {/* Said plainly rather than drawn as switches that persist nothing. */}
          <Card title="Not built yet">
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, lineHeight: 1.6 }}>
              Recovery codes, so a lost phone does not need an admin. Signed-in devices, with a way to end a
              session you do not recognise. A per-person record of which apps you may open — today that follows
              from your role alone. Each of these is listed here so the gap is visible rather than discovered.
            </Typography>
          </Card>
        </>
      )}
    </Box>
  );
}
