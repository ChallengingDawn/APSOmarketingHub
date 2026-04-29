"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

export default function EnrollPage() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/enroll")
      .then(async (r) => {
        const text = await r.text();
        let d: { error?: string; qr?: string; secret?: string } = {};
        try { d = text ? JSON.parse(text) : {}; } catch {}
        if (d.error) { setErrorMsg(d.error); setStatus("error"); return; }
        setQr(d.qr ?? null); setSecret(d.secret ?? null);
      })
      .catch(() => { setStatus("error"); setErrorMsg("Failed to start enrollment"); });
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const r = await fetch("/api/auth/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const text = await r.text();
      let d: { error?: string; next?: string } = {};
      try { d = text ? JSON.parse(text) : {}; } catch {}
      if (!r.ok) throw new Error(d.error || "Wrong code");
      router.push(d.next ?? "/");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Wrong code");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f6f7f9", p: 3 }}>
      <Card sx={{ maxWidth: 460, width: "100%", borderRadius: 4, border: "1px solid #ececec", borderTop: "3px solid #ed1b2f", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography sx={{ fontFamily: "'Outfit','Inter',sans-serif", fontSize: "1.3rem", fontWeight: 600, color: "#1f1f1f", letterSpacing: "-0.015em" }}>
            Set up two-factor
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", color: "#5f6368", mb: 2 }}>
            Scan the QR with Google Authenticator (or Authy / 1Password / Microsoft Authenticator), then enter the 6-digit code to confirm.
          </Typography>

          {qr ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mb: 2 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="TOTP QR" style={{ borderRadius: 8, border: "1px solid #ececec" }} />
              {secret && (
                <Typography component="details" sx={{ width: "100%", fontSize: 11, color: "#5f6368" }}>
                  <summary style={{ cursor: "pointer" }}>Can&apos;t scan? Show secret</summary>
                  <code style={{ display: "block", fontFamily: "monospace", marginTop: 8, padding: 8, background: "#f6f7f9", borderRadius: 4, wordBreak: "break-all", fontSize: 11 }}>{secret}</code>
                </Typography>
              )}
            </Box>
          ) : !errorMsg && <CircularProgress size={28} sx={{ color: "#ed1b2f", display: "block", mx: "auto", my: 2 }} />}

          <form onSubmit={confirm}>
            <TextField
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" fullWidth required
              slotProps={{ input: { sx: { fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center", fontFamily: "monospace" } } }}
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
              {status === "loading" ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Confirm and finish"}
            </Button>
            {errorMsg && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: "0.8rem" }}>{errorMsg}</Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
