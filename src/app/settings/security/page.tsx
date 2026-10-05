"use client";
// SECURITY — how you get in, and what stands between a stolen password and
// everything you can see.
//
// Four things, all of them real: the password, the authenticator, ten recovery
// codes for the day the phone is gone, and the list of where you are signed in
// with a way to end any of it.
//
// The two that were named as gaps are the two that bite — losing the phone used
// to need an admin and a phone call, and a password change used to leave every
// other browser signed in. Neither is true now.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
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
type Device = {
  id: string; sid: string; label: string; ip: string | null;
  since: string; lastSeen: string; current: boolean;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never";

export default function Security() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<{ remaining: number; total: number; size: number } | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  // The only moment the codes exist in the clear.
  const [issued, setIssued] = useState<string[] | null>(null);
  const [ask, setAsk] = useState<{ password: string } | null>(null);

  const loadCodes = useCallback(() => {
    fetch("/api/me/recovery-codes")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setCodes({ remaining: j.remaining, total: j.total, size: j.size }); })
      .catch(() => {});
  }, []);

  const loadDevices = useCallback(() => {
    fetch("/api/me/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) { setDevices(j.sessions as Device[]); setLegacy(!!j.legacy); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("You are not signed in."))))
      .then((j) => setMe(j.user as Me))
      .catch((e) => setError(String((e as Error).message ?? e)));
    loadCodes();
    loadDevices();
  }, [loadCodes, loadDevices]);

  const issue = async (password: string) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/me/recovery-codes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "Those codes could not be made."); return; }
      setIssued(j.codes as string[]);
      setAsk(null);
      loadCodes();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const endSessions = async (sid?: string) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/me/sessions${sid ? `?sid=${encodeURIComponent(sid)}` : ""}`, { method: "DELETE" });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That did not work."); return; }
      loadDevices();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

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

          {/* ---------------------------------------------- recovery codes */}
          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", flexShrink: 0,
                bgcolor: codes && codes.remaining > 0 ? "#e6f4ec" : "#fff6e8",
                color: codes && codes.remaining > 0 ? OK : WARN,
              }}><ConfirmationNumberOutlinedIcon /></Box>
              <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
                  Recovery codes
                </Typography>
                <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.4, lineHeight: 1.5 }}>
                  {codes && codes.total > 0
                    ? `${codes.remaining} of ${codes.total} left. Each one works once, in place of the code from your app.`
                    : "For the day the phone is lost or wiped. Ten one-time codes you keep somewhere that is not the phone \u2014 print them, or put them in a password manager."}
                </Typography>
                {codes && codes.total > 0 && codes.remaining <= 3 && (
                  <Typography sx={{ fontSize: "0.8rem", color: WARN, mt: 0.5, fontWeight: 600 }}>
                    Running low. Generating a new set replaces all of them.
                  </Typography>
                )}
              </Box>
              <Button variant={codes && codes.total > 0 ? "outlined" : "contained"} size="small"
                disabled={busy} onClick={() => { setIssued(null); setAsk({ password: "" }); }}
                sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}>
                {codes && codes.total > 0 ? "Generate new codes" : "Generate codes"}
              </Button>
            </Box>
          </Box>

          {/* ------------------------------------------------------ devices */}
          <Box sx={{ ...glass, borderRadius: "22px", p: { xs: 2, md: 2.5 } }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap", mb: devices?.length ? 2 : 0 }}>
              <Box sx={{
                width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", flexShrink: 0,
                bgcolor: "#e6edfd", color: "#2459d1",
              }}><DevicesOtherIcon /></Box>
              <Box sx={{ flex: "1 1 300px", minWidth: 0 }}>
                <Typography sx={{ fontSize: "1.02rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
                  Where you are signed in
                </Typography>
                <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.4, lineHeight: 1.5 }}>
                  Ending a session takes effect on its next click, not in twelve hours. Changing your password
                  ends them all except this one.
                </Typography>
              </Box>
              {devices && devices.length > 1 && (
                <Button variant="outlined" size="small" disabled={busy} onClick={() => endSessions()}
                  sx={{ textTransform: "none", borderRadius: "12px", flexShrink: 0 }}>
                  Sign out everywhere else
                </Button>
              )}
            </Box>

            {devices === null && (
              <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>Reading your sessions\u2026</Typography>
            )}
            {devices?.length === 0 && (
              <Typography sx={{ fontSize: "0.85rem", color: MUTED }}>
                Nothing to show yet. This browser will appear the next time you sign in.
              </Typography>
            )}
            <Box sx={{ display: "grid", gap: 1.25 }}>
              {devices?.map((d) => (
                <Box key={d.sid} sx={{
                  display: "flex", gap: 1.5, alignItems: "center", p: 1.6, borderRadius: "16px",
                  bgcolor: d.current ? "rgba(36,89,209,.06)" : "rgba(255,255,255,.55)",
                  border: `1px solid ${d.current ? "rgba(36,89,209,.22)" : HAIRLINE}`,
                }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, color: INK }}>
                      {d.label}
                      {d.current && (
                        <Box component="span" sx={{ color: "#2459d1", fontWeight: 700 }}> &middot; this browser</Box>
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: "0.78rem", color: FAINT }}>
                      {d.ip ? `${d.ip} \u00b7 ` : ""}last used {when(d.lastSeen)}
                    </Typography>
                  </Box>
                  {!d.current && (
                    <Button size="small" disabled={busy} onClick={() => endSessions(d.sid)}
                      sx={{ textTransform: "none", color: MUTED, flexShrink: 0 }}>
                      End
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
            {legacy && (
              <Typography sx={{ fontSize: "0.78rem", color: WARN, mt: 1.5, lineHeight: 1.5 }}>
                You signed in before this list existed, so your own session is not in it. Sign out and back in
                and it will be \u2014 and so will anything else you have open.
              </Typography>
            )}
          </Box>

          {/* Ask for the password, then show the codes once. Two states in one
              dialog, because the second is not something to dismiss by accident. */}
          <Dialog open={!!ask || !!issued} onClose={() => { if (!busy) { setAsk(null); setIssued(null); } }}
            maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
              {issued ? "Your recovery codes" : "Confirm it is you"}
            </DialogTitle>
            <DialogContent>
              {issued ? (
                <>
                  <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 1.5, lineHeight: 1.5 }}>
                    Copy these somewhere that is not the phone your authenticator is on. They will not be shown
                    again, and any set you had before has stopped working.
                  </Typography>
                  <Box sx={{
                    fontFamily: "ui-monospace, 'IBM Plex Mono', monospace", fontSize: "0.9rem", lineHeight: 1.9,
                    p: 1.75, borderRadius: "12px", bgcolor: "#f3f5f8", border: `1px solid ${HAIRLINE}`,
                    userSelect: "all", display: "grid", gap: 0.25,
                  }}>
                    {issued.map((c) => <Box key={c}>{c}</Box>)}
                  </Box>
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: "0.86rem", color: MUTED, mb: 2, lineHeight: 1.5 }}>
                    Whoever is at this keyboard already has your session, so your password is what stands
                    between a borrowed laptop and ten permanent ways back in.
                  </Typography>
                  <TextField size="small" fullWidth autoFocus type="password" label="Your password"
                    value={ask?.password ?? ""}
                    onChange={(e) => setAsk({ password: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter" && ask?.password) issue(ask.password); }} />
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              {issued ? (
                <>
                  <Button onClick={() => navigator.clipboard?.writeText(issued.join("\n")).catch(() => {})}
                    sx={{ textTransform: "none", color: MUTED }}>Copy all</Button>
                  <Button variant="contained" onClick={() => setIssued(null)} sx={{ textTransform: "none" }}>
                    I have saved them
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setAsk(null)} sx={{ textTransform: "none", color: MUTED }}>Cancel</Button>
                  <Button variant="contained" disabled={busy || !ask?.password}
                    onClick={() => ask && issue(ask.password)} sx={{ textTransform: "none" }}>
                    {busy ? "Working\u2026" : "Generate"}
                  </Button>
                </>
              )}
            </DialogActions>
          </Dialog>

        </>
      )}
    </Box>
  );
}
