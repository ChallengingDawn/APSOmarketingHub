"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

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
      router.push("/personality");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f6f7f9", p: 3 }}>
      <Card sx={{ maxWidth: 460, width: "100%", borderRadius: 4, border: "1px solid #ececec", borderTop: "3px solid #ed1b2f", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography sx={{ fontFamily: "'Outfit','Inter',sans-serif", fontSize: "1.3rem", fontWeight: 600, color: "#1f1f1f" }}>
            Set a new password
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", color: "#5f6368", mb: 2.5 }}>
            Your account requires a password change. Use at least 10 characters with a mix of upper, lower, and a digit.
          </Typography>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: "0.8rem" }}>{errorMsg}</Alert>
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
              sx={{
                bgcolor: "#ed1b2f", color: "#fff", borderRadius: 999,
                textTransform: "none", fontWeight: 600, py: 1.25,
                "&:hover": { bgcolor: "#d80901" },
                "&.Mui-disabled": { bgcolor: "#fbb1b8", color: "#fff" },
              }}
            >
              {status === "loading" ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
