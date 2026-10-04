"use client";
import { useState } from "react";
import Link from "next/link";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import { ACCENT, AuthShell, INK, MUTED, primaryButton } from "@/app/AuthShell";

// Forgot-password flow: the authenticator code is the proof of identity, then
// a new password is set. No e-mail round-trip, no admin, no env changes.
export default function ResetPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = identifier.trim().length > 0 && code.length === 6 && password.length >= 10 && confirm === password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/reset-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), code, password }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(body.error || "Reset failed");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Reset failed. Please try again.");
    }
  }

  const field = { fullWidth: true, disabled: status === "loading", sx: { mb: 2 } } as const;

  return (
    <AuthShell>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Reset your password
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.5, mb: 2.5 }}>
            Your authenticator app proves it&apos;s you: enter the current 6-digit code, then choose a new password.
          </Typography>

          {status === "done" ? (
            <>
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>
                Password changed. Sign in with the new one — your authenticator stays as it is.
              </Alert>
              <Button
                component={Link}
                href="/signin"
                fullWidth
                sx={primaryButton}
              >
                Go to sign in
              </Button>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <TextField
                label="Email or username"
                placeholder="yourname@apsoparts.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                {...field}
              />
              <TextField
                label="Authenticator code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                slotProps={{ input: { sx: { fontSize: "1.2rem", letterSpacing: "0.35em", fontFamily: "monospace" } } }}
                {...field}
              />
              <TextField
                type="password"
                label="New password"
                helperText="At least 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                {...field}
              />
              <TextField
                type="password"
                label="Repeat new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={mismatch}
                helperText={mismatch ? "Passwords do not match" : " "}
                required
                fullWidth
                disabled={status === "loading"}
                sx={{ mb: 1.5 }}
              />
              <Button
                type="submit"
                fullWidth
                disabled={status === "loading" || !ready}
                sx={primaryButton}
              >
                {status === "loading" ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Set new password"}
              </Button>
              {status === "error" && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: "12px", fontSize: "0.82rem" }}>{errorMsg}</Alert>
              )}
              <Typography sx={{ fontSize: "0.8rem", color: MUTED, mt: 2.5, textAlign: "center" }}>
                Lost the authenticator too? An admin can clear it for you from Settings → People.{" "}
                <Link href="/signin" style={{ color: ACCENT, fontWeight: 600 }}>Back to sign in</Link>
              </Typography>
            </form>
          )}
    </AuthShell>
  );
}
