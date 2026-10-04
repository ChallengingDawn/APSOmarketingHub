"use client";
// SET UP YOUR ACCOUNT.
//
// Two steps and no link: say who you are, and if that account is waiting for a
// password, choose one. An admin creates the account and tells you it exists;
// nothing has to be forwarded or pasted.
//
// It only ever works on an account that has never been signed into. One that is
// already in use gets the same reply as one that does not exist — otherwise this
// page is a way to find out who works here.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const INK = "#15223a";
const MUTED = "#5d6b85";

export default function SetUpAccount() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [who, setWho] = useState<{ fullName: string; username: string; role: string } | null>(null);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const call = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/claim", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That did not work."); return null; }
      return j;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const findMe = async () => {
    const j = await call({ identifier });
    if (j?.stage === "password") setWho({ fullName: j.fullName, username: j.username, role: j.role });
  };

  const setPassword = async () => {
    if (pw !== again) { setError("The two passwords do not match."); return; }
    const j = await call({ identifier, password: pw });
    if (j?.stage === "done") {
      setDone(true);
      setTimeout(() => router.push("/signin"), 1800);
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
        width: "100%", maxWidth: 420, p: { xs: 3, md: 4 }, borderRadius: "22px",
        bgcolor: "rgba(255,255,255,.84)", backdropFilter: "blur(18px)",
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

        {done ? (
          <Box sx={{ display: "grid", gap: 1.5, justifyItems: "start" }}>
            <CheckCircleIcon sx={{ fontSize: 34, color: "#1e7e45" }} />
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 600, color: INK }}>Your password is set</Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED }}>
              Taking you to sign in. Nobody else has ever seen it.
            </Typography>
          </Box>
        ) : !who ? (
          <>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              Set up your account
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.5, mb: 3 }}>
              For an account somebody has created for you but that has no password yet.
            </Typography>
            <Box sx={{ display: "grid", gap: 2 }}>
              <TextField label="Username or email" size="small" value={identifier} autoFocus
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") findMe(); }} />
              {error && <Typography sx={{ fontSize: "0.85rem", color: "#9e1b18" }}>{error}</Typography>}
              <Button variant="contained" disabled={busy || !identifier.trim()} onClick={findMe}
                sx={{ textTransform: "none", borderRadius: "12px" }}>
                {busy ? "Checking…" : "Continue"}
              </Button>
              <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>
                Already have a password? <Link href="/signin" style={{ color: "#2459d1" }}>Sign in</Link>.
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              Welcome, {who.fullName.split(" ")[0]}
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: MUTED, mt: 0.5, mb: 3 }}>
              Choose a password for <strong>{who.username}</strong>. Nobody else will see it, including whoever
              created your account.
            </Typography>
            <Box sx={{ display: "grid", gap: 2 }}>
              <TextField label="New password" type="password" size="small" value={pw} autoFocus
                onChange={(e) => setPw(e.target.value)} />
              <TextField label="Again" type="password" size="small" value={again}
                onChange={(e) => setAgain(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setPassword(); }} />
              {error && <Typography sx={{ fontSize: "0.85rem", color: "#9e1b18" }}>{error}</Typography>}
              <Button variant="contained" disabled={busy || !pw || !again} onClick={setPassword}
                sx={{ textTransform: "none", borderRadius: "12px" }}>
                {busy ? "Saving…" : "Set my password"}
              </Button>
              {who.role !== "viewer" && (
                <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
                  Your role also needs an authenticator app. You will be asked to set one up after signing in.
                </Typography>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
