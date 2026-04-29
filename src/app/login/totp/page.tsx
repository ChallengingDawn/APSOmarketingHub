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

export default function TotpPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setStatus("loading");
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
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Wrong code");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f6f7f9", p: 3 }}>
      <Card sx={{ maxWidth: 420, width: "100%", borderRadius: 4, border: "1px solid #ececec", borderTop: "3px solid #ed1b2f", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography sx={{ fontFamily: "'Outfit','Inter',sans-serif", fontSize: "1.3rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.015em" }}>
            Two-factor code
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", color: "#5f6368", mb: 2.5 }}>
            Open your authenticator app and enter the 6-digit code.
          </Typography>
          <form onSubmit={onSubmit}>
            <TextField
              autoFocus inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              fullWidth
              slotProps={{
                input: { sx: { fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center", fontFamily: "monospace" } },
              }}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit" fullWidth disabled={status === "loading" || code.length !== 6}
              sx={{
                bgcolor: "#ed1b2f", color: "#fff", borderRadius: 999,
                textTransform: "none", fontWeight: 600, py: 1.25,
                "&:hover": { bgcolor: "#d80901" },
                "&.Mui-disabled": { bgcolor: "#fbb1b8", color: "#fff" },
              }}
            >
              {status === "loading" ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Verify"}
            </Button>
            {status === "error" && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}>{errorMsg}</Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
