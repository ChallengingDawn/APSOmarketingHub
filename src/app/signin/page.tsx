"use client";
// THE WAY IN — one door, and it works out what to ask for.
//
// You type your address. The hub looks it up and asks the one question that
// follows from the answer: your password if you have one, a password to choose
// if your account has never been signed into, or your name and a password if you
// work here and have no account at all.
//
// No second page, no link to forward, no "first time here?" to notice. SARCLA's
// rule: ask for the email and derive the rest from it.
//
// The branching lives in /api/auth/claim; this page only draws whichever of the
// three it is told. Every path finishes the same way — the password just set is
// handed straight to the ordinary login, so nobody types it twice.

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { ACCENT, AuthShell, INK, MUTED, primaryButton } from "@/app/AuthShell";

type Step = "who" | "password" | "setup" | "create";

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get("error");

  const [step, setStep] = useState<Step>("who");
  const [identifier, setIdentifier] = useState("");
  const [who, setWho] = useState<{ fullName?: string; username?: string; role?: string } | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenError =
    errorParam === "missing_token" || errorParam === "invalid_token"
      ? "Session expired. Please sign in again."
      : null;

  /** Where everything ends: the ordinary login, with whatever password is current. */
  const finish = async (pw: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), password: pw }),
    });
    const body = (await r.json().catch(() => ({}))) as { error?: string; next?: string };
    if (!r.ok) throw new Error(body.error || "Sign in failed");
    router.push(body.next ?? "/");
  };

  const lookUp = async () => {
    if (!identifier.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That did not work."); return; }
      setWho({ fullName: j.fullName, username: j.username, role: j.role });
      if (j.stage === "signin") setStep("password");
      else if (j.stage === "password") setStep("setup");
      else if (j.stage === "create") { setFullName(j.suggestedName ?? ""); setStep("create"); }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await finish(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed. Please try again.");
      setBusy(false);
    }
  };

  /** Setting a password for the first time, and making an account, are one call. */
  const choosePassword = async () => {
    if (password !== again) { setError("The two passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/claim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(), password,
          ...(step === "create" ? { fullName: fullName.trim() } : {}),
        }),
      });
      const j = await r.json();
      if (!j?.ok) { setError(j?.error ?? "That did not work."); setBusy(false); return; }
      await finish(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const restart = () => {
    setStep("who"); setWho(null); setPassword(""); setAgain(""); setError(null);
  };

  const field = { size: "small" as const, fullWidth: true };

  return (
    <AuthShell>
      {tokenError && step === "who" && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: "12px", fontSize: "0.82rem" }}>{tokenError}</Alert>
      )}

      {/* The address you gave, and the way back to change it. */}
      {step !== "who" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
          <Button size="small" onClick={restart} startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: "none", color: MUTED, minWidth: 0, px: 0.5 }}>
            {identifier}
          </Button>
        </Box>
      )}

      {step === "who" && (
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); lookUp(); }}
          sx={{ display: "grid", gap: 2 }}>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Sign in
          </Typography>
          <TextField {...field} label="Work email" autoFocus value={identifier}
            placeholder="yourname@apsoparts.com"
            onChange={(e) => setIdentifier(e.target.value)} disabled={busy} />
          {error && <Alert severity="error" sx={{ borderRadius: "12px", fontSize: "0.82rem" }}>{error}</Alert>}
          <Button type="submit" disabled={busy || !identifier.trim()} sx={primaryButton}>
            {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Continue"}
          </Button>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "center", lineHeight: 1.5 }}>
            New here? Use your work address — if you have no account yet, the next step makes one.
          </Typography>
        </Box>
      )}

      {step === "password" && (
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); signIn(); }}
          sx={{ display: "grid", gap: 2 }}>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Welcome back{who?.fullName ? `, ${who.fullName.split(" ")[0]}` : ""}
          </Typography>
          <TextField {...field} label="Password" type="password" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          {error && <Alert severity="error" sx={{ borderRadius: "12px", fontSize: "0.82rem" }}>{error}</Alert>}
          <Button type="submit" disabled={busy || !password} sx={primaryButton}>
            {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Sign in"}
          </Button>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, textAlign: "center" }}>
            <Link href="/login/reset" style={{ color: ACCENT, fontWeight: 600 }}>Forgotten it?</Link>{" "}
            Reset it with your authenticator.
          </Typography>
        </Box>
      )}

      {(step === "setup" || step === "create") && (
        <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); choosePassword(); }}
          sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
              {step === "create"
                ? "Let's make your account"
                : `Welcome${who?.fullName ? `, ${who.fullName.split(" ")[0]}` : ""}`}
            </Typography>
            <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.5 }}>
              {step === "create"
                ? "You start as a viewer with the Datatracker. Ask an admin for anything more."
                : "Choose a password. Nobody else will see it, including whoever created your account."}
            </Typography>
          </Box>
          {step === "create" && (
            <TextField {...field} label="Your name" value={fullName} autoFocus
              onChange={(e) => setFullName(e.target.value)} disabled={busy} />
          )}
          <TextField {...field} label="Password" type="password" value={password}
            autoFocus={step === "setup"}
            onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <TextField {...field} label="Again" type="password" value={again}
            onChange={(e) => setAgain(e.target.value)} disabled={busy} />
          {error && <Alert severity="error" sx={{ borderRadius: "12px", fontSize: "0.82rem" }}>{error}</Alert>}
          <Button type="submit" sx={primaryButton}
            disabled={busy || !password || !again || (step === "create" && !fullName.trim())}>
            {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} />
              : step === "create" ? "Create my account" : "Set my password"}
          </Button>
          {who?.role && who.role !== "viewer" && (
            <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>
              Your role also needs an authenticator app. You will be asked to set one up straight after.
            </Typography>
          )}
        </Box>
      )}
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
