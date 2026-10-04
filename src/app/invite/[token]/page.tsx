"use client";
// SETTING YOUR OWN PASSWORD.
//
// Where an invited person lands. No sign-in needed — the link is the proof —
// and no password an admin has ever seen, which is the point of inviting rather
// than handing one over.
//
// Outside the app shell on purpose: there is nothing to navigate to yet.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const INK = "#15223a";
const MUTED = "#5d6b85";

type Who = { fullName: string; username: string; role: string };

export default function AcceptInvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [who, setWho] = useState<Who | null>(null);
  const [dead, setDead] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => (j?.ok ? setWho(j as Who) : setDead(j?.error ?? "This link is no longer valid.")))
      .catch(() => setDead("This link could not be checked."));
  }, [token]);

  const submit = async () => {
    if (pw !== again) { setError("The two passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That could not be saved."); return; }
      setDone(true);
      setTimeout(() => router.push("/signin"), 1800);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{
      minHeight: "100vh", display: "grid", placeItems: "center", px: 2, py: 6,
      background:
        "radial-gradient(110% 80% at 8% 0%, #efe6fb 0%, transparent 55%)," +
        "radial-gradient(90% 70% at 92% 6%, #ffe8ef 0%, transparent 52%)," +
        "radial-gradient(90% 80% at 70% 100%, #e3f4fb 0%, transparent 55%), #f7f8fb",
    }}>
      <Box sx={{
        width: "100%", maxWidth: 440, p: { xs: 3, md: 4 }, borderRadius: "22px",
        bgcolor: "rgba(255,255,255,.82)", backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,.85)",
        boxShadow: "0 2px 6px rgba(31,45,78,.06), 0 20px 48px rgba(31,45,78,.12)",
      }}>
        <Box sx={{ display: "flex", alignItems: "baseline", mb: 3 }}>
          <Box component="span" sx={{
            fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
            fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: INK,
          }}>APSO</Box>
          <Box component="span" sx={{
            fontFamily: "var(--font-outfit), var(--font-inter), sans-serif",
            fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em",
            background: "linear-gradient(95deg,#3b82f6,#8b5cf6)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            display: "inline-block", paddingRight: "6px", marginRight: "-4px",
          }}>hub</Box>
        </Box>

        {dead && (
          <>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, color: INK, mb: 1 }}>
              This link will not work
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED, mb: 2.5 }}>
              {dead} Ask whoever invited you for a new one — they are single-use and last three days.
            </Typography>
            <Button href="/signin" variant="outlined" sx={{ textTransform: "none", borderRadius: "12px" }}>
              Go to sign in
            </Button>
          </>
        )}

        {!who && !dead && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: MUTED }}>
            <CircularProgress size={18} /> <Typography sx={{ fontSize: "0.9rem" }}>Checking the link…</Typography>
          </Box>
        )}

        {done && (
          <Box sx={{ display: "grid", gap: 1.5, justifyItems: "start" }}>
            <CheckCircleIcon sx={{ fontSize: 34, color: "#1e7e45" }} />
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, color: INK }}>Your password is set</Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>
              Taking you to sign in. Nobody else has ever seen this password, including whoever invited you.
            </Typography>
          </Box>
        )}

        {who && !done && (
          <>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              Welcome, {who.fullName.split(" ")[0]}
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.5, mb: 3 }}>
              Choose a password for <strong>{who.username}</strong>. Nobody else will see it — not even the
              person who created your account.
            </Typography>

            <Box sx={{ display: "grid", gap: 2 }}>
              <TextField label="New password" type="password" size="small" value={pw}
                onChange={(e) => setPw(e.target.value)} autoFocus />
              <TextField label="Again" type="password" size="small" value={again}
                onChange={(e) => setAgain(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
              {error && <Typography sx={{ fontSize: "0.85rem", color: "#9e1b18" }}>{error}</Typography>}
              <Button variant="contained" disabled={busy || !pw || !again} onClick={submit}
                sx={{ textTransform: "none", borderRadius: "12px" }}>
                {busy ? "Saving…" : "Set my password"}
              </Button>
              {who.role !== "viewer" && (
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                  Your role also needs an authenticator app. You will be asked to set one up straight after
                  signing in.
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
