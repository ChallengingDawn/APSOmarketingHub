"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import { AuthShell, INK, MUTED, primaryButton } from "@/app/AuthShell";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (newPassword !== confirm) {
      setStatus("error");
      setErrorMsg("New password and confirmation do not match.");
      return;
    }
    setStatus("loading");
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!r.ok) throw new Error(body.error || "Failed to change password");
      router.push("/");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  return (
    <AuthShell>
          <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
            Set a new password
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.5, mb: 2.5 }}>
            Your account requires a password change. Use at least 10 characters with a mix of upper, lower, and a digit.
          </Typography>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "12px", fontSize: "0.82rem" }}>{errorMsg}</Alert>
          )}

          <form onSubmit={onSubmit}>
            <TextField fullWidth type="password" label="Current password"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              required autoFocus sx={{ mb: 2 }} />
            <TextField fullWidth type="password" label="New password"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              required sx={{ mb: 2 }} />
            <TextField fullWidth type="password" label="Confirm new password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              required sx={{ mb: 2.5 }} />
            <Button type="submit" fullWidth
              disabled={status === "loading" || !currentPassword || !newPassword || !confirm}
              sx={primaryButton}
            >
              {status === "loading" ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Update password"}
            </Button>
          </form>
    </AuthShell>
  );
}
