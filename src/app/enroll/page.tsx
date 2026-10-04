"use client";
// SETTING UP AN AUTHENTICATOR.
//
// Demanded of anyone who can change something, offered to anyone who only
// reads. A viewer who is made to set up an authenticator before they can look
// at a page is a viewer who does not come back, and the server decides which
// they are — `maySkip` comes from the role, never from this page asking.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import { ACCENT, AuthShell, FAINT, INK, MUTED, codeField, primaryButton } from "@/app/AuthShell";

export default function EnrollPage() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [maySkip, setMaySkip] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/enroll")
      .then(async (r) => {
        const text = await r.text();
        let d: { error?: string; qr?: string; secret?: string; maySkip?: boolean } = {};
        try { d = text ? JSON.parse(text) : {}; } catch {}
        if (d.error) { setErrorMsg(d.error); return; }
        setQr(d.qr ?? null); setSecret(d.secret ?? null); setMaySkip(!!d.maySkip);
      })
      .catch(() => setErrorMsg("Failed to start enrollment"));
  }, []);

  const post = async (body: object) => {
    setBusy(true);
    setErrorMsg("");
    try {
      const r = await fetch("/api/auth/enroll", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const text = await r.text();
      let d: { error?: string; next?: string } = {};
      try { d = text ? JSON.parse(text) : {}; } catch {}
      if (!r.ok) throw new Error(d.error || "Wrong code");
      router.push(d.next ?? "/");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Wrong code");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Typography sx={{ fontSize: "1.15rem", fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
        Set up two-factor
      </Typography>
      <Typography sx={{ fontSize: "0.86rem", color: MUTED, mt: 0.5, mb: 2.5 }}>
        Scan the code with Google Authenticator, Authy, 1Password or Microsoft Authenticator, then type the
        six digits it shows.
      </Typography>

      {qr ? (
        <Box sx={{ display: "grid", justifyItems: "center", gap: 1.5, mb: 2.5 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Authenticator QR code"
            style={{ borderRadius: 12, border: "1px solid rgba(21,34,58,.10)" }} />
          {secret && (
            <Typography component="details" sx={{ width: "100%", fontSize: 11, color: MUTED }}>
              <summary style={{ cursor: "pointer" }}>Can&apos;t scan? Show the key</summary>
              <code style={{
                display: "block", fontFamily: "ui-monospace, monospace", marginTop: 8, padding: 8,
                background: "#f3f5f8", borderRadius: 8, wordBreak: "break-all", fontSize: 11,
              }}>{secret}</code>
            </Typography>
          )}
        </Box>
      ) : !errorMsg && <CircularProgress size={26} sx={{ color: ACCENT, display: "block", mx: "auto", my: 3 }} />}

      <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); post({ code }); }}
        sx={{ display: "grid", gap: 2 }}>
        <TextField
          size="small" inputMode="numeric" value={code} fullWidth placeholder="000000"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          slotProps={{ input: { sx: codeField } }}
        />
        {errorMsg && <Alert severity="error" sx={{ borderRadius: "12px", fontSize: "0.82rem" }}>{errorMsg}</Alert>}
        <Button type="submit" disabled={busy || code.length !== 6} sx={primaryButton}>
          {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Confirm and finish"}
        </Button>

        {/* Offered only where the role allows it; the server refuses it anyway. */}
        {maySkip && (
          <Box sx={{ textAlign: "center" }}>
            <Button onClick={() => post({ skip: true })} disabled={busy}
              sx={{ textTransform: "none", color: MUTED, fontSize: "0.84rem" }}>
              Not now — take me in
            </Button>
            <Typography sx={{ fontSize: "0.76rem", color: FAINT, mt: -0.5 }}>
              You only read, so this is yours to choose. You will be offered it again next time.
            </Typography>
          </Box>
        )}
      </Box>
    </AuthShell>
  );
}
