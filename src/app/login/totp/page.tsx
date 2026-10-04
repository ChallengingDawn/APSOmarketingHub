"use client";
// The six digits, on the same card as the rest of the door.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import { AuthShell, INK, MUTED, codeField, primaryButton } from "@/app/AuthShell";

export default function TotpPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string; next?: string };
      if (!r.ok) throw new Error(body.error || "Wrong code");
      router.push(body.next ?? "/");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Wrong code");
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
        Two-factor code
      </Typography>
      <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.5, mb: 2.5 }}>
        Open your authenticator app and type the six digits it shows.
      </Typography>
      <Box component="form" onSubmit={onSubmit} sx={{ display: "grid", gap: 2 }}>
        <TextField
          autoFocus size="small" inputMode="numeric" fullWidth value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          slotProps={{ input: { sx: codeField } }}
        />
        {errorMsg && <Alert severity="error" sx={{ borderRadius: "12px", fontSize: "0.82rem" }}>{errorMsg}</Alert>}
        <Button type="submit" disabled={busy || code.length !== 6} sx={primaryButton}>
          {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Verify"}
        </Button>
      </Box>
    </AuthShell>
  );
}
