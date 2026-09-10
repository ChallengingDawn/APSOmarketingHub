"use client";
import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

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
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f6f7f9", p: 3 }}>
      <Card sx={{ maxWidth: 460, width: "100%", borderRadius: 4, border: "1px solid #ececec", borderTop: "3px solid #ed1b2f", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography sx={{ fontFamily: "'Outfit','Inter',sans-serif", fontSize: "1.3rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.015em" }}>
            Reset your password
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", color: "#5f6368", mb: 2.5 }}>
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
                sx={{ bgcolor: "#ed1b2f", color: "#fff", borderRadius: 999, textTransform: "none", fontWeight: 600, py: 1.25, "&:hover": { bgcolor: "#d80901" } }}
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
                sx={{
                  bgcolor: "#ed1b2f", color: "#fff", borderRadius: 999, textTransform: "none", fontWeight: 600, py: 1.25,
                  "&:hover": { bgcolor: "#d80901" },
                  "&.Mui-disabled": { bgcolor: "#fbb1b8", color: "#fff" },
                }}
              >
                {status === "loading" ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Set new password"}
              </Button>
              {status === "error" && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}>{errorMsg}</Alert>
              )}
              <Typography sx={{ fontSize: "0.78rem", color: "#5f6368", mt: 2.5, textAlign: "center" }}>
                Lost the authenticator too? An admin can reset you from Admin → Users.{" "}
                <Link href="/signin" style={{ color: "#274e64" }}>Back to sign in</Link>
              </Typography>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
